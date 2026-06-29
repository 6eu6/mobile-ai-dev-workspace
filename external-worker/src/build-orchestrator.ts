/**
 * Build Orchestrator — Phase 3 of Agentic Roadmap
 *
 * Handles complex build requests by:
 * 1. Decomposing the prompt into sequential tasks
 * 2. Generating each task with a separate LLM call (small, reliable)
 * 3. Merging results into the final project
 * 4. Streaming progress to the user at each step
 *
 * This prevents the "stream cutoff on complex prompts" bug by ensuring
 * each LLM call is small (~1000-3000 chars) instead of one massive call.
 *
 * Flow:
 *   User: "Build cinematic space-travel landing page with React, Tailwind,
 *          Framer Motion, liquid-glass CSS, FadingVideo..."
 *
 *   Orchestrator:
 *     📋 Analyzing request...
 *     ✓ Plan: 7 tasks
 *     ▶ Task 1/7: HTML shell + CDN scripts... ✓
 *     ▶ Task 2/7: Liquid-glass CSS... ✓
 *     ▶ Task 3/7: FadingVideo component... ✓
 *     ▶ Task 4/7: BlurText component... ✓
 *     ▶ Task 5/7: Navbar + Hero... ✓
 *     ▶ Task 6/7: Partners + Capabilities... ✓
 *     ▶ Task 7/7: App wiring... ✓
 *     🔍 Verifying... ✓
 *     🚀 Build complete!
 */

import { generateText, type LanguageModelV1 } from 'ai';
import { logger } from './logger';

export interface OrchestratorTask {
  id: number;
  name: string;
  file: string;
  description: string;
}

export interface OrchestratorPlan {
  reasoning: string;
  tasks: OrchestratorTask[];
}

export interface OrchestratorResult {
  success: boolean;
  files: Record<string, { type: 'file'; content: string; isBinary?: boolean }>;
  taskResults: Array<{
    taskId: number;
    taskName: string;
    success: boolean;
    duration: number;
    error?: string;
  }>;
  totalDuration: number;
}

/**
 * Progress callback — called after each task completes.
 * The caller (api.chat.ts) uses this to stream progress to the browser.
 */
export type ProgressCallback = (update: {
  type: 'plan' | 'task_start' | 'task_complete' | 'task_error' | 'verify' | 'complete' | 'error';
  message: string;
  taskId?: number;
  totalTasks?: number;
  taskName?: string;
  files?: Record<string, { type: 'file'; content: string }>;
}) => void;

/**
 * Decompose a complex prompt into sequential tasks.
 */
async function decompose(
  prompt: string,
  model: LanguageModelV1,
): Promise<OrchestratorPlan> {
  logger.info(`[orchestrator] Decomposing task (${prompt.length} chars)`);

  const systemPrompt = `You are a project planner for an AI app builder. Break the user's request into 5-8 sequential tasks.

CRITICAL RULES:
1. Each task MUST produce code that fits in 2000-4000 chars (NOT smaller)
2. Order by dependency: HTML shell first, then CSS, then components, then sections, then assembly
3. For single-file apps (HTML/CSS/JS), each task APPENDS content to the same index.html file
4. Be VERY SPECIFIC about what to create — mention exact class names, component names, content
5. NEVER combine unrelated things in one task (e.g., don't put CSS + JS + HTML in one task)
6. The LAST task must be "App Assembly" that wires everything together

OUTPUT FORMAT — return ONLY valid JSON, no markdown, no explanation:
{"reasoning":"1-2 sentences","tasks":[{"id":1,"name":"Short name","file":"index.html","description":"Detailed description of what to generate in this task, including specific elements, classes, and content"}]}

EXAMPLE for "Build a landing page with hero and features":
{"reasoning":"Single HTML file with CDN scripts, built incrementally","tasks":[{"id":1,"name":"HTML shell + CDN scripts","file":"index.html","description":"Create index.html with: DOCTYPE, html, head with Tailwind CDN script, React 18 CDN, Babel standalone, Google Fonts links, title, and body with #root div and empty script type=text/babel"},{"id":2,"name":"CSS utilities + base styles","file":"index.html","description":"Add a style block in head with: body background #000, custom CSS classes like .liquid-glass with backdrop-filter blur, .liquid-glass-strong, gradient borders via ::before with mask-composite, font-family setup"},{"id":3,"name":"Video component","file":"index.html","description":"Add a FadingVideo React component: wraps video element, uses requestAnimationFrame for crossfade, handles loadeddata/timeupdate/ended events, manual looping"},{"id":4,"name":"Navbar + Hero section","file":"index.html","description":"Add Navbar component (fixed top, liquid-glass pill, links) and Hero component (badge, headline, subheading, CTAs, stats cards)"},{"id":5,"name":"Features + Partners + Assembly","file":"index.html","description":"Add Features section (3 cards with icons) and Partners row (5 names). Then add App component that renders all sections, and ReactDOM.render to mount"}]}`;

  const result = await generateText({
    model,
    system: systemPrompt,
    prompt: `Break this build request into 5-8 tasks. Return ONLY JSON:\n\n${prompt}`,
    maxTokens: 3000,
    temperature: 0.2,
  });

  const rawText = result.text ?? '';
  logger.info(`[orchestrator] Decompose response: ${rawText.length} chars`);

  try {
    // Try to extract JSON — handle markdown fences
    let jsonStr = rawText;

    // Strip markdown code fences if present
    const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);

    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim();
    }

    // Find the JSON object
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    const plan = JSON.parse(jsonMatch?.[0] ?? jsonStr ?? '{}') as OrchestratorPlan;

    if (!plan.tasks?.length) {
      throw new Error('No tasks in plan');
    }

    // Validate each task has required fields
    for (const task of plan.tasks) {
      if (!task.name || !task.file || !task.description) {
        throw new Error(`Task ${task.id} missing required fields`);
      }
    }

    logger.info(`[orchestrator] Plan: ${plan.tasks.length} tasks — ${plan.tasks.map((t) => t.name).join(' → ')}`);

    return plan;
  } catch (parseErr) {
    logger.warn(`[orchestrator] Failed to parse decomposition plan (${parseErr instanceof Error ? parseErr.message : String(parseErr)}), raw: ${rawText.substring(0, 200)}`);

    // IMPROVED fallback: create a reasonable 5-task plan based on the prompt
    return {
      reasoning: 'Fallback 5-task plan (decomposer failed)',
      tasks: [
        {
          id: 1,
          name: 'HTML shell + CDN scripts + base CSS',
          file: 'index.html',
          description: `Create index.html with: DOCTYPE, head with Tailwind CDN (cdn.tailwindcss.com), React 18 CDN (unpkg react@18.3.1/umd/react.development.js), ReactDOM CDN, Babel standalone, Google Fonts. Add a style block with all custom CSS from the prompt (liquid-glass, etc). Body bg #000, #root div, empty script type=text/babel. Request: ${prompt.substring(0, 500)}`,
        },
        {
          id: 2,
          name: 'Core components (video, animations)',
          file: 'index.html',
          description: `Add React components: FadingVideo (custom crossfade with requestAnimationFrame), BlurText (word-by-word animation), and any other custom components mentioned in the prompt. Request: ${prompt.substring(0, 500)}`,
        },
        {
          id: 3,
          name: 'Hero section + Navbar',
          file: 'index.html',
          description: `Add Navbar component and Hero section with all elements from the prompt: badge, headline, subheading, CTAs, stats cards, partners row. Request: ${prompt.substring(0, 500)}`,
        },
        {
          id: 4,
          name: 'Remaining sections + content',
          file: 'index.html',
          description: `Add all remaining sections from the prompt (Capabilities, Features, etc). Include all specific content, text, and elements mentioned. Request: ${prompt.substring(0, 500)}`,
        },
        {
          id: 5,
          name: 'App assembly + render',
          file: 'index.html',
          description: `Add App component that renders all sections in order, then ReactDOM.render(<App/>, document.getElementById('root')). Ensure all components are properly defined and exported via window.X = X. Request: ${prompt.substring(0, 500)}`,
        },
      ],
    };
  }
}

/**
 * Execute a single task — generate code for one piece of the project.
 *
 * The LLM gets:
 * - The original prompt (for context)
 * - The current state of the file (what's been generated so far)
 * - The specific task to perform
 *
 * It returns the file with this task's code appended/updated.
 */
async function executeTask(
  task: OrchestratorTask,
  originalPrompt: string,
  currentFiles: Record<string, { type: 'file'; content: string }>,
  model: LanguageModelV1,
): Promise<{ content: string; raw: string }> {
  const existingContent = currentFiles[task.file]?.content ?? '';

  const systemPrompt = `You are an expert web developer generating code for a project.

CRITICAL RULES:
1. Output code wrapped in <palmkitArtifact> tags
2. For EXISTING files, output the COMPLETE file with your additions merged in
3. For NEW files, output the complete file from scratch
4. End with __PALMKIT_DONE__ on the last line
5. Write COMPLETE code — no placeholders, no "...rest stays same"

FORMAT:
<palmkitArtifact id="task-${task.id}" title="${task.name}">
<palmkitAction type="file" filePath="${task.file}">
[COMPLETE FILE CONTENT HERE]
</palmkitAction>
</palmkitArtifact>
__PALMKIT_DONE__`;

  const userPrompt = `Original request: ${originalPrompt.substring(0, 2000)}

${existingContent ? `Current ${task.file} (already generated, MERGE your additions into this):` : 'This is a new file.'}
${existingContent ? existingContent.substring(0, 3000) : ''}

YOUR TASK: ${task.name}
${task.description}

Generate the ${existingContent ? 'updated' : 'complete'} ${task.file} file now.`;

  const result = await generateText({
    model,
    system: systemPrompt,
    prompt: userPrompt,
    maxTokens: 12000,
    temperature: 0.7,
  });

  return {
    content: result.text ?? '',
    raw: result.text ?? '',
  };
}

/**
 * Extract file content from palmkitArtifact tags.
 */
function extractFileContent(text: string, filePath: string): string | null {
  // Find the palmkitAction for this file
  const actionRegex = new RegExp(
    `<palmkitAction[^>]*filePath=["']${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>([\\s\\S]*?)</palmkitAction>`,
    'i',
  );

  const match = text.match(actionRegex);

  if (match) {
    return match[1].trim();
  }

  // Fallback: if no specific file match, try to get content between artifact tags
  const artifactMatch = text.match(/<palmkitAction[^>]*>([\s\S]*?)<\/palmkitAction>/i);

  return artifactMatch?.[1]?.trim() ?? null;
}

/**
 * Main orchestrator entry point.
 *
 * Call this from api.chat.ts when the prompt is complex enough to decompose.
 * It handles the entire multi-step build process and streams progress.
 */
export async function orchestrateBuild(
  prompt: string,
  model: LanguageModelV1,
  existingFiles: Record<string, { type: 'file'; content: string }>,
  onProgress: ProgressCallback,
): Promise<OrchestratorResult> {
  const startTime = Date.now();
  const taskResults: OrchestratorResult['taskResults'] = [];

  try {
    // ── Phase 1: Decompose ─────────────────────────────────────────────
    onProgress({
      type: 'plan',
      message: '📋 Analyzing request and creating build plan...',
    });

    const plan = await decompose(prompt, model);

    onProgress({
      type: 'plan',
      message: `✓ Plan ready: ${plan.tasks.length} tasks\n${plan.tasks.map((t) => `  ${t.id}. ${t.name}`).join('\n')}`,
      totalTasks: plan.tasks.length,
    });

    // ── Phase 2: Execute tasks sequentially ────────────────────────────
    const currentFiles: Record<string, { type: 'file'; content: string }> = { ...existingFiles };

    for (const task of plan.tasks) {
      const taskStart = Date.now();

      onProgress({
        type: 'task_start',
        message: `▶ Task ${task.id}/${plan.tasks.length}: ${task.name}`,
        taskId: task.id,
        totalTasks: plan.tasks.length,
        taskName: task.name,
      });

      try {
        const result = await executeTask(task, prompt, currentFiles, model);
        const fileContent = extractFileContent(result.raw, task.file);

        if (!fileContent || fileContent.length < 20) {
          throw new Error(`Task produced empty or too-short output (${fileContent?.length ?? 0} chars)`);
        }

        // Merge into current files
        currentFiles[task.file] = {
          type: 'file',
          content: fileContent,
        };

        const duration = Date.now() - taskStart;
        taskResults.push({
          taskId: task.id,
          taskName: task.name,
          success: true,
          duration,
        });

        onProgress({
          type: 'task_complete',
          message: `✓ Task ${task.id}/${plan.tasks.length}: ${task.name} (${duration}ms, ${fileContent.length} chars)`,
          taskId: task.id,
          totalTasks: plan.tasks.length,
          taskName: task.name,
          files: { ...currentFiles },
        });

        logger.info(`[orchestrator] Task ${task.id} complete: ${task.name} (${duration}ms, ${fileContent.length} chars)`);
      } catch (taskErr) {
        const duration = Date.now() - taskStart;
        const errorMsg = taskErr instanceof Error ? taskErr.message : String(taskErr);

        taskResults.push({
          taskId: task.id,
          taskName: task.name,
          success: false,
          duration,
          error: errorMsg,
        });

        onProgress({
          type: 'task_error',
          message: `⚠ Task ${task.id}/${plan.tasks.length}: ${task.name} failed — ${errorMsg}. Continuing...`,
          taskId: task.id,
          totalTasks: plan.tasks.length,
          taskName: task.name,
        });

        logger.warn(`[orchestrator] Task ${task.id} failed: ${task.name} — ${errorMsg}`);
        // Continue to next task — partial results are still useful
      }
    }

    // ── Phase 3: Verify ────────────────────────────────────────────────
    onProgress({
      type: 'verify',
      message: '🔍 Verifying build completeness...',
    });

    const totalFiles = Object.keys(currentFiles).length;
    const successCount = taskResults.filter((r) => r.success).length;
    const success = successCount > 0 && totalFiles > 0;

    const totalDuration = Date.now() - startTime;

    if (success) {
      onProgress({
        type: 'complete',
        message: `🚀 Build complete! ${totalFiles} file(s), ${successCount}/${plan.tasks.length} tasks succeeded (${totalDuration}ms)`,
        files: currentFiles,
      });
    } else {
      onProgress({
        type: 'error',
        message: `Build failed — 0 tasks succeeded out of ${plan.tasks.length}`,
      });
    }

    return {
      success,
      files: currentFiles,
      taskResults,
      totalDuration,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error(`[orchestrator] Fatal error: ${errorMsg}`);

    onProgress({
      type: 'error',
      message: `Build failed: ${errorMsg}`,
    });

    return {
      success: false,
      files: existingFiles,
      taskResults,
      totalDuration: Date.now() - startTime,
    };
  }
}
