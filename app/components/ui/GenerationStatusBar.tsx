import { useStore } from '@nanostores/react';
import {
  generationStatusStore,
  GENERATION_STEP_LABELS,
  resetGenerationStatus,
  setGenerationStep,
} from '~/lib/stores/generationStatus';
import { classNames } from '~/utils/classNames';
import { AgentStatusPill, type AgentStatus } from './workspace/AgentStatusPill';

const STEPS_ORDER = ['waiting-for-model', 'creating-files', 'updating-workspace', 'starting-preview', 'done'] as const;

/**
 * Maps a GenerationStep to an AgentStatus for the AgentStatusPill.
 */
function stepToAgentStatus(step: string, isStuck: boolean): AgentStatus {
  if (isStuck) {
    return 'stuck';
  }

  switch (step) {
    case 'waiting-for-model':
      return 'thinking';
    case 'creating-files':
    case 'updating-workspace':
    case 'starting-preview':
      return 'generating';
    case 'done':
      return 'done';
    case 'error':
      return 'error';
    default:
      return 'idle';
  }
}

export function GenerationStatusBar() {
  const status = useStore(generationStatusStore);

  if (status.step === 'idle') {
    return null;
  }

  const isDone = status.step === 'done';
  const isError = status.step === 'error';
  const isActive = !isDone && !isError;
  const agentStatus = stepToAgentStatus(status.step, status.isStuck);

  return (
    <div
      className={classNames(
        'relative overflow-hidden',
        'flex items-center gap-3 px-4 py-2.5 text-sm',
        'border-b transition-all duration-500 ease-out',
        isError
          ? 'bg-red-50/80 dark:bg-red-950/20 border-red-200/60 dark:border-red-900/40 text-red-700 dark:text-red-300'
          : isDone
            ? 'bg-green-50/80 dark:bg-green-950/20 border-green-200/60 dark:border-green-900/40 text-green-700 dark:text-green-300'
            : 'bg-accent-50/60 dark:bg-purple-950/20 border-accent-200/60 dark:border-purple-900/40 text-accent-700 dark:text-purple-300',
      )}
    >
      {/* Progress bar background */}
      {isActive && (
        <div className="absolute inset-0 opacity-20">
          <div
            className="h-full bg-gradient-to-r from-[var(--bolt-gradient-start)] to-[var(--bolt-gradient-end)] transition-all duration-1000 ease-out"
            style={{
              width: `${
                isDone
                  ? 100
                  : isError
                    ? 0
                    : Math.min(
                        Math.round((STEPS_ORDER.indexOf(status.step as any) / (STEPS_ORDER.length - 1)) * 100),
                        90,
                      )
              }%`,
            }}
          />
        </div>
      )}

      {/* Agent status pill */}
      <AgentStatusPill status={agentStatus} compact={isActive} />

      {/* Status text */}
      <span className="relative font-medium truncate">{GENERATION_STEP_LABELS[status.step]}</span>

      {/* Current file being created */}
      {status.currentFile && isActive && (
        <span className="relative text-xs opacity-70 truncate max-w-[200px] font-mono">
          {status.currentFile.split('/').pop()}
        </span>
      )}

      {/* Step dots indicator */}
      {isActive && (
        <div className="relative flex items-center gap-1 ml-1">
          {STEPS_ORDER.slice(0, -1).map((step, i) => {
            const currentStepIndex = STEPS_ORDER.indexOf(status.step as any);

            return (
              <div
                key={step}
                className={classNames(
                  'w-1.5 h-1.5 rounded-full transition-all duration-300',
                  i < currentStepIndex
                    ? 'bg-accent-500 dark:bg-purple-400'
                    : i === currentStepIndex
                      ? 'bg-accent-500 dark:bg-purple-400 scale-125'
                      : 'bg-accent-200 dark:bg-purple-800',
                )}
              />
            );
          })}
        </div>
      )}

      {/* Elapsed time */}
      {isActive && status.startTime && Math.round((Date.now() - status.startTime) / 1000) > 5 && (
        <span className="relative text-xs opacity-50 ml-auto shrink-0 font-mono">
          {Math.round((Date.now() - status.startTime) / 1000)}s
        </span>
      )}

      {/* Stuck indicator */}
      {status.isStuck && (
        <div className="relative flex items-center gap-2 ml-auto shrink-0">
          <span className="text-xs text-amber-600 dark:text-amber-400 font-medium animate-pulse">Seems stuck?</span>
          <button
            onClick={() => {
              resetGenerationStatus();
            }}
            className="text-xs px-2.5 py-1 rounded-lg bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/80 transition-all duration-200 active:scale-95"
          >
            Stop
          </button>
          <button
            onClick={() => {
              setGenerationStep('waiting-for-model');
            }}
            className="text-xs px-2.5 py-1 rounded-lg bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/80 transition-all duration-200 active:scale-95"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
