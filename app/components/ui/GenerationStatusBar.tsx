import { useStore } from '@nanostores/react';
import {
  generationStatusStore,
  GENERATION_STEP_LABELS,
  resetGenerationStatus,
  setGenerationStep,
} from '~/lib/stores/generationStatus';
import { classNames } from '~/utils/classNames';

export function GenerationStatusBar() {
  const status = useStore(generationStatusStore);

  if (status.step === 'idle') {
    return null;
  }

  const isDone = status.step === 'done';
  const isError = status.step === 'error';
  const isActive = !isDone && !isError;
  const elapsed = status.startTime ? Math.round((Date.now() - status.startTime) / 1000) : 0;

  return (
    <div
      className={classNames(
        'flex items-center gap-3 px-4 py-2 text-sm border-b transition-all duration-300',
        isError
          ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300'
          : isDone
            ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900 text-green-700 dark:text-green-300'
            : 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900 text-purple-700 dark:text-purple-300',
      )}
    >
      {/* Spinner for active states */}
      {isActive && (
        <div className="w-4 h-4 rounded-full border-2 border-purple-300 dark:border-purple-700 border-t-purple-600 dark:border-t-purple-400 animate-spin shrink-0" />
      )}

      {/* Done icon */}
      {isDone && <div className="i-ph:check-circle text-base shrink-0" />}

      {/* Error icon */}
      {isError && <div className="i-ph:warning-circle text-base shrink-0" />}

      {/* Status text */}
      <span className="font-medium truncate">{GENERATION_STEP_LABELS[status.step]}</span>

      {/* Current file being created */}
      {status.currentFile && isActive && (
        <span className="text-xs opacity-70 truncate max-w-[200px]">{status.currentFile.split('/').pop()}</span>
      )}

      {/* Elapsed time */}
      {isActive && elapsed > 5 && <span className="text-xs opacity-60 ml-auto shrink-0">{elapsed}s</span>}

      {/* Stuck indicator */}
      {status.isStuck && (
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Seems stuck?</span>
          <button
            onClick={() => {
              resetGenerationStatus();
            }}
            className="text-xs px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/80 transition-colors"
          >
            Stop
          </button>
          <button
            onClick={() => {
              setGenerationStep('waiting-for-model');
            }}
            className="text-xs px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/80 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Auto-dismiss done after 3s - handled by parent */}
    </div>
  );
}
