/**
 * ThoughtProcessPanel — Collapsible "Thought Process" panel showing the
 * LLM's reasoning text in real-time (like chat.z.ai / Claude Code).
 *
 * Renders a collapsible gray block with:
 *   - Header: brain icon + "Thought Process" + chevron + count badge
 *   - Body: chronological list of reasoning snippets, each labeled with
 *     the agent that emitted it (Builder / Tester / Researcher)
 *
 * The text is rendered in a muted gray color (#6C757D-ish) per the design
 * spec — distinct from regular chat text — to signal it's the model's
 * internal narration, not user-facing output.
 *
 * Data source: reasoningStore (populated from `reasoning` job events by
 * the dispatchJobEvent helper in use-external-worker.ts).
 */

import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { reasoningStore, type ReasoningEntry } from '~/lib/stores/build-status';
import { classNames } from '~/utils/classNames';

const AGENT_COLOR: Record<string, string> = {
  Builder: 'text-blue-400',
  Tester: 'text-purple-400',
  Researcher: 'text-amber-400',
  Orchestrator: 'text-green-400',
  Worker: 'text-palmkit-elements-textTertiary',
};

export function ThoughtProcessPanel() {
  const entries = useStore(reasoningStore);
  const [isOpen, setIsOpen] = useState(true);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries arrive and panel is open
  useEffect(() => {
    if (isOpen && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [entries.length, isOpen]);

  if (entries.length === 0) {
    return null;
  }

  const latestAgent = entries[entries.length - 1]?.agent ?? 'Worker';

  return (
    <div className="mx-4 mb-3 rounded-lg border border-palmkit-elements-borderColor bg-palmkit-elements-bg-depth-1 overflow-hidden text-sm">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-palmkit-elements-background-depth-1 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div
            className={classNames(
              'i-ph:brain text-[14px]',
              isOpen ? 'text-palmkit-elements-textSecondary' : 'text-palmkit-elements-textTertiary',
            )}
          />
          <span className="text-xs font-medium uppercase tracking-wide text-palmkit-elements-textSecondary">
            Thought Process
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-palmkit-elements-background-depth-2 text-palmkit-elements-textSecondary font-mono">
            {entries.length}
          </span>
          {/* Latest agent tag */}
          <span
            className={classNames(
              'text-[10px] px-1.5 py-0.5 rounded-full bg-palmkit-elements-background-depth-2 font-mono',
              AGENT_COLOR[latestAgent] ?? AGENT_COLOR.Worker,
            )}
          >
            {latestAgent}
          </span>
        </div>
        <div
          className={classNames(
            'i-ph:caret-down text-[12px] text-palmkit-elements-textTertiary transition-transform',
            isOpen ? 'rotate-180' : '',
          )}
        />
      </button>

      {/* Body — chronological reasoning entries */}
      {isOpen && (
        <div
          ref={bodyRef}
          className="px-3 py-2 border-t border-palmkit-elements-borderColor max-h-64 overflow-y-auto space-y-2"
        >
          {entries.map((entry, i) => (
            <ThoughtEntry key={entry.seq} entry={entry} isLast={i === entries.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function ThoughtEntry({ entry, isLast }: { entry: ReasoningEntry; isLast: boolean }) {
  const agentColor = AGENT_COLOR[entry.agent] ?? AGENT_COLOR.Worker;
  const isStreaming = isLast && entry.isFinal === false;

  return (
    <div className="flex gap-2 items-start">
      {/* Agent label badge — narrow column */}
      <span
        className={classNames(
          'shrink-0 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-palmkit-elements-background-depth-2 mt-0.5',
          agentColor,
        )}
      >
        {entry.agent.slice(0, 3)}
      </span>

      {/* Reasoning text — gray, italic-ish, monospace-flavored */}
      <div className="flex-1 min-w-0">
        <p
          className={classNames(
            'text-xs leading-relaxed text-palmkit-elements-textTertiary whitespace-pre-wrap break-words',
          )}
        >
          {entry.text}
          {isStreaming && (
            <span className="inline-block w-1.5 h-3 ml-0.5 bg-palmkit-elements-textTertiary animate-pulse align-middle" />
          )}
        </p>
      </div>
    </div>
  );
}
