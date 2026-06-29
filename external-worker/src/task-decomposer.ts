/**
 * Task Decomposer — Phase 3 of Agentic Roadmap
 *
 * Takes a complex user prompt and breaks it into sequential tasks.
 * Each task produces ONE file or ONE component, small enough to generate
 * without stream cutoff.
 *
 * Example:
 *   Input: "Build a cinematic space-travel landing page with React, Tailwind,
 *           Framer Motion, liquid-glass CSS, FadingVideo component..."
 *
 *   Output:
 *   {
 *     "tasks": [
 *       { "id": 1, "name": "HTML shell + CDN scripts", "file": "index.html", "description": "..." },
 *       { "id": 2, "name": "Liquid-glass CSS", "file": "index.html", "description": "..." },
 *       { "id": 3, "name": "FadingVideo component", "file": "index.html", "description": "..." },
 *       ...
 *     ]
 *   }
 *
 * This prevents the "stream cutoff on complex prompts" bug by ensuring each
 * LLM call is small (~1000-2000 chars output) instead of one massive call.
 */

import { generateText } from 'ai';
import { getModelInstance } from './provider-registry';
import { logger } from './logger';

export interface Task {
  id: number;
  name: string;
  file: string;
  description: string;
}

export interface DecompositionPlan {
  tasks: Task[];
  reasoning: string;
}

/**
 * Decompose a complex prompt into sequential tasks.
 *
 * Uses a LIGHTWEIGHT LLM call (generateText, not streamText) to plan.
 * The plan itself is small (~500 tokens) so it won't be cut off.
 */
export async function decomposeTask(
  prompt: string,
  providerName: string,
  modelName: string,
  apiKey: string,
): Promise<DecompositionPlan> {
  logger.info(`[orchestrator] Decomposing task (${prompt.length} chars)`);

  const systemPrompt = `You are a project planner for an AI app builder. Your job is to break a complex build request into 3-8 sequential tasks.

RULES:
1. Each task should produce code that fits in 1000-3000 chars (small enough to generate reliably)
2. Order tasks by dependency: foundation first, then components, then assembly
3. For single-file apps (HTML/CSS/JS), each task adds a SECTION to the same file
4. For multi-file apps, each task creates or updates ONE file
5. Keep descriptions specific — mention what components, CSS classes, or functions to create

OUTPUT FORMAT (strict JSON, no markdown):
{
  "reasoning": "1-2 sentences explaining the plan",
  "tasks": [
    {
      "id": 1,
      "name": "Short task name",
      "file": "index.html",
      "description": "Detailed description of what to generate in this task"
    }
  ]
}

EXAMPLE for "Build a counter app":
{
  "reasoning": "Single HTML file with CDN scripts, styles, and counter logic",
  "tasks": [
    {"id":1,"name":"HTML shell + CDN","file":"index.html","description":"Create index.html with Tailwind CDN, React 18 CDN, Babel standalone. Include #root div and script type=text/babel placeholder."},
    {"id":2,"name":"Counter component","file":"index.html","description":"Add Counter component with increment/decrement/reset buttons using React useState. Styled with Tailwind."},
    {"id":3,"name":"App + mount","file":"index.html","description":"Add App component that renders Counter, then ReactDOM.render to mount on #root."}
  ]
}`;

  const model = getModelInstance(providerName, modelName, apiKey);

  const result = await generateText({
    model,
    system: systemPrompt,
    prompt: `Break this request into tasks:\n\n${prompt}`,
    maxTokens: 2000,
    temperature: 0.3,
  });

  const text = result.text ?? '';

  // Parse JSON (handle markdown fences if present)
  let plan: DecompositionPlan;

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    plan = JSON.parse(jsonMatch?.[0] ?? text);
  } catch {
    logger.warn(`[orchestrator] Failed to parse decomposition plan, falling back to single task`);
    return {
      reasoning: 'Failed to decompose, treating as single task',
      tasks: [
        {
          id: 1,
          name: 'Build project',
          file: 'index.html',
          description: prompt,
        },
      ],
    };
  }

  // Validate
  if (!plan.tasks || !Array.isArray(plan.tasks) || plan.tasks.length === 0) {
    return {
      reasoning: 'Invalid plan, treating as single task',
      tasks: [{ id: 1, name: 'Build project', file: 'index.html', description: prompt }],
    };
  }

  logger.info(`[orchestrator] Plan: ${plan.tasks.length} tasks — ${plan.tasks.map((t) => t.name).join(' → ')}`);

  return plan;
}

/**
 * Check if a prompt is complex enough to warrant decomposition.
 *
 * Simple prompts (e.g. "counter app") go through the normal single-shot path.
 * Complex prompts (e.g. detailed multi-component specs) get decomposed.
 */
export function shouldDecompose(prompt: string): boolean {
  // Heuristics for complexity:
  // 1. Long prompt (>500 chars usually means detailed spec)
  // 2. Mentions multiple components/features
  // 3. Mentions specific technical requirements (animations, custom logic)

  if (prompt.length < 500) return false;

  const lower = prompt.toLowerCase();

  // Multiple component indicators
  const componentKeywords = [
    'component',
    'section',
    'navbar',
    'footer',
    'hero',
    'card',
    'modal',
    'sidebar',
    'dashboard',
    'table',
    'form',
    'carousel',
    'video',
    'animation',
    'framer motion',
    'tailwind',
    'css',
    'custom',
    'liquid',
    'glass',
  ];

  const matches = componentKeywords.filter((k) => lower.includes(k)).length;

  return matches >= 3; // 3+ complexity keywords = decompose
}
