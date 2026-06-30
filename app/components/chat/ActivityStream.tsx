/**
 * ActivityStream — Grouped activity log per agent (like the activity stream
 * in chat.z.ai / Claude Code).
 *
 * Each agent (Builder, Tester, Researcher) gets a collapsible "activity
 * group" with:
 *   - Summary header: "Wrote 5 files, Ran 3 commands" with chevron
 *   - Status indicator: green ✓ Done, blue spinner Running, red ✗ Failed
 *   - Expandable list of inner events (file writes, shell commands, etc.)
 *
 * Data source: activityGroupsStore (populated from `agent_started`,
 * `agent_completed`, `file_written`, and `file_chunk` events by the
 * dispatchJobEvent helper in use-external-worker.ts).
 */

import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { activityGroupsStore, type ActivityGroup, type ActivityEvent } from '~/lib/stores/build-status';
import { classNames } from '~/utils/classNames';

const AGENT_COLOR: Record<string, string> = {
  Builder: 'text-blue-400',
  Tester: 'text-purple-400',
  Researcher: 'text-amber-400',
  Orchestrator: 'text-green-400',
  Worker: 'text-palmkit-elements-textSecondary',
};

const AGENT_ICON: Record<string, string> = {
  Builder: 'i-ph:hammer',
  Tester: 'i-ph:test-tube',
  Researcher: 'i-ph:magnifying-glass',
  Orchestrator: 'i-ph:cpu',
  Worker: 'i-ph:gear',
};

export function ActivityStream() {
  const groups = useStore(activityGroupsStore);

  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="mx-4 mb-3 space-y-2">
      {groups.map((group, idx) => (
        <ActivityGroupCard key={`${group.agent}-${idx}`} group={group} />
      ))}
    </div>
  );
}

function ActivityGroupCard({ group }: { group: ActivityGroup }) {
  const [isOpen, setIsOpen] = useState(true);
  const summary = computeSummary(group);
  const isRunning = !group.endedAt;
  const isFailed = group.endedAt && group.success === false;

  const statusIcon = isFailed
    ? 'i-ph:x-circle-fill text-red-400'
    : isRunning
      ? 'i-svg-spinners:90-ring-with-bg text-blue-500 animate-spin'
      : 'i-ph:check-circle-fill text-green-500';

  const statusText = isFailed ? 'Failed' : isRunning ? 'Running' : 'Done';

  return (
    <div className="rounded-lg border border-palmkit-elements-borderColor bg-palmkit-elements-bg-depth-2 overflow-hidden text-sm">
      {/* Summary header — clickable to toggle */}
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-palmkit-elements-background-depth-1 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div
            className={classNames(
              'shrink-0 text-[14px]',
              AGENT_ICON[group.agent] ?? AGENT_ICON.Worker,
              AGENT_COLOR[group.agent] ?? AGENT_COLOR.Worker,
            )}
          />
          <span
            className={classNames(
              'text-xs font-medium',
              AGENT_COLOR[group.agent] ?? AGENT_COLOR.Worker,
            )}
          >
            {group.agent}
          </span>
          <span className="text-xs text-palmkit-elements-textSecondary truncate">
            {summary}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Duration badge */}
          {group.durationMs !== undefined && (
            <span className="text-[10px] font-mono text-palmkit-elements-textTertiary">
              {(group.durationMs / 1000).toFixed(1)}s
            </span>
          )}
          {/* Status pill */}
          <span
            className={classNames(
              'text-[10px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1',
              isFailed
                ? 'bg-red-500/10 text-red-400'
                : isRunning
                  ? 'bg-blue-500/10 text-blue-400'
                  : 'bg-green-500/10 text-green-400',
            )}
          >
            <div className={classNames('text-[10px]', statusIcon)} />
            {statusText}
          </span>
          {/* Expand chevron */}
          <div
            className={classNames(
              'i-ph:caret-down text-[12px] text-palmkit-elements-textTertiary transition-transform',
              isOpen ? 'rotate-180' : '',
            )}
          />
        </div>
      </button>

      {/* Expanded event list */}
      {isOpen && group.events.length > 0 && (
        <ul className="px-3 pb-3 pt-1 border-t border-palmkit-elements-borderColor space-y-1 max-h-80 overflow-y-auto">
          {group.events.map((event) => (
            <ActivityEventRow key={event.seq} event={event} />
          ))}
        </ul>
      )}

      {/* Empty state — agent started but no events yet */}
      {isOpen && group.events.length === 0 && (
        <div className="px-3 py-2 border-t border-palmkit-elements-borderColor text-xs text-palmkit-elements-textTertiary italic">
          {group.agent} is starting up…
        </div>
      )}
    </div>
  );
}

function ActivityEventRow({ event }: { event: ActivityEvent }) {
  const icon = eventIcon(event);
  const text = eventText(event);

  return (
    <li className="flex items-start gap-2 py-0.5">
      <div className={classNames('shrink-0 text-[12px] mt-0.5', icon)} />
      <span className="text-xs text-palmkit-elements-textSecondary break-words leading-relaxed">
        {text}
      </span>
    </li>
  );
}

function eventIcon(event: ActivityEvent): string {
  switch (event.kind) {
    case 'edit':
      return 'i-ph:pencil-simple-fill text-amber-400';
    case 'delete':
      return 'i-ph:trash-fill text-red-400';
    case 'read':
      return 'i-ph:eye text-palmkit-elements-textTertiary';
    case 'search':
      return 'i-ph:magnifying-glass text-palmkit-elements-textTertiary';
    case 'list':
    case 'list_uploads':
      return 'i-ph:list text-palmkit-elements-textTertiary';
    case 'shell':
    case 'tests':
      return 'i-ph:terminal-window-fill text-blue-400';
    case 'screenshot':
      return 'i-ph:camera-fill text-purple-400';
    case 'done':
      return 'i-ph:check-circle-fill text-green-500';
    default:
      // file_written (write_file)
      return event.type === 'file_written' ? 'i-ph:file-plus-fill text-green-400' : 'i-ph:circle text-palmkit-elements-textTertiary';
  }
}

function eventText(event: ActivityEvent): string {
  // Strip the leading "📝 [Builder] " prefix — we already show the agent name
  // in the group header. Keep just the action description.
  return event.message.replace(/^[^\s]+\s\[[^\]]+\]\s*/, '');
}

/**
 * Compute a summary line for an activity group.
 * Examples:
 *   "Wrote 5 files, Ran 3 commands"
 *   "Explored 2 files, Ran 6 commands"
 *   "Read 4 files, Searched 2 patterns"
 */
function computeSummary(group: ActivityGroup): string {
  const counts = {
    wrote: 0,
    edited: 0,
    deleted: 0,
    read: 0,
    searched: 0,
    listed: 0,
    shell: 0,
    tests: 0,
    screenshot: 0,
    done: 0,
  };

  for (const ev of group.events) {
    switch (ev.kind) {
      case 'edit':
        counts.edited++;
        break;
      case 'delete':
        counts.deleted++;
        break;
      case 'read':
        counts.read++;
        break;
      case 'search':
        counts.searched++;
        break;
      case 'list':
      case 'list_uploads':
        counts.listed++;
        break;
      case 'shell':
        counts.shell++;
        break;
      case 'tests':
        counts.tests++;
        break;
      case 'screenshot':
        counts.screenshot++;
        break;
      case 'done':
        counts.done++;
        break;
      default:
        if (ev.type === 'file_written') {
          counts.wrote++;
        }
        break;
    }
  }

  const parts: string[] = [];

  if (counts.wrote > 0) {
    parts.push(`Wrote ${counts.wrote} file${counts.wrote !== 1 ? 's' : ''}`);
  }

  if (counts.edited > 0) {
    parts.push(`Edited ${counts.edited} file${counts.edited !== 1 ? 's' : ''}`);
  }

  if (counts.read > 0) {
    parts.push(`Read ${counts.read} file${counts.read !== 1 ? 's' : ''}`);
  }

  if (counts.deleted > 0) {
    parts.push(`Deleted ${counts.deleted} file${counts.deleted !== 1 ? 's' : ''}`);
  }

  if (counts.searched > 0) {
    parts.push(`Searched ${counts.searched} pattern${counts.searched !== 1 ? 's' : ''}`);
  }

  if (counts.shell > 0) {
    parts.push(`Ran ${counts.shell} command${counts.shell !== 1 ? 's' : ''}`);
  }

  if (counts.tests > 0) {
    parts.push(`Ran ${counts.tests} test suite${counts.tests !== 1 ? 's' : ''}`);
  }

  if (counts.screenshot > 0) {
    parts.push(`Took ${counts.screenshot} screenshot${counts.screenshot !== 1 ? 's' : ''}`);
  }

  return parts.length > 0 ? parts.join(', ') : 'Starting…';
}
