/**
 * SessionAdvisor — an inline, in-thread nudge to CONTINUE the project in a
 * fresh chat once its context gets genuinely large.
 *
 * This is deliberately NOT an arbitrary "you've sent N messages" rule, and it
 * is NOT a warning banner. It renders as an assistant-style message inside the
 * conversation, tied to a real, explainable tradeoff:
 *
 *   On every edit, the worker sends the project's EXISTING files to the model
 *   as context (so it can modify them). The bigger the project, the larger a
 *   share of the model's context window each edit consumes — which genuinely
 *   makes edits slower, costlier, and less precise.
 *
 * So it measures the ACTUAL workspace size (files + bytes) and, only once that
 * crosses a meaningful fraction of a typical context window, offers a single
 * minimalist action: fork this project into a fresh chat that keeps the full
 * project + its memory but starts with a clean, fast context. The old chat
 * stays exactly as it is — nothing is lost. It is dismissible per-chat.
 */
import { useMemo, useState } from 'react';
import { useStore } from '@nanostores/react';
import { previewFilesStore } from '~/lib/stores/build-status';
import { chatId, description, db } from '~/lib/persistence/useChatHistory';
import { continueInFreshChat } from '~/lib/chat/continueInFreshChat';
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleFork = async () => {
    if (busy) {
      return;
    }

    setError(null);

    const sourceProjectId = chatId.get() || window.location.pathname.split('/').filter(Boolean).pop();

    if (!db || !sourceProjectId) {
      setError('Chat storage is unavailable — cannot continue in a fresh chat.');
      return;
    }

    setBusy(true);

    try {
      const newUrlId = await continueInFreshChat({
        db,
        sourceProjectId,
        projectName: description.get() || 'your project',
        files: files ?? {},
      });

      // Full navigation so the fresh chat boots with a clean store/context.
      window.location.href = `/chat/${newUrlId}`;
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : 'Could not continue in a fresh chat');
    }
  };

  return (
    <div className="flex items-start gap-3">
      {/* Assistant-style avatar so this reads as a message in the thread. */}
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-palmkit-elements-bg-depth-3 text-palmkit-elements-textSecondary">
        <span className="i-ph:git-fork text-[15px]" />
      </div>

      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-palmkit-elements-borderColor bg-palmkit-elements-bg-depth-2 px-4 py-3 text-sm">
        <p className="leading-relaxed text-palmkit-elements-textSecondary">
          This chat is getting long — the project is now{' '}
          <span className="font-medium text-palmkit-elements-textPrimary tabular-nums">
            {fileCount} files (~{kb} KB)
          </span>
          . Each edit sends all of that to the model, which slows it down and dulls its focus. Continue in a fresh chat
          with a <span className="font-medium">full copy of the project and its memory</span> — clean, fast context,
          nothing lost.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleFork}
            disabled={busy}
            className={classNames(
              'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 font-medium transition-colors',
              'bg-palmkit-elements-button-primary-background text-palmkit-elements-button-primary-text',
              'hover:bg-palmkit-elements-button-primary-backgroundHover disabled:opacity-60',
            )}
          >
            <span className={busy ? 'i-svg-spinners:90-ring-with-bg text-[15px]' : 'i-ph:git-fork text-[15px]'} />
            {busy ? 'Setting up…' : 'Continue in a fresh chat'}
          </button>
          <button
            type="button"
            onClick={dismiss}
            disabled={busy}
            className="rounded-lg px-3 py-1.5 font-medium text-palmkit-elements-textSecondary transition-colors hover:bg-palmkit-elements-bg-depth-3 hover:text-palmkit-elements-textPrimary disabled:opacity-60"
          >
            Keep editing here
          </button>
        </div>

        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}
