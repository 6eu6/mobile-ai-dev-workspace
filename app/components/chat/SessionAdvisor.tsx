/**
 * SessionAdvisor — an HONEST, transparent nudge to start a fresh chat.
 *
 * This is deliberately NOT an arbitrary "you've sent N messages" rule. It is
 * tied to a real, explainable tradeoff:
 *
 *   On every edit, the worker sends the project's EXISTING files to the model
 *   as context (so it can modify them). The bigger the project, the larger a
 *   share of the model's context window each edit consumes — which genuinely
 *   makes edits slower, costlier, and less precise.
 *
 * So the advisor measures the ACTUAL workspace size (files + bytes) and, only
 * once that crosses a meaningful fraction of a typical context window, shows a
 * transparent card that states the real numbers, explains *why*, and leaves the
 * decision entirely to the user:
 *   - "Start a fresh chat" — best when the next request is a NEW/unrelated build
 *     (also gives it a clean, isolated workspace).
 *   - "Keep editing here" — perfectly fine for continuing to refine THIS project.
 *
 * It is dismissible per-chat, so it never nags.
 */
import { useMemo, useState } from 'react';
import { useStore } from '@nanostores/react';
import { previewFilesStore } from '~/lib/stores/build-status';
import { classNames } from '~/utils/classNames';

/*
 * Thresholds grounded in the real tradeoff, not plucked from thin air:
 * ~120 KB of code is roughly ~30K tokens — a large fraction of a typical
 * model's context window once the worklog + prompt + tool overhead are added.
 * Past that (or a high file count), edits meaningfully degrade. We only advise;
 * we never block.
 */
const SIZE_THRESHOLD_BYTES = 120 * 1024;
const FILE_THRESHOLD = 35;

function dismissKey(): string {
  if (typeof window === 'undefined') {
    return 'palmkit_session_advisor_root';
  }

  const id = window.location.pathname.split('/').filter(Boolean).pop() || 'root';

  return `palmkit_session_advisor_dismissed_${id}`;
}

export function SessionAdvisor() {
  const files = useStore(previewFilesStore);

  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      return localStorage.getItem(dismissKey()) === '1';
    } catch {
      return false;
    }
  });

  const { fileCount, totalBytes } = useMemo(() => {
    const entries = Object.entries(files ?? {});

    return {
      fileCount: entries.length,
      totalBytes: entries.reduce((sum, [, content]) => sum + (content?.length ?? 0), 0),
    };
  }, [files]);

  const over = totalBytes > SIZE_THRESHOLD_BYTES || fileCount > FILE_THRESHOLD;

  if (dismissed || fileCount === 0 || !over) {
    return null;
  }

  const kb = Math.round(totalBytes / 1024);

  const dismiss = () => {
    try {
      localStorage.setItem(dismissKey(), '1');
    } catch {
      // ignore — non-fatal
    }

    setDismissed(true);
  };

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
      <div className="flex items-start gap-2.5">
        <div className="i-ph:lightbulb-filament mt-0.5 shrink-0 text-[16px] text-amber-400" />
        <div className="flex-1">
          <p className="font-medium text-palmkit-elements-textPrimary">This project is getting large</p>
          <p className="mt-1 leading-relaxed text-palmkit-elements-textSecondary">
            Each edit sends this project&apos;s{' '}
            <span className="font-medium text-palmkit-elements-textPrimary tabular-nums">
              {fileCount} files (~{kb} KB)
            </span>{' '}
            to the model as context. At this size, edits use a big share of the model&apos;s context window, which can
            make them slower and less precise. If your next request is a{' '}
            <span className="font-medium">new or unrelated</span> project, a fresh chat gives it a clean, isolated
            workspace and the model&apos;s full attention. To keep refining <span className="font-medium">this</span>{' '}
            project, staying here is perfectly fine.
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <a
              href="/"
              className={classNames(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors',
                'bg-palmkit-elements-button-primary-background text-palmkit-elements-button-primary-text',
                'hover:bg-palmkit-elements-button-primary-backgroundHover',
              )}
            >
              <span className="i-ph:plus-circle" />
              Start a fresh chat
            </a>
            <button
              type="button"
              onClick={dismiss}
              className="rounded-lg px-3 py-1.5 font-medium text-palmkit-elements-textSecondary transition-colors hover:bg-palmkit-elements-bg-depth-3 hover:text-palmkit-elements-textPrimary"
            >
              Keep editing here
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
