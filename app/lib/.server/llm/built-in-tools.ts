/**
 * Built-in Tools — Phase 1.2 of Agentic Roadmap
 *
 * These tools let the LLM interact with the project DURING generation:
 * - read_file: read a file from the current project (R2 or workbench)
 * - list_files: list all files in the project
 * - web_search: search the web for docs/examples
 * - read_url: fetch and extract content from a URL
 *
 * Why these tools matter:
 *   Without them, the LLM generates files "blind" — it can't verify its own
 *   output or check if a file it wrote actually exists. With these tools,
 *   the LLM can:
 *     1. Generate a file
 *     2. Read it back to verify
 *     3. Read other files for context
 *     4. Search the web for API docs
 *
 * This turns Palmkit from "generate-and-pray" into "generate-verify-fix".
 *
 * NOTE: `run_shell` is NOT here because it requires sandbox access which
 * varies by environment (WebContainer on desktop, E2B on mobile). That tool
 * is added separately in the sandbox bridge.
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
