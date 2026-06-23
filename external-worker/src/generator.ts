/**
 * Generator — Phase 2 actual LLM generation
 *
 * The simplest possible end-to-end flow:
 *   1. planProject(prompt) → spec (what to build, which files)
 *   2. generateStaticFiles(prompt, spec) → { files: [{path, content}], complete: boolean }
 *
 * Output is file-operations JSON (NOT raw HTML). The worker validates it
 * with output-validator logic, uploads to R2, and records the manifest.
 *
 * Uses OpenRouter directly via fetch (no SDK dependency) for portability.
 */

import { logger } from './logger';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY!;

if (!OPENROUTER_KEY) {
  logger.error('OPENROUTER_API_KEY env var missing — generation will fail.');
}

export interface FileOperation {
  op: 'write_file';
  path: string;
  content: string;
  mime_type?: string;
}

export interface GenerationResult {
  files: FileOperation[];
  complete: boolean;
  rawText: string;
}

export interface ProjectSpec {
  appType: 'static' | 'react' | 'python';
  description: string;
  files: Array<{ path: string; purpose: string }>;
  designNotes: string;
}

/**
 * Phase 1: Plan the project from the user prompt.
 *
 * For the narrow Phase 2 scope, we only handle STATIC projects (HTML/CSS/JS).
 * If the prompt asks for React/Vite/Next.js, we still produce a static version
 * for now (Phase 3 will add framework support).
 */
export function planProject(prompt: string): ProjectSpec {
  const lower = prompt.toLowerCase();
  const isStatic =
    /html|css|js|javascript|vanilla|static|landing page|no framework|simple/i.test(lower) ||
    !/react|vue|vite|next|svelte|angular|express|flask|python/i.test(lower);

  return {
    appType: isStatic ? 'static' : 'static', // Phase 2: force static for now
    description: prompt.slice(0, 200),
    files: [
      { path: 'index.html', purpose: 'Main HTML structure with semantic tags' },
      { path: 'styles.css', purpose: 'Complete CSS styling for all elements' },
      { path: 'app.js', purpose: 'JavaScript for interactivity and animations' },
    ],
    designNotes: 'Beautiful, responsive, mobile-first design with modern aesthetics.',
  };
}

/**
 * Build the system prompt for static generation.
 *
 * This is a COMPACT version of app/lib/common/prompts/prompts.ts, focused
 * on the file-operations JSON format (not the <palmkitArtifact> XML format).
 * The worker doesn't stream to a browser, so we use a simpler JSON contract.
 */
function buildSystemPrompt(spec: ProjectSpec): string {
  return `You are Palmkit's build worker. Generate a COMPLETE static web project.

OUTPUT FORMAT (STRICT JSON):
Return a single JSON object with this exact shape:
{
  "files": [
    { "op": "write_file", "path": "index.html", "content": "...full HTML...", "mime_type": "text/html" },
    { "op": "write_file", "path": "styles.css", "content": "...full CSS...", "mime_type": "text/css" },
    { "op": "write_file", "path": "app.js", "content": "...full JS...", "mime_type": "text/javascript" }
  ],
  "complete": true
}

RULES:
1. Generate ALL THREE files: index.html, styles.css, app.js — no exceptions.
2. index.html MUST link to styles.css and app.js:
   <link rel="stylesheet" href="styles.css">
   <script src="app.js"></script>
3. Write COMPLETE file content — no placeholders, no TODO, no "...".
4. Every CSS file must fully style ALL elements in the HTML.
5. Every JS file must have complete, working logic.
6. The JSON must be valid and parseable — escape quotes and newlines properly.
7. Set "complete": true only when all 3 files are fully written.
8. Do NOT wrap the JSON in markdown code fences. Return raw JSON only.

PROJECT SPEC:
- Description: ${spec.description}
- Files: ${spec.files.map((f) => `${f.path} (${f.purpose})`).join(', ')}
- Design: ${spec.designNotes}

QUALITY:
- Mobile-first responsive (test at 390px width).
- Modern design: CSS variables, gradients, shadows, smooth transitions.
- Semantic HTML5, accessible.
- Production quality, not a tutorial example.

Return ONLY the JSON object. No prose before or after.`;
}

/**
 * Phase 2: Generate all static files in ONE LLM call.
 *
 * Uses OpenRouter's chat completions API (non-streaming for the worker —
 * we don't need to stream to a browser, and non-streaming is more reliable
 * for getting complete JSON).
 *
 * Model: deepseek/deepseek-chat-v3.1 (same as the live site uses).
 */
export async function generateStaticFiles(
  prompt: string,
  spec: ProjectSpec,
  model = 'deepseek/deepseek-chat-v3.1',
): Promise<GenerationResult> {
  logger.info(`Generating static files with ${model} for: "${prompt.slice(0, 60)}..."`);

  const systemPrompt = buildSystemPrompt(spec);

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://palmkit.app',
      'X-Title': 'Palmkit Build Worker',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      // Large enough for 3 complete files, small enough to stay fast.
      max_tokens: 16000,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data: any = await response.json();
  const rawText: string = data.choices?.[0]?.message?.content ?? '';

  if (!rawText) {
    throw new Error('OpenRouter returned empty content');
  }

  logger.info(`Received ${rawText.length} chars from LLM`);

  // Parse the JSON response.
  let parsed: { files?: FileOperation[]; complete?: boolean };

  try {
    parsed = JSON.parse(rawText);
  } catch (parseError: any) {
    // Try to extract JSON from a fenced code block (in case the LLM ignored instructions).
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error(`LLM did not return valid JSON: ${parseError.message}. First 200 chars: ${rawText.slice(0, 200)}`);
    }

    parsed = JSON.parse(jsonMatch[0]);
  }

  const files = Array.isArray(parsed.files) ? parsed.files : [];
  const complete = Boolean(parsed.complete);

  // Validate: must have at least index.html.
  if (files.length === 0) {
    throw new Error('LLM returned no files in the JSON response');
  }

  // Validate each file has content.
  for (const f of files) {
    if (!f.path || typeof f.content !== 'string') {
      throw new Error(`Invalid file operation: missing path or content`);
    }

    if (f.content.trim().length === 0) {
      throw new Error(`File ${f.path} has empty content`);
    }

    // Auto-fill mime_type if missing.
    if (!f.mime_type) {
      f.mime_type = inferMimeType(f.path);
    }
  }

  logger.info(`Generation complete: ${files.length} files, complete=${complete}`);

  return { files, complete, rawText };
}

function inferMimeType(path: string): string {
  if (path.endsWith('.html')) return 'text/html';
  if (path.endsWith('.css')) return 'text/css';
  if (path.endsWith('.js')) return 'text/javascript';
  if (path.endsWith('.json')) return 'application/json';
  if (path.endsWith('.svg')) return 'image/svg+xml';
  return 'text/plain';
}

/**
 * Validate the generation result.
 * Returns an array of issues (empty = valid).
 */
export function validateGeneration(result: GenerationResult): string[] {
  const issues: string[] = [];

  if (!result.complete) {
    issues.push('Generation did not set complete=true');
  }

  if (result.files.length < 3) {
    issues.push(`Expected 3 files (index.html, styles.css, app.js), got ${result.files.length}`);
  }

  const paths = result.files.map((f) => f.path);

  if (!paths.includes('index.html')) {
    issues.push('Missing index.html');
  }

  if (!paths.includes('styles.css')) {
    issues.push('Missing styles.css');
  }

  if (!paths.includes('app.js')) {
    issues.push('Missing app.js');
  }

  // Check index.html links to styles.css and app.js.
  const html = result.files.find((f) => f.path === 'index.html')?.content ?? '';

  if (html && !html.includes('styles.css')) {
    issues.push('index.html does not link to styles.css');
  }

  if (html && !html.includes('app.js')) {
    issues.push('index.html does not reference app.js');
  }

  // Check for placeholders.
  for (const f of result.files) {
    if (/\/\/\s*TODO|\/\/\s*FIXME|<!--\s*add.*here\s*-->|<!--\s*COMPLETE/i.test(f.content)) {
      issues.push(`File ${f.path} contains placeholder content`);
    }

    if (f.content.trim().length < 20) {
      issues.push(`File ${f.path} is suspiciously short (${f.content.length} chars)`);
    }
  }

  return issues;
}
