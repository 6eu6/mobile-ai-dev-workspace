/**
 * Built-in Tools — Phase 1.2 + Phase 2 of Agentic Roadmap
 *
 * These tools let the LLM interact with the project DURING generation:
 * - read_file: read a file from the current project (R2 or workbench)
 * - list_files: list all files in the project
 * - web_search: search the web for docs/examples
 * - read_url: fetch and extract content from a URL
 *
 * Phase 2 additions (require sandbox):
 * - run_shell: run a shell command in the E2B sandbox (verify builds, install deps)
 * - screenshot: capture the preview and return it as base64 (visual verification)
 * - read_sandbox_file: read a file from the sandbox filesystem (post-build verification)
 * - grep: search for a pattern across all project files
 *
 * Why these tools matter:
 *   Without them, the LLM generates files "blind" — it can't verify its own
 *   output or check if a file it wrote actually exists. With these tools,
 *   the LLM can:
 *     1. Generate a file
 *     2. Read it back to verify
 *     3. Read other files for context
 *     4. Search the web for API docs
 *     5. Run shell commands to test the build (Phase 2)
 *     6. Take a screenshot to visually verify the preview (Phase 2)
 *
 * This turns Palmkit from "generate-and-pray" into "generate-verify-fix".
 *
 * Phase 2 tools (run_shell, screenshot, read_sandbox_file, grep) require
 * a sandboxId which is injected by api.chat.ts when a sandbox is available.
 */

import { tool } from 'ai';
import { z } from 'zod';

/**
 * Read a file from the current project.
 *
 * The LLM calls this to:
 * - Verify a file it just wrote exists and has the right content
 * - Read an existing file before modifying it
 * - Check imports/exports between files
 */
export const readFileTool = tool({
  description:
    'Read a file from the current project. Use this to verify your work or read existing files before modifying them. Returns the file content as text.',
  parameters: z.object({
    path: z.string().describe('The file path relative to the project root, e.g. "src/App.tsx" or "package.json"'),
  }),
  execute: async ({ path }, options) => {
    /*
     * The tool execution context provides the current project files via
     * a custom property we set in api.chat.ts when wiring the tools.
     */
    const files = (options as any)?.files as Record<string, { content: string }> | undefined;

    if (!files) {
      return { error: 'No project files available in this context' };
    }

    // Normalize path (remove leading ./ or /)
    const normalizedPath = path.replace(/^\.?\//, '');

    const file = files[normalizedPath] ?? files[`./${normalizedPath}`];

    if (!file) {
      return {
        error: `File not found: ${path}`,
        availableFiles: Object.keys(files).slice(0, 20),
      };
    }

    return {
      path: normalizedPath,
      content: file.content,
      size: file.content.length,
      lines: file.content.split('\n').length,
    };
  },
});

/**
 * List all files in the current project.
 *
 * The LLM calls this to:
 * - Understand the project structure
 * - Find files to import from
 * - Verify all expected files exist
 */
export const listFilesTool = tool({
  description:
    'List all files in the current project. Returns the file paths and their sizes. Use this to understand the project structure or verify all expected files exist.',
  parameters: z.object({}),
  execute: async (_, options) => {
    const files = (options as any)?.files as Record<string, { content: string }> | undefined;

    if (!files) {
      return { error: 'No project files available in this context' };
    }

    const fileList = Object.entries(files)
      .map(([path, file]) => ({
        path,
        size: file.content?.length ?? 0,
        lines: file.content?.split('\n').length ?? 0,
      }))
      .sort((a, b) => a.path.localeCompare(b.path));

    return {
      totalFiles: fileList.length,
      files: fileList,
    };
  },
});

/**
 * Search the web for documentation or examples.
 *
 * The LLM calls this when:
 * - It needs to check the latest API for a library
 * - It wants to find examples of a pattern
 * - It's unsure about a syntax detail
 *
 * Uses the Tavily API (free tier: 1000 searches/month) or falls back to
 * a simple fetch + extract if no API key is set.
 */
export const webSearchTool = tool({
  description:
    'Search the web for documentation, examples, or API references. Use this when you need to verify a library API, find usage examples, or check the latest syntax. Returns search results with titles, URLs, and snippets.',
  parameters: z.object({
    query: z.string().describe('The search query, e.g. "react-query useQuery example"'),
    maxResults: z.number().optional().default(5).describe('Max number of results (default 5)'),
  }),
  execute: async ({ query, maxResults }) => {
    // Check if we have a search API key
    const apiKey = process.env.TAVILY_API_KEY ?? process.env.SERPAPI_KEY;

    if (apiKey) {
      // Use Tavily (preferred - AI-optimized results)
      try {
        const resp = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: apiKey,
            query,
            max_results: maxResults,
            include_answer: true,
          }),
        });

        if (resp.ok) {
          const data = (await resp.json()) as {
            answer?: string;
            results?: Array<{ title: string; url: string; content?: string }>;
          };
          return {
            answer: data.answer ?? null,
            results: (data.results ?? []).map((r) => ({
              title: r.title,
              url: r.url,
              snippet: r.content?.substring(0, 300),
            })),
          };
        }
      } catch {
        // fall through to fallback
      }
    }

    // Fallback: return a helpful message instead of failing
    return {
      error: 'Web search not configured. Set TAVILY_API_KEY to enable.',
      suggestion: `You can manually search: https://www.google.com/search?q=${encodeURIComponent(query)}`,
    };
  },
});

/**
 * Read the content of a URL (fetch + extract text).
 *
 * The LLM calls this to:
 * - Read documentation pages
 * - Fetch API reference
 * - Get examples from a tutorial
 */
export const readUrlTool = tool({
  description:
    'Fetch a URL and extract its text content. Use this to read documentation pages, API references, or code examples. Returns the text content (HTML stripped).',
  parameters: z.object({
    url: z.string().url().describe('The URL to fetch'),
    maxLength: z.number().optional().default(5000).describe('Max characters to return (default 5000)'),
  }),
  execute: async ({ url, maxLength }) => {
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Palmkit-Agent/1.0' },
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      if (!resp.ok) {
        return { error: `HTTP ${resp.status}: ${resp.statusText}` };
      }

      const contentType = resp.headers.get('content-type') ?? '';

      if (contentType.includes('application/json')) {
        const data = await resp.json();
        return {
          url,
          contentType,
          content: JSON.stringify(data, null, 2).substring(0, maxLength),
        };
      }

      const html = await resp.text();

      // Simple HTML-to-text extraction (no external deps)
      const text = html
        // Remove scripts and styles
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[\s\S]*?<\/footer>/gi, '')
        // Convert blocks to newlines
        .replace(/<\/?(p|div|br|h[1-6]|li|ul|ol|pre|code)[^>]*>/gi, '\n')
        // Remove all other tags
        .replace(/<[^>]+>/g, '')
        // Decode common entities
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        // Collapse whitespace
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]+/g, ' ')
        .trim();

      return {
        url,
        contentType,
        content: text.substring(0, maxLength),
        totalLength: text.length,
        truncated: text.length > maxLength,
      };
    } catch (err) {
      return {
        error: `Failed to fetch URL: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
});

/**
 * All built-in tools, ready to be spread into streamText({ tools: ... }).
 *
 * Usage in api.chat.ts:
 *   import { builtInTools } from '~/lib/.server/llm/built-in-tools';
 *   const result = await streamText({
 *     ...,
 *     tools: {
 *       ...mcpService.toolsWithoutExecute,
 *       ...builtInTools,  // ← add this
 *     },
 *     onStepFinish: ({ toolCalls }) => { ... },
 *   });
 *
 * NOTE: The `execute` functions receive `options.files` which must be set
 * by the caller. In api.chat.ts, wrap the tools:
 *
 *   const toolsWithFiles = Object.fromEntries(
 *     Object.entries(builtInTools).map(([name, t]) => [
 *       name,
 *       { ...t, execute: (args, opts) => t.execute(args, { ...opts, files }) }
 *     ])
 *   );
 */
export const builtInTools = {
  read_file: readFileTool,
  list_files: listFilesTool,
  web_search: webSearchTool,
  read_url: readUrlTool,
} as const;

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * PHASE 2 TOOLS — require sandbox access (E2B)
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Run a shell command in the E2B sandbox.
 *
 * The LLM calls this to:
 * - Run `npm install` to verify dependencies install correctly
 * - Run `npm run build` to check for TypeScript/build errors
 * - Run `curl localhost:5173` to verify the dev server responds
 * - Run `ls`, `cat`, `grep` to inspect the filesystem
 *
 * Requires a sandboxId (injected via options.sandboxId).
 */
export const runShellTool = tool({
  description:
    'Run a shell command in the preview sandbox. Use this to verify your build: run "npm install", "npm run build", "curl http://localhost:5173", "ls", "cat <file>", etc. Returns stdout, stderr, and exit code.',
  parameters: z.object({
    command: z.string().describe('The shell command to run, e.g. "npm run build" or "ls -la"'),
    timeoutMs: z.number().optional().default(30000).describe('Timeout in milliseconds (default 30000, max 120000)'),
  }),
  execute: async ({ command, timeoutMs }, options) => {
    const sandboxId = (options as any)?.sandboxId as string | undefined;

    if (!sandboxId) {
      return {
        error: 'No sandbox available. The sandbox starts after files are written.',
        hint: 'Generate the <palmkitArtifact> first, then the sandbox will be available for verification.',
      };
    }

    try {
      const resp = await fetch('https://palmkit.app/api/sb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          op: 'run',
          id: sandboxId,
          command,
          timeoutMs,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        return { error: `Sandbox run failed: ${(err as any).error || resp.statusText}` };
      }

      const data = (await resp.json()) as {
        exitCode: number;
        stdout: string;
        stderr: string;
      };

      return {
        command,
        exitCode: data.exitCode,
        stdout: data.stdout.substring(0, 5000), // cap for context window
        stderr: data.stderr.substring(0, 3000),
        success: data.exitCode === 0,
      };
    } catch (err) {
      return {
        error: `Failed to run command: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
});

/**
 * Take a screenshot of the running preview.
 *
 * The LLM calls this to visually verify the app looks correct after building.
 * Returns a base64-encoded PNG image that the LLM can "see" if it has vision
 * capabilities, plus the size for confirmation.
 */
export const screenshotTool = tool({
  description:
    'Take a screenshot of the running preview app. Use this AFTER starting the dev server to visually verify the app renders correctly. Returns the screenshot as base64 image. The screenshot is taken from http://localhost:5173 by default.',
  parameters: z.object({
    url: z.string().optional().describe('URL to screenshot (default: http://localhost:5173)'),
  }),
  execute: async ({ url }, options) => {
    const sandboxId = (options as any)?.sandboxId as string | undefined;

    if (!sandboxId) {
      return {
        error: 'No sandbox available. Start the dev server first.',
      };
    }

    try {
      const resp = await fetch('https://palmkit.app/api/sb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          op: 'screenshot',
          id: sandboxId,
          url: url ?? 'http://localhost:5173',
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        return { error: `Screenshot failed: ${(err as any).error || resp.statusText}` };
      }

      const data = (await resp.json()) as {
        url: string;
        image: string;
        mimeType: string;
        size: number;
      };

      return {
        url: data.url,
        imageBase64: data.image.substring(0, 100) + '...[truncated for context]',
        fullImageSize: data.size,
        mimeType: data.mimeType,
        note: 'Screenshot captured. Use vision capabilities to analyze the image if available.',
      };
    } catch (err) {
      return {
        error: `Failed to take screenshot: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
});

/**
 * Read a file from the sandbox filesystem (post-build verification).
 *
 * Unlike read_file (which reads from the project's file map), this reads
 * the ACTUAL file in the sandbox — useful for verifying that files were
 * written correctly after npm install or build steps.
 */
export const readSandboxFileTool = tool({
  description:
    'Read a file from the sandbox filesystem. Use this to verify files were written correctly after build steps. Returns the file content.',
  parameters: z.object({
    path: z.string().describe('File path relative to project root, e.g. "src/App.tsx" or "package.json"'),
  }),
  execute: async ({ path }, options) => {
    const sandboxId = (options as any)?.sandboxId as string | undefined;

    if (!sandboxId) {
      return { error: 'No sandbox available.' };
    }

    try {
      const resp = await fetch('https://palmkit.app/api/sb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          op: 'read',
          id: sandboxId,
          path,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        return { error: `Read failed: ${(err as any).error || resp.statusText}` };
      }

      const data = (await resp.json()) as {
        path: string;
        content: string;
        size: number;
      };

      return {
        path: data.path,
        content: data.content.substring(0, 8000), // cap for context window
        size: data.size,
        truncated: data.size > 8000,
      };
    } catch (err) {
      return {
        error: `Failed to read file: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
});

/**
 * Search for a pattern across all project files.
 *
 * Faster than reading each file individually when looking for:
 * - "Where is this function defined?"
 * - "Which files import X?"
 * - "Find all TODO comments"
 */
export const grepTool = tool({
  description:
    'Search for a text pattern across all project files. Returns matching lines with file paths and line numbers. Use this to find where a function is defined, which files import something, or find TODO comments.',
  parameters: z.object({
    pattern: z.string().describe('The text or regex pattern to search for'),
    fileGlob: z
      .string()
      .optional()
      .describe('File pattern to search in (e.g. "*.tsx" or "src/**"). Default: all files'),
  }),
  execute: async ({ pattern, fileGlob }, options) => {
    const files = (options as any)?.files as Record<string, { content: string }> | undefined;

    if (!files) {
      return { error: 'No project files available.' };
    }

    const results: Array<{
      file: string;
      line: number;
      text: string;
    }> = [];

    let regex: RegExp;

    try {
      regex = new RegExp(pattern, 'i');
    } catch {
      // If pattern is invalid regex, escape it
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      regex = new RegExp(escaped, 'i');
    }

    const globFilter = fileGlob
      ? new RegExp(fileGlob.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.'))
      : null;

    for (const [path, file] of Object.entries(files)) {
      if (globFilter && !globFilter.test(path)) {
        continue;
      }

      const lines = file.content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          results.push({
            file: path,
            line: i + 1,
            text: lines[i].trim().substring(0, 200),
          });

          if (results.length >= 50) {
            break;
          } // cap results
        }
      }

      if (results.length >= 50) {
        break;
      }
    }

    return {
      pattern,
      totalMatches: results.length,
      results: results.slice(0, 50),
      truncated: results.length >= 50,
    };
  },
});

/**
 * Phase 2 tools — only enabled when a sandbox is available.
 *
 * These tools let the LLM:
 * - Run shell commands (verify builds, install deps, curl endpoints)
 * - Take screenshots (visual verification)
 * - Read sandbox files (post-build verification)
 * - Grep across files (fast code search)
 */
export const phase2Tools = {
  run_shell: runShellTool,
  screenshot: screenshotTool,
  read_sandbox_file: readSandboxFileTool,
  grep: grepTool,
} as const;
