/**
 * E2B Shell Runner — Execute shell commands in an isolated E2B sandbox
 *
 * This replaces the old Bun.spawn approach that ran commands on the worker host.
 * Now every shell command runs in an isolated E2B sandbox with:
 * - The project's files written to /home/user/project
 * - npm/node/python available
 * - No access to worker secrets
 * - Auto-destroyed after the command completes
 *
 * The sandbox is created on-demand per command (not persisted). This is
 * resource-efficient: we only pay for E2B when the agent actually needs
 * to run a command, not during file writes.
 */

import { Sandbox } from 'e2b';
import { logger } from './logger';
import type { SupabaseClient } from '@supabase/supabase-js';

const E2B_API_KEY = process.env.E2B_API_KEY!;

/**
 * Run a shell command in an E2B sandbox with the project's files.
 *
 * 1. Create a new sandbox
 * 2. Write all project files from the in-memory Map to /home/user/project
 * 3. Run the command in /home/user/project
 * 4. Capture stdout/stderr/exit code
 * 5. Destroy the sandbox
 *
 * @param command - The shell command to run
 * @param files - Map of filePath -> content (the project's files)
 * @returns stdout, stderr, exitCode
 */
export async function runInE2B(
  command: string,
  files: Record<string, string>,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  if (!E2B_API_KEY) {
    throw new Error('E2B_API_KEY not set — cannot run shell commands in sandbox');
  }

  let sandbox: Sandbox | null = null;

  try {
    // Create a new sandbox
    sandbox = await Sandbox.create({ apiKey: E2B_API_KEY });
    logger.info(`[e2b] Sandbox created: ${sandbox.sandboxId}`);

    // Write all project files to /home/user/project
    const writePromises: Promise<void>[] = [];

    for (const [path, content] of Object.entries(files)) {
      const fullPath = `/home/user/project/${path}`;
      writePromises.push(sandbox.files.write(fullPath, content).then(() => {}));
    }

    await Promise.all(writePromises);
    logger.info(`[e2b] Wrote ${writePromises.length} files to sandbox`);

    // Run the command
    //
    // Timeout was 60_000ms — too short for `npm install` on real projects
    // (often 60-120s on cold E2B sandboxes), and definitely too short for
    // `npx playwright install chromium`. Bumped to 180s with a separate
    // longer budget for install-type commands detected heuristically.
    const isInstallCommand = /^(npm|pnpm|yarn|bunx|npx)\s+(install|i|add|ci|playwright install)/.test(command.trim());
    const timeoutMs = isInstallCommand ? 300_000 : 180_000;

    const result = await sandbox.commands.run(command, {
      cwd: '/home/user/project',
      timeoutMs,
    });

    logger.info(`[e2b] Command "${command}" → exit ${result.exitCode}`);

    return {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      exitCode: result.exitCode,
    };
  } catch (e) {
    logger.error(`[e2b] Error running command: ${e instanceof Error ? e.message : String(e)}`);

    return {
      stdout: '',
      stderr: e instanceof Error ? e.message : String(e),
      exitCode: -1,
    };
  } finally {
    // Always destroy the sandbox to avoid leaking resources
    if (sandbox) {
      try {
        await sandbox.kill();
        logger.info(`[e2b] Sandbox destroyed: ${sandbox.sandboxId}`);
      } catch (e) {
        logger.warn(`[e2b] Failed to destroy sandbox: ${e}`);
      }
    }
  }
}
