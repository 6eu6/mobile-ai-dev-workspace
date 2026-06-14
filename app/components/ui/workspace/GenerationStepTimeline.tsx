import { memo } from 'react';
import { classNames } from '~/utils/classNames';
import type { GenerationStep } from '~/lib/stores/generationStatus';

/**
 * GenerationStepTimeline
 *
 * Displays generation steps with a compact mobile-friendly timeline.
 * Supports current step, completed steps, and error step.
 *
 * Usage:
 *   <GenerationStepTimeline currentStep="creating-files" />
 *   <GenerationStepTimeline currentStep="error" errorStep="updating-workspace" errorMessage="Failed" />
 */

interface GenerationStepTimelineProps {
  /** Current generation step */
  currentStep: GenerationStep;

  /** If there's an error, which step failed */
  errorStep?: GenerationStep;

  /** Error message to display */
  errorMessage?: string;

  /** Elapsed time in seconds */
  elapsed?: number;

  /** Current file being created */
  currentFile?: string | null;

  /** Is the process stuck */
  isStuck?: boolean;

  /** Compact mode for inline use */
  compact?: boolean;
  className?: string;
}

const STEPS: { id: GenerationStep; label: string; icon: string }[] = [
  { id: 'waiting-for-model', label: 'Waiting for model', icon: 'i-ph:cloud-arrow-down' },
  { id: 'creating-files', label: 'Creating files', icon: 'i-ph:file-plus' },
  { id: 'updating-workspace', label: 'Updating workspace', icon: 'i-ph:arrows-clockwise' },
  { id: 'starting-preview', label: 'Starting preview', icon: 'i-ph:play-circle' },
  { id: 'done', label: 'Done', icon: 'i-ph:check-circle' },
];

const STEP_ORDER: GenerationStep[] = [
  'waiting-for-model',
  'creating-files',
  'updating-workspace',
  'starting-preview',
  'done',
];

export const GenerationStepTimeline = memo(
  ({
    currentStep,
    errorStep,
    errorMessage,
    elapsed,
    currentFile,
    isStuck,
    compact = false,
    className,
  }: GenerationStepTimelineProps) => {
    if (currentStep === 'idle') {
      return null;
    }

    const isError = currentStep === 'error';
    const isDone = currentStep === 'done';
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    const errorIndex = errorStep ? STEP_ORDER.indexOf(errorStep) : -1;

    if (compact) {
      return (
        <CompactTimeline
          currentStep={currentStep}
          currentIndex={currentIndex}
          isError={isError}
          isDone={isDone}
          isStuck={isStuck}
          errorMessage={errorMessage}
          currentFile={currentFile}
          elapsed={elapsed}
          className={className}
        />
      );
    }

    return (
      <div className={classNames('flex flex-col gap-0', className)}>
        {STEPS.map((step, idx) => {
          const isCompleted = isDone || currentIndex > idx;
          const isCurrent = !isDone && !isError && currentIndex === idx;
          const isFailed = isError && idx === errorIndex;
          const isPending = !isCompleted && !isCurrent && !isFailed;
          const isLast = idx === STEPS.length - 1;

          return (
            <div key={step.id} className="flex items-stretch">
              {/* Icon + connector column */}
              <div className="flex flex-col items-center w-6 shrink-0">
                {/* Step icon */}
                <div
                  className={classNames(
                    'w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all duration-300',
                    isCompleted && 'bg-green-500/20 text-green-500 dark:text-green-400',
                    isCurrent && 'bg-accent-500/20 dark:bg-purple-500/20 text-accent-500 dark:text-purple-400',
                    isFailed && 'bg-red-500/20 text-red-500 dark:text-red-400',
                    isPending && 'bg-bolt-elements-bg-depth-3/60 text-bolt-elements-textTertiary',
                    isCurrent && 'ring-2 ring-accent-300/30 dark:ring-purple-400/20',
                  )}
                >
                  {isCompleted ? (
                    <div className="i-ph:check text-xs" />
                  ) : isFailed ? (
                    <div className="i-ph:x text-xs" />
                  ) : isCurrent ? (
                    <div className={classNames(step.icon, 'text-xs', isStuck && 'animate-pulse')} />
                  ) : (
                    <div className={classNames(step.icon, 'text-xs opacity-50')} />
                  )}
                </div>

                {/* Connector line */}
                {!isLast && (
                  <div
                    className={classNames(
                      'w-px flex-1 min-h-[16px] transition-colors duration-300',
                      isCompleted ? 'bg-green-500/40 dark:bg-green-400/30' : 'bg-bolt-elements-borderColor/40',
                    )}
                  />
                )}
              </div>

              {/* Label column */}
              <div className={classNames('pb-3 pl-2.5 flex-1 min-w-0', isLast && 'pb-0')}>
                <div
                  className={classNames(
                    'text-xs font-medium leading-tight transition-colors duration-300',
                    isCompleted && 'text-green-600 dark:text-green-400',
                    isCurrent && 'text-bolt-elements-textPrimary',
                    isFailed && 'text-red-600 dark:text-red-400',
                    isPending && 'text-bolt-elements-textTertiary',
                  )}
                >
                  {step.label}
                </div>

                {/* Current file info */}
                {isCurrent && currentFile && (
                  <div className="text-[10px] text-bolt-elements-textTertiary font-mono mt-0.5 truncate">
                    {currentFile.split('/').pop()}
                  </div>
                )}

                {/* Error message */}
                {isFailed && errorMessage && (
                  <div className="text-[10px] text-red-500/80 dark:text-red-400/80 mt-0.5 truncate">{errorMessage}</div>
                )}

                {/* Stuck indicator */}
                {isCurrent && isStuck && (
                  <div className="text-[10px] text-amber-500 dark:text-amber-400 mt-0.5 animate-pulse">
                    Seems stuck? Check your connection.
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Elapsed time */}
        {elapsed !== undefined && elapsed > 3 && !isDone && !isError && (
          <div className="text-[10px] text-bolt-elements-textTertiary font-mono mt-1 pl-8">{elapsed}s elapsed</div>
        )}
      </div>
    );
  },
);

GenerationStepTimeline.displayName = 'GenerationStepTimeline';

/** Compact inline timeline — just step dots with a progress bar */
function CompactTimeline({
  currentStep: _currentStep,
  currentIndex,
  isError,
  isDone,
  isStuck,
  errorMessage,
  currentFile,
  elapsed,
  className,
}: {
  currentStep: GenerationStep;
  currentIndex: number;
  isError: boolean;
  isDone: boolean;
  isStuck?: boolean;
  errorMessage?: string;
  currentFile?: string | null;
  elapsed?: number;
  className?: string;
}) {
  const progressPercent = isDone
    ? 100
    : isError
      ? 0
      : Math.min(Math.round((currentIndex / (STEP_ORDER.length - 1)) * 100), 90);

  return (
    <div
      className={classNames(
        'flex items-center gap-2.5 px-3 py-2 rounded-lg',
        'bg-bolt-elements-bg-depth-2/60 border border-bolt-elements-borderColor/40',
        'transition-all duration-300',
        isError && 'border-red-500/30 bg-red-500/5',
        isDone && 'border-green-500/30 bg-green-500/5',
        className,
      )}
    >
      {/* Spinner / icon */}
      {!isDone && !isError && (
        <div className="w-4 h-4 shrink-0">
          <div className="w-4 h-4 rounded-full border-2 border-accent-200 dark:border-purple-700 border-t-accent-500 dark:border-t-purple-400 animate-spin" />
        </div>
      )}
      {isDone && <div className="i-ph:check-circle-fill text-green-500 dark:text-green-400 text-base shrink-0" />}
      {isError && <div className="i-ph:warning-circle-fill text-red-500 dark:text-red-400 text-base shrink-0" />}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-bolt-elements-textPrimary truncate">
            {isStuck
              ? 'Stuck'
              : isError
                ? errorMessage || 'Error'
                : isDone
                  ? 'Done'
                  : STEPS[Math.min(currentIndex, STEPS.length - 1)]?.label}
          </span>
          {currentFile && !isDone && !isError && (
            <span className="text-[10px] text-bolt-elements-textTertiary font-mono truncate max-w-[100px]">
              {currentFile.split('/').pop()}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {!isError && (
          <div className="mt-1 h-[2px] rounded-full bg-bolt-elements-bg-depth-3/60 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--bolt-gradient-start)] to-[var(--bolt-gradient-end)] transition-all duration-700 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </div>

      {/* Step dots */}
      <div className="flex items-center gap-1 shrink-0">
        {STEP_ORDER.slice(0, -1).map((step, i) => (
          <div
            key={step}
            className={classNames(
              'w-1.5 h-1.5 rounded-full transition-all duration-300',
              isDone || i < currentIndex
                ? 'bg-green-500 dark:bg-green-400'
                : i === currentIndex
                  ? 'bg-accent-500 dark:bg-purple-400 scale-125'
                  : 'bg-bolt-elements-bg-depth-3',
            )}
          />
        ))}
      </div>

      {/* Elapsed */}
      {elapsed !== undefined && elapsed > 5 && !isDone && (
        <span className="text-[10px] text-bolt-elements-textTertiary font-mono shrink-0">{elapsed}s</span>
      )}
    </div>
  );
}
