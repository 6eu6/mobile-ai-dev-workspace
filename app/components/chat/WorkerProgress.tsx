/**
 * Phase 5 — Worker Progress UI
 *
 * Displays real-time Oracle Worker build events in the chat panel:
 *   ✓ Planning app structure
 *   ✓ Created package.json (34 lines)
 *   ✓ Created src/App.tsx (128 lines)
 *   ⏳ Running build check...
 *   ○ Preparing preview
 */

import React, { useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { workerEventsStore, type WorkerEvent } from '~/lib/stores/build-status';
import { classNames } from '~/utils/classNames';

const ICON_DONE = 'i-ph:check-circle-fill text-green-400';
const ICON_RUNNING = 'i-svg-spinners:90-ring-with-bg text-palmkit-elements-loader-progress animate-spin';
const ICON_ERROR = 'i-ph:x-circle-fill text-red-400';
const ICON_WARN = 'i-ph:warning-fill text-yellow-400';

const TERMINAL_EVENTS = new Set(['ready_for_preview', 'job_failed']);
const ERROR_EVENTS = new Set(['job_failed', 'validation_failed', 'build_check_failed']);
const WARN_EVENTS = new Set(['repair_started']);

function eventIcon(event: WorkerEvent, isLast: boolean): string {
  if (ERROR_EVENTS.has(event.type)) {
    return ICON_ERROR;
  }

  if (WARN_EVENTS.has(event.type)) {
    return ICON_WARN;
  }

  if (isLast && !TERMINAL_EVENTS.has(event.type)) {
    return ICON_RUNNING;
  }

  return ICON_DONE;
}

function isFileWritten(event: WorkerEvent): boolean {
  return event.type === 'file_written';
}

export function WorkerProgress() {
  const events = useStore(workerEventsStore);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [events.length]);

  if (events.length === 0) {
    return null;
  }

  /* Collapse consecutive file_written events into a summary */
  const displayItems = collapseFileEvents(events);

  return (
    <div className="mx-4 mb-3 rounded-lg border border-palmkit-elements-borderColor bg-palmkit-elements-bg-depth-2 p-3 text-sm">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-palmkit-elements-textTertiary">
        <div className="i-ph:hammer text-[10px]" />
        Building
      </div>
      <ul className="space-y-1">
        {displayItems.map((item, i) => {
          const isLast = i === displayItems.length - 1;

          if (item.type === 'file_summary') {
            return (
              <li key={`fs-${i}`} className="flex items-center gap-2 text-palmkit-elements-textSecondary">
                <div className={classNames('shrink-0 text-[13px]', ICON_DONE)} />
                <span className="text-xs opacity-70">{item.message}</span>
              </li>
            );
          }

          const icon = eventIcon(item as WorkerEvent, isLast);

          return (
            <li
              key={`ev-${(item as WorkerEvent).seq}`}
              className={classNames(
                'flex items-center gap-2',
                ERROR_EVENTS.has((item as WorkerEvent).type)
                  ? 'text-red-300'
                  : TERMINAL_EVENTS.has((item as WorkerEvent).type) && (item as WorkerEvent).type !== 'job_failed'
                    ? 'text-green-300'
                    : isLast
                      ? 'text-palmkit-elements-textPrimary'
                      : 'text-palmkit-elements-textSecondary',
              )}
            >
              <div className={classNames('shrink-0 text-[13px]', icon)} />
              <span className="text-xs">{(item as WorkerEvent).message}</span>
            </li>
          );
        })}
      </ul>
      <div ref={bottomRef} />
    </div>
  );
}

type DisplayItem = WorkerEvent | { type: 'file_summary'; message: string };

function collapseFileEvents(events: WorkerEvent[]): DisplayItem[] {
  const result: DisplayItem[] = [];
  let fileCount = 0;
  let lastFileMsg = '';

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];

    if (isFileWritten(ev)) {
      fileCount++;
      lastFileMsg = ev.message;

      /* Check if next event is also file_written */
      if (i + 1 < events.length && isFileWritten(events[i + 1])) {
        continue;
      }

      /* End of file_written run — emit summary or single line */
      if (fileCount > 2) {
        result.push({ type: 'file_summary', message: `${lastFileMsg} (+${fileCount - 1} more files)` });
      } else {
        for (let j = i - fileCount + 1; j <= i; j++) {
          result.push(events[j]);
        }
      }

      fileCount = 0;
    } else {
      fileCount = 0;
      result.push(ev);
    }
  }

  return result;
}
