/**
 * Orchestrator — Coordinates subagents to build a project
 *
 * Flow:
 * 1. Orchestrator reads the user prompt + worklog + manifest
 * 2. Orchestrator creates a build plan (which agents to call, in what order)
 * 3. For each step in the plan:
 *    a. Get the agent config (role, tools, system prompt)
 *    b. Filter tools to only allowed ones
 *    c. Run generateText with that agent's config
 *    d. Collect the result
 * 4. Return the final result (files from Builder, verification from Tester)
 *
 * In Phase 1, we use a DEFAULT_AGENT_FLOW (Researcher → Builder → Tester)
 * instead of asking the Orchestrator LLM to plan. This is simpler and
 * more reliable. The Orchestrator LLM planning can be added in Phase 2.
 */

import { generateText, type LanguageModelV1, type ToolSet } from 'ai';
import { createAgentTools, resetProjectFiles, getProjectFiles } from './agent-tools';
import { filterTools, getAgentConfig, DEFAULT_AGENT_FLOW, type AgentRole } from './agent-registry';
import { logger } from './logger';
import { emitEvent } from './event-emitter';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { FileOperation } from './generator';
import {
  readWorklog,
  appendToWorklog,
  readManifest,
  writeManifest,
  generateWorklogEntry,
  generateSmartManifest,
  writePalmkitMemory,
} from './workspace-manager';

export interface OrchestratorResult {
  success: boolean;
  files: FileOperation[];
  rawText: string;
  totalDuration: number;
  agentResults: Array<{ role: AgentRole; success: boolean; text: string; duration: number }>;
}

/**
 * Run the full agent pipeline: Researcher → Builder → Tester
 *
 * Each agent gets its own generateText call with filtered tools.
 * The Researcher's output is passed as context to the Builder.
 * The Builder's output (files) is passed to the Tester.
 */
export async function runOrchestratedBuild(
  prompt: string,
  model: LanguageModelV1,
  jobId: string,
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
  maxCompletionTokens?: number,
  appType?: string,
): Promise<OrchestratorResult> {
  const startTime = Date.now();
  resetProjectFiles();

  logger.info(`[orchestrator] Starting orchestrated build for job ${jobId} (project ${projectId})`);

  // Read worklog for context
  const worklog = await readWorklog(projectId);
  const hasWorklog = !!worklog;

  // Create all tools (shared across agents, filtered per agent)
  const allTools = createAgentTools(jobId, supabase, projectId);

  // Keep-alive timer (every 10s instead of 5s to reduce Realtime events)
  const keepAlive = setInterval(async () => {
    try {
      await emitEvent(
        supabase,
        jobId,
        'file_chunk' as any,
        `⏳ Building... (${Math.round((Date.now() - startTime) / 1000)}s)`,
      );
    } catch {
      /* best-effort */
    }
  }, 10000);

  // Hard-cap the whole orchestrator at 8 minutes. Without this, a hung LLM
  // provider could keep the keep-alive timer spinning forever, and the job
  // would never reach a terminal state — the user would see "Building... (Ns)"
  // climb without end. The cleanup in finally() cancels both timers.
  const HARD_TIMEOUT_MS = 8 * 60 * 1000;
  const hardTimeout = setTimeout(() => {
    logger.error(`[orchestrator] Hard timeout (${HARD_TIMEOUT_MS}ms) reached for job ${jobId}`);
    throw new Error(`Build exceeded ${HARD_TIMEOUT_MS / 1000}s timeout`);
  }, HARD_TIMEOUT_MS);

  const agentResults: OrchestratorResult['agentResults'] = [];
  let researcherContext = '';
  let builderContext = '';
  let testerContext = '';
  let overallSuccess = false;

  try {
    for (const role of DEFAULT_AGENT_FLOW) {
      const config = getAgentConfig(role);

      /*
       * TOKEN OPTIMIZATION: Skip Researcher for new projects (no worklog).
       * Researcher is only useful when editing existing projects — it reads
       * files and searches code. For a new project, there's nothing to read.
       * Skipping it saves ~5 LLM calls (5 maxSteps × 4000 tokens = 20K tokens).
       */
      if (role === 'researcher' && !hasWorklog) {
        logger.info('[orchestrator] Skipping Researcher (new project, nothing to read)');
        await emitEvent(
          supabase,
          jobId,
          'file_chunk' as any,
          '⏭️ Skipping Researcher (new project)',
        );
        continue;
      }

      const agentTools = filterTools(allTools as unknown as ToolSet, config.allowedTools);

      // Build the agent's prompt (includes context from previous agents)
      let agentPrompt = prompt;

      if (role === 'researcher' && hasWorklog) {
        agentPrompt = `${prompt}\n\nPROJECT MEMORY (worklog.md):\n${worklog}`;
      }

      if (role === 'builder' && researcherContext) {
        agentPrompt = `${prompt}\n\nRESEARCHER FINDINGS:\n${researcherContext}\n\nNow build the project based on these findings and the user's request.`;
      }

      if (role === 'tester' && builderContext) {
        agentPrompt = `The Builder has finished creating the project. Here's the summary:\n${builderContext}\n\nNow verify the project works. The files are already written — just run the build, tests, and screenshot.`;
      }

      logger.info(`[orchestrator] Running ${config.name} agent (maxSteps=${config.maxSteps})`);

      // Emit event for UI
      await emitEvent(
        supabase,
        jobId,
        'file_chunk' as any,
        `🤖 ${config.name} agent starting...`,
      );

      const agentStart = Date.now();

      /*
       * Token budget per step.
       *
       * The old code did Math.min(config.maxTokens, maxCompletionTokens ?? config.maxTokens)
       * — which means if maxCompletionTokens was undefined (model didn't expose it),
       * we got config.maxTokens (was 12000). And if maxCompletionTokens WAS set
       * (e.g. 65536 for GLM-5.2), we still got Math.min(32000, 65536) = 32000.
       * Either way, large models were capped at the registry floor.
       *
       * The fix: prefer maxCompletionTokens (the model's actual limit). Only fall
       * back to config.maxTokens when it's missing. Never Math.min — the registry
       * floor is already conservative.
       */
      const stepMaxTokens = maxCompletionTokens ?? config.maxTokens;

      /*
       * providerOptions for OpenRouter reasoning support.
       * For reasoning-capable models (DeepSeek-R1, GLM-5.2, o1/o3, etc.),
       * pass reasoning: { enabled: true } via providerOptions. The OpenAI
       * SDK shim forwards this as an extra body param that OpenRouter
       * recognizes. Non-OpenRouter providers ignore the `openrouter` key.
       */
      const isReasoningModel = /\b(r1|reasoning|thinking|o1|o3|o4)\b/i.test(
        (model as any)?.modelId ?? '',
      );
      const providerOptions = isReasoningModel
        ? { openrouter: { reasoning: { enabled: true } } }
        : undefined;

      const result = await generateText({
        model,
        system: config.systemPrompt,
        prompt: agentPrompt,
        tools: agentTools,
        maxSteps: config.maxSteps,
        temperature: 0.7,
        maxTokens: stepMaxTokens,
        ...(providerOptions ? { providerOptions } : {}),
        onStepFinish: async ({ toolCalls, text }) => {
          /*
           * Emit the LLM's own thinking text as a `reasoning` event so users
           * see what the agent is reasoning about between tool calls. The
           * previous code only emitted tool-call messages (📝 Written: ...),
           * leaving the LLM's narration invisible. Capped at 400 chars/event
           * to keep Realtime payload sizes reasonable.
           */
          if (text && text.trim().length > 0) {
            const snippet = text.trim().slice(0, 400);
            try {
              await emitEvent(
                supabase,
                jobId,
                'file_chunk' as any,
                `💭 [${config.name}] ${snippet}${text.length > 400 ? '…' : ''}`,
                { kind: 'reasoning', agent: config.name, text: snippet },
              );
            } catch {
              /* best-effort */
            }
          }

          for (const tc of toolCalls) {
            const toolName = tc.toolName;
            const args = tc.args as any;

            let msg = '';
            if (toolName === 'write_file') {
              msg = `📝 [${config.name}] Written: ${args.path}`;
            } else if (toolName === 'edit_file') {
              msg = `✏️ [${config.name}] Edited: ${args.path}`;
            } else if (toolName === 'read_file') {
              msg = `📖 [${config.name}] Reading: ${args.path}`;
            } else if (toolName === 'delete_file') {
              msg = `🗑️ [${config.name}] Deleted: ${args.path}`;
            } else if (toolName === 'search_code') {
              msg = `🔍 [${config.name}] Searching: ${args.pattern}`;
            } else if (toolName === 'list_files') {
              msg = `📋 [${config.name}] Listing files`;
            } else if (toolName === 'list_uploads') {
              msg = `📤 [${config.name}] Listing uploads`;
            } else if (toolName === 'run_shell') {
              msg = `⚡ [${config.name}] Running: ${args.command?.slice(0, 60)}`;
            } else if (toolName === 'run_tests') {
              msg = `🧪 [${config.name}] Running tests`;
            } else if (toolName === 'take_screenshot') {
              msg = `📸 [${config.name}] Taking screenshot`;
            } else if (toolName === 'done') {
              msg = `✅ [${config.name}] Done: ${(args.summary || '').slice(0, 80)}`;
            }

            if (msg) {
              try {
                await emitEvent(supabase, jobId, 'file_chunk' as any, msg);
              } catch {
                /* best-effort */
              }
            }
          }
        },
      });

      const agentDuration = Date.now() - agentStart;
      const agentText = result.text;
      /*
       * Success criteria — only true when the LLM finished cleanly AND made at
       * least one tool call. The old code (result.finishReason !== 'error')
       * treated 'length' (token-cap truncation) and 'tool-calls' (maxSteps hit)
       * as success — so a builder that hit maxSteps=30 mid-way through file 8
       * was reported as "succeeded" even though the project was incomplete.
       *
       * Now we explicitly fail on 'length' (truncated mid-file) and 'tool-calls'
       * (hit step limit, didn't reach done()). The orchestrator's overallSuccess
       * check still requires fileCount > 0.
       */
      const finishReason = result.finishReason;
      const madeToolCalls = (result.steps?.length ?? 0) > 0;
      const agentSuccess =
        finishReason !== 'error' &&
        finishReason !== 'length' &&
        (finishReason !== 'tool-calls' || madeToolCalls);

      if (finishReason === 'length') {
        logger.warn(
          `[orchestrator] ${config.name} hit token cap (finishReason=length) — output truncated. Consider raising maxTokens.`,
        );
        await emitEvent(
          supabase,
          jobId,
          'file_chunk' as any,
          `⚠️ ${config.name} hit token cap — output may be truncated.`,
        );
      } else if (finishReason === 'tool-calls') {
        logger.warn(
          `[orchestrator] ${config.name} hit maxSteps (${config.maxSteps}) — agent did not call done().`,
        );
        await emitEvent(
          supabase,
          jobId,
          'file_chunk' as any,
          `⚠️ ${config.name} reached step limit (${config.maxSteps}) — continuing with what was built.`,
        );
      }

      agentResults.push({
        role,
        success: agentSuccess,
        text: agentText,
        duration: agentDuration,
      });

      logger.info(
        `[orchestrator] ${config.name} finished: ${result.finishReason}, ${agentText.length} chars, ${agentDuration}ms`,
      );

      // Store context for next agent
      if (role === 'researcher') {
        researcherContext = agentText;
      } else if (role === 'builder') {
        builderContext = agentText;
      } else if (role === 'tester') {
        testerContext = agentText;
      }

      // Emit completion event
      await emitEvent(
        supabase,
        jobId,
        'file_chunk' as any,
        `✅ ${config.name} agent completed (${(agentDuration / 1000).toFixed(1)}s)`,
      );
    }

    // Check final result
    const files = getProjectFiles() as Record<string, string>;
    const fileCount = Object.keys(files).length;
    overallSuccess = fileCount > 0;

    logger.info(
      `[orchestrator] Build finished: ${fileCount} files, ${agentResults.length} agents ran`,
    );

    // Write worklog + manifest + .palmkit/ memory
    if (overallSuccess) {
      const totalSize = Object.values(files).reduce((s: number, c: string) => s + c.length, 0);
      const duration = Date.now() - startTime;
      const summary = testerContext || builderContext.slice(-500) || undefined;

      await emitEvent(
        supabase,
        jobId,
        'file_generation_completed' as any,
        `🚀 Orchestrated build complete: ${fileCount} files, ${totalSize} chars, ${agentResults.length} agents`,
        { fileCount, agents: agentResults.map((a) => a.role) },
      );

      try {
        // 1. Worklog
        const worklogEntry = generateWorklogEntry({
          prompt,
          fileCount,
          totalSize,
          summary,
          appType,
          duration,
        });
        await appendToWorklog(projectId, worklogEntry, supabase, userId);

        // 2. Smart manifest
        const smartManifest = generateSmartManifest({
          projectId,
          appType: appType ?? null,
          files,
          prompt,
          summary,
        });

        const manifest = await readManifest(projectId);
        manifest.lastBuildAt = new Date().toISOString();
        manifest.lastBuildSummary = summary?.slice(0, 200) || null;
        manifest.fileCount = fileCount;
        manifest.appType = appType ?? manifest.appType;
        manifest.schemaVersion = smartManifest.schemaVersion;
        manifest.projectType = smartManifest.projectType;
        manifest.stack = smartManifest.stack;
        manifest.entrypoints = smartManifest.entrypoints;
        manifest.importantFiles = smartManifest.importantFiles;
        manifest.commands = smartManifest.commands;
        manifest.apiRoutes = smartManifest.apiRoutes;
        manifest.qualityGates = smartManifest.qualityGates;
        manifest.lastKnownStatus = testerContext.includes('build pass')
          ? 'build_passed'
          : 'build_unknown';
        manifest.knownIssues = smartManifest.knownIssues;
        await writeManifest(manifest, supabase, userId);

        // 3. .palmkit/ memory layer
        await writePalmkitMemory(
          projectId,
          { prompt, files, appType: appType ?? null, summary, manifest: smartManifest },
          supabase,
          userId,
        );

        logger.info(`[orchestrator] Worklog + manifest + .palmkit/ memory updated for ${projectId}`);
      } catch (e) {
        logger.warn(`[orchestrator] Failed to update memory: ${e}`);
      }
    }

    // Convert files to FileOperation[] format
    const fileOps: FileOperation[] = Object.entries(getProjectFiles()).map(([path, content]) => ({
      op: 'write_file' as const,
      path,
      content,
    }));

    return {
      success: overallSuccess,
      files: fileOps,
      rawText: agentResults.map((a) => `[${a.role}]: ${a.text.slice(0, 200)}`).join('\n\n'),
      totalDuration: Date.now() - startTime,
      agentResults,
    };
  } catch (err) {
    logger.error(`[orchestrator] Build failed: ${err instanceof Error ? err.message : String(err)}`);

    const errFiles = getProjectFiles() as Record<string, string>;
    const errFileOps: FileOperation[] = Object.entries(errFiles).map(([path, content]) => ({
      op: 'write_file' as const,
      path,
      content,
    }));

    return {
      success: errFileOps.length > 0,
      files: errFileOps,
      rawText: `orchestrator-error: ${err instanceof Error ? err.message : String(err)}`,
      totalDuration: Date.now() - startTime,
      agentResults,
    };
  } finally {
    clearInterval(keepAlive);
    clearTimeout(hardTimeout);
  }
}
