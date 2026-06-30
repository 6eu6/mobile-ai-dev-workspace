/**
 * TodosPanel — Live agent task list (like chat.z.ai / Cursor todos).
 *
 * Renders a collapsible checklist of the agent's current todos. Each agent
 * (Builder, Tester, Researcher) gets its own panel. The agent publishes
 * updates via the `update_todos` tool — the full list each time — so we
 * just render the latest snapshot from agentTodosStore.
 *
 * Visual design (matches the screenshot the user provided):
 *   - Header row: checkbox icon + "Todos" + count badge (e.g. "9")
 *   - One row per todo with a status icon:
 *       ✓ green checkmark     = done
 *       ◐ blue spinner        = in_progress
 *       ○ empty circle        = pending
 *   - Collapsible (click header to toggle)
 *   - Hidden entirely if no agent has published todos yet
 */

import React, { useState } from 'react';
import { useStore } from '@nanostores/react';
import { agentTodosStore, type AgentTodoSnapshot } from '~/lib/stores/build-status';
import { classNames } from '~/utils/classNames';

interface TodosPanelProps {
  /** Which agent's todos to show. Defaults to 'Builder'. */
  agent?: string;
  /** Whether the panel starts expanded. Defaults to true. */
  defaultOpen?: boolean;
}

const STATUS_ICON: Record<AgentTodoSnapshot['todos'][number]['status'], string> = {
  done: 'i-ph:check-circle-fill text-green-500',
  in_progress: 'i-svg-spinners:90-ring-with-bg text-blue-500 animate-spin',
  pending: 'i-ph:circle text-palmkit-elements-textTertiary opacity-50',
};

const STATUS_TEXT: Record<AgentTodoSnapshot['todos'][number]['status'], string> = {
  done: 'text-palmkit-elements-textSecondary line-through opacity-60',
  in_progress: 'text-palmkit-elements-textPrimary font-medium',
  pending: 'text-palmkit-elements-textSecondary',
};

export function TodosPanel({ agent = 'Builder', defaultOpen = true }: TodosPanelProps) {
  const snapshots = useStore(agentTodosStore);
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const snapshot = snapshots[agent];

  // Don't render if this agent hasn't published todos yet
  if (!snapshot || snapshot.todos.length === 0) {
    return null;
  }

  const { todos, counts } = snapshot;
  const allDone = counts.done === counts.total;

  return (
    <div className="mx-4 mb-3 rounded-lg border border-palmkit-elements-borderColor bg-palmkit-elements-bg-depth-2 overflow-hidden text-sm">
      {/* Header row — clickable to toggle */}
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-palmkit-elements-background-depth-1 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div
            className={classNames(
              'text-[14px]',
              allDone ? 'i-ph:checks-fill text-green-500' : 'i-ph:list-checks text-palmkit-elements-textSecondary',
            )}
          />
          <span className="text-xs font-medium uppercase tracking-wide text-palmkit-elements-textSecondary">
            Todos
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-palmkit-elements-background-depth-1 text-palmkit-elements-textSecondary font-mono">
            {counts.total}
          </span>
          <span className="text-[10px] text-palmkit-elements-textTertiary font-mono">
            ({counts.done}/{counts.total})
          </span>
        </div>
        <div
          className={classNames(
            'i-ph:caret-down text-[12px] text-palmkit-elements-textTertiary transition-transform',
            isOpen ? 'rotate-180' : '',
          )}
        />
      </button>

      {/* Todo list */}
      {isOpen && (
        <ul className="px-3 pb-3 pt-1 space-y-1.5 border-t border-palmkit-elements-borderColor">
          {todos.map((todo, i) => (
            <li key={`${i}-${todo.text.slice(0, 30)}`} className="flex items-start gap-2.5">
              <div
                className={classNames(
                  'shrink-0 text-[14px] mt-0.5',
                  STATUS_ICON[todo.status],
                )}
              />
              <span className={classNames('text-xs leading-relaxed break-words', STATUS_TEXT[todo.status])}>
                {todo.text}
              </span>
            </li>
          ))}

          {/* Footer status line */}
          <li className="pt-2 mt-1 border-t border-palmkit-elements-borderColor/50 flex items-center gap-2 text-[10px] text-palmkit-elements-textTertiary">
            {allDone ? (
              <>
                <div className="i-ph:check-circle-fill text-green-500 text-[12px]" />
                <span>All tasks completed</span>
              </>
            ) : counts.inProgress > 0 ? (
              <>
                <div className="i-ph:spinner text-blue-500 text-[12px] animate-spin" />
                <span>Working on {counts.inProgress} task{counts.inProgress !== 1 ? 's' : ''}...</span>
              </>
            ) : (
              <>
                <div className="i-ph:circle text-palmkit-elements-textTertiary text-[12px]" />
                <span>{counts.pending} pending</span>
              </>
            )}
          </li>
        </ul>
      )}
    </div>
  );
}

/**
 * MultiAgentTodos — renders TodosPanel for every agent that has published
 * todos. Useful when both Builder and Tester are running and the user wants
 * to see both task lists.
 */
export function MultiAgentTodos() {
  const snapshots = useStore(agentTodosStore);
  const agents = Object.keys(snapshots).filter((a) => snapshots[a].todos.length > 0);

  if (agents.length === 0) {
    return null;
  }

  return (
    <>
      {agents.map((agent) => (
        <TodosPanel key={agent} agent={agent} />
      ))}
    </>
  );
}
