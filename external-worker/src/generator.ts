/**
 * Generator — Phase 2 LLM generation using Vercel AI SDK
 *
 * Supports three app types classified from the user prompt:
 *   static  → HTML + CSS + JS (iframe preview, no sandbox)
 *   react   → React + Vite (WebContainer / E2B preview)
 *   python  → Python (E2B preview)
 *
 * Each type uses a different file plan and system prompt so the LLM
 * generates the correct structure without guessing.
 */

import { generateText } from 'ai';
import { getModelInstance } from './provider-registry';
import { logger } from './logger';

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
  appType: ProjectSpec['appType'];
}

export interface ProjectSpec {
  appType: 'static' | 'react' | 'python';
  description: string;
  files: Array<{ path: string; purpose: string }>;
  designNotes: string;
}

/**
 * Classify the prompt and build a file plan.
 * Previously had a bug where both branches returned 'static'.
 */
export function planProject(prompt: string): ProjectSpec {
  const lower = prompt.toLowerCase();

  const isPython = /python|flask|fastapi|django|pip\s/i.test(lower);
  const isReact = /react|vite|next\.?js|tsx|jsx|shadcn|tailwind.*component|hooks?|useState|useEffect/i.test(lower);
  const isExplicitlyStatic =
    /html|css|vanilla|static|landing page|no framework|no react|without react/i.test(lower);

  let appType: ProjectSpec['appType'];

  if (isPython && !isReact) {
    appType = 'python';
  } else if (isReact && !isExplicitlyStatic) {
    appType = 'react';
  } else {
    appType = 'static';
  }

  const filePlans: Record<ProjectSpec['appType'], Array<{ path: string; purpose: string }>> = {
    static: [
      { path: 'index.html', purpose: 'Main HTML structure with semantic tags and all sections' },
      { path: 'styles.css', purpose: 'Complete CSS for all elements, responsive mobile-first' },
      { path: 'app.js', purpose: 'JavaScript for all interactivity, animations, and logic' },
    ],
    react: [
      { path: 'package.json', purpose: 'Vite + React dependencies' },
      { path: 'index.html', purpose: 'Vite entry HTML' },
      { path: 'vite.config.js', purpose: 'Vite configuration' },
      { path: 'src/main.jsx', purpose: 'React entry point' },
      { path: 'src/App.jsx', purpose: 'Root App component' },
      { path: 'src/index.css', purpose: 'Global styles' },
    ],
    python: [
      { path: 'app.py', purpose: 'Flask/FastAPI application with all routes' },
      { path: 'requirements.txt', purpose: 'Python dependencies' },
      { path: 'templates/index.html', purpose: 'Jinja2 template (if Flask)' },
    ],
  };

  return {
    appType,
    description: prompt.slice(0, 300),
    files: filePlans[appType],
    designNotes: 'Beautiful, responsive, mobile-first design. Modern aesthetics, production quality.',
  };
}

function buildSystemPrompt(spec: ProjectSpec): string {
  if (spec.appType === 'static') {
    return `You are Palmkit's build worker. Generate a COMPLETE static web project.

OUTPUT FORMAT (STRICT JSON):
{
  "files": [
    { "op": "write_file", "path": "index.html", "content": "...full HTML...", "mime_type": "text/html" },
    { "op": "write_file", "path": "styles.css", "content": "...full CSS...", "mime_type": "text/css" },
    { "op": "write_file", "path": "app.js", "content": "...full JS...", "mime_type": "text/javascript" }
  ],
  "complete": true
}

RULES:
1. Generate ALL THREE files. No exceptions.
2. index.html MUST have: <link rel="stylesheet" href="styles.css"> and <script src="app.js"></script>
3. Write COMPLETE content — no placeholders, no TODO, no "...".
4. Valid JSON — escape quotes and newlines properly.
5. "complete": true only when all files are fully written.
6. Return raw JSON only. No markdown fences.

PROJECT: ${spec.description}
DESIGN: ${spec.designNotes}

Mobile-first (390px), CSS variables, gradients, smooth transitions, semantic HTML5, accessible.
Return ONLY the JSON object.`;
  }

  if (spec.appType === 'react') {
    return `You are Palmkit's build worker. Generate a COMPLETE React + Vite project.

OUTPUT FORMAT (STRICT JSON):
{
  "files": [
    { "op": "write_file", "path": "package.json", "content": "...", "mime_type": "application/json" },
    { "op": "write_file", "path": "index.html", "content": "...", "mime_type": "text/html" },
    { "op": "write_file", "path": "vite.config.js", "content": "...", "mime_type": "text/javascript" },
    { "op": "write_file", "path": "src/main.jsx", "content": "...", "mime_type": "text/javascript" },
    { "op": "write_file", "path": "src/App.jsx", "content": "...", "mime_type": "text/javascript" },
    { "op": "write_file", "path": "src/index.css", "content": "...", "mime_type": "text/css" }
  ],
  "complete": true
}

RULES:
1. package.json must use Vite + React. devDependencies: vite, @vitejs/plugin-react. dependencies: react, react-dom.
2. vite.config.js: import { defineConfig } from 'vite'; import react from '@vitejs/plugin-react';
3. src/main.jsx: import React, ReactDOM. Mount to #root.
4. Write COMPLETE content — no placeholders, no TODO.
5. Return raw JSON only. No markdown fences.

PROJECT: ${spec.description}
DESIGN: ${spec.designNotes}

Mobile-first, modern design, component-based architecture.
Return ONLY the JSON object.`;
  }

  // python
  return `You are Palmkit's build worker. Generate a COMPLETE Python Flask application.

OUTPUT FORMAT (STRICT JSON):
{
  "files": [
    { "op": "write_file", "path": "app.py", "content": "...", "mime_type": "text/x-python" },
    { "op": "write_file", "path": "requirements.txt", "content": "...", "mime_type": "text/plain" }
  ],
  "complete": true
}

RULES:
1. app.py: Complete Flask application with all routes, templates, logic.
2. requirements.txt: All dependencies, one per line.
3. Write COMPLETE content — no placeholders, no TODO.
4. Return raw JSON only. No markdown fences.

PROJECT: ${spec.description}
Return ONLY the JSON object.`;
}

/**
 * Generate project files using the LLM.
 */
export async function generateStaticFiles(
  prompt: string,
  spec: ProjectSpec,
  providerName: string,
  modelName: string,
  apiKey: string,
): Promise<GenerationResult> {
  logger.info(`Generating ${spec.appType} with provider=${providerName}, model=${modelName}`);

  const systemPrompt = buildSystemPrompt(spec);
  const model = getModelInstance(providerName, modelName, apiKey);

  const result = await generateText({
    model,
    system: systemPrompt,
    prompt,
    maxTokens: 16000,
    temperature: 0.7,
  });

  const rawText: string = result.text ?? '';

  if (!rawText) {
    throw new Error(`${providerName} returned empty content (finishReason: ${result.finishReason})`);
  }

  logger.info(`Received ${rawText.length} chars from ${providerName} (usage: ${JSON.stringify(result.usage)})`);

  let parsed: { files?: FileOperation[]; complete?: boolean };

  try {
    parsed = JSON.parse(rawText);
  } catch (parseError: any) {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error(
        `LLM did not return valid JSON: ${parseError.message}. First 200 chars: ${rawText.slice(0, 200)}`,
      );
    }

    parsed = JSON.parse(jsonMatch[0]);
  }

  const files = Array.isArray(parsed.files) ? parsed.files : [];
  const complete = Boolean(parsed.complete);

  if (files.length === 0) {
    throw new Error('LLM returned no files in the JSON response');
  }

  for (const f of files) {
    if (!f.path || typeof f.content !== 'string') {
      throw new Error('Invalid file operation: missing path or content');
    }

    if (f.content.trim().length === 0) {
      throw new Error(`File ${f.path} has empty content`);
    }

    if (!f.mime_type) {
      f.mime_type = inferMimeType(f.path);
    }
  }

  logger.info(`Generation complete: ${files.length} files, appType=${spec.appType}, complete=${complete}`);

  return { files, complete, rawText, appType: spec.appType };
}

function inferMimeType(path: string): string {
  if (path.endsWith('.html')) return 'text/html';
  if (path.endsWith('.css')) return 'text/css';
  if (path.endsWith('.js') || path.endsWith('.jsx')) return 'text/javascript';
  if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'text/typescript';
  if (path.endsWith('.json')) return 'application/json';
  if (path.endsWith('.svg')) return 'image/svg+xml';
  if (path.endsWith('.py')) return 'text/x-python';
  if (path.endsWith('.txt')) return 'text/plain';
  return 'text/plain';
}

/**
 * Validate the generation result based on the app type.
 */
export function validateGeneration(result: GenerationResult): string[] {
  const issues: string[] = [];

  if (!result.complete) {
    issues.push('Generation did not set complete=true');
  }

  const paths = result.files.map((f) => f.path);

  if (result.appType === 'static') {
    if (!paths.includes('index.html')) issues.push('Missing index.html');
    if (!paths.includes('styles.css')) issues.push('Missing styles.css');
    if (!paths.includes('app.js')) issues.push('Missing app.js');

    const html = result.files.find((f) => f.path === 'index.html')?.content ?? '';
    if (html && !html.includes('styles.css')) issues.push('index.html does not link to styles.css');
    if (html && !html.includes('app.js')) issues.push('index.html does not reference app.js');
  } else if (result.appType === 'react') {
    if (!paths.includes('package.json')) issues.push('Missing package.json');
    if (!paths.some((p) => p.endsWith('App.jsx') || p.endsWith('App.tsx'))) {
      issues.push('Missing App component');
    }
    if (!paths.some((p) => p.endsWith('main.jsx') || p.endsWith('main.tsx'))) {
      issues.push('Missing main entry point');
    }
  } else if (result.appType === 'python') {
    if (!paths.some((p) => p.endsWith('.py'))) issues.push('Missing Python file');
    if (!paths.includes('requirements.txt')) issues.push('Missing requirements.txt');
  }

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
