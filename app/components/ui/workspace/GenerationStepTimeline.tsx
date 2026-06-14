import { memo } from 'react';
import { classNames } from '~/utils/classNames';
import type { GenerationStep } from '~/lib/stores/generationStatus';

/**
 * GenerationStepTimeline
 *
 * Premium step timeline with design-token-driven colors.
 * Dark developer-tool aesthetic with purple/violet accent system.
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
              <div className="flex w-6 shrink-0 flex-col items-center">
                {/* Step icon — 20px circle */}
                <div
                  className={classNames(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all duration-300',
                    isCompleted && 'bg-[var(--bolt-mobile-success-muted)] text-[var(--bolt-mobile-success)]',
                    isCurrent &&
                      'bg-[var(--bolt-mobile-accent-muted)] text-[var(--bolt-mobile-accent-text)] ring-2 ring-[var(--bolt-mobile-accent)]/20',
                    isFailed && 'bg-[var(--bolt-mobile-error-muted)] text-[var(--bolt-mobile-error)]',
                    isPending &&
                      'bg-[var(--bolt-mobile-surface-bg)] text-[var(--bolt-mobile-text-tertiary)] border border-[var(--bolt-mobile-surface-border)]',
                  )}
                >
                  {isCompleted ? (
                    <div className="i-ph:check text-[10px]" />
                  ) : isFailed ? (
                    <div className="i-ph:x text-[10px]" />
                  ) : isCurrent ? (
                    <div className={classNames(step.icon, 'text-[10px]', isStuck && 'animate-pulse')} />
                  ) : (
                    <div className={classNames(step.icon, 'text-[10px] opacity-50')} />
                  )}
                </div>

                {/* Connector line */}
                {!isLast && (
                  <div
                    className={classNames(
                      'min-h-[16px] flex-1 w-px transition-colors duration-300',
                      isCompleted ? 'bg-[var(--bolt-mobile-success)]/40' : 'bg-[var(--bolt-mobile-surface-border)]',
                    )}
                  />
                )}
              </div>

              {/* Label column */}
              <div className={classNames('min-w-0 flex-1 pb-3 pl-2.5', isLast && 'pb-0')}>
                <div
                  className={classNames(
                    'text-xs font-medium leading-tight transition-colors duration-300',
                    isCompleted && 'text-[var(--bolt-mobile-success)]',
                    isCurrent && 'text-[var(--bolt-mobile-text-primary)]',
                    isFailed && 'text-[var(--bolt-mobile-error)]',
                    isPending && 'text-[var(--bolt-mobile-text-tertiary)]',
                  )}
                >
                  {step.label}
                </div>

                {/* Current file info */}
                {isCurrent && currentFile && (
                  <div className="mt-0.5 truncate font-mono text-[10px] text-[var(--bolt-mobile-text-tertiary)]">
                    {currentFile.split('/').pop()}
                  </div>
                )}

                {/* Error message */}
                {isFailed && errorMessage && (
                  <div className="mt-0.5 truncate text-[10px] text-[var(--bolt-mobile-error)]/80">{errorMessage}</div>
                )}

                {/* Stuck indicator */}
                {isCurrent && isStuck && (
                  <div className="mt-0.5 animate-pulse text-[10px] text-[var(--bolt-mobile-warning)]">
                    Seems stuck? Check your connection.
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Elapsed time */}
        {elapsed !== undefined && elapsed > 3 && !isDone && !isError && (
          <div className="mt-1 pl-8 font-mono text-[10px] text-[var(--bolt-mobile-text-tertiary)]">
            {elapsed}s elapsed
          </div>
        )}
      </div>
    );
  },
);

GenerationStepTimeline.displayName = 'GenerationStepTimeline';

/** Compact inline timeline — step dots with a gradient progress bar */
function CompactTimeline({
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
        'flex items-center gap-2.5 rounded-[var(--bolt-radius-lg)] border px-3 py-2',
        'bg-[var(--bolt-mobile-surface-bg)] border-[var(--bolt-mobile-surface-border)]',
        'transition-all duration-300',
        isError && 'border-[var(--bolt-mobile-error)]/30 bg-[var(--bolt-mobile-error-muted)]',
        isDone && 'border-[var(--bolt-mobile-success)]/30 bg-[var(--bolt-mobile-success-muted)]',
        className,
      )}
    >
      {/* Spinner / icon */}
      {!isDone && !isError && (
        <div className="h-4 w-4 shrink-0">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--bolt-mobile-accent-faint)] border-t-[var(--bolt-mobile-accent-text)]" />
        </div>
      )}
      {isDone && <div className="i-ph:check-circle-fill text-base shrink-0 text-[var(--bolt-mobile-success)]" />}
      {isError && <div className="i-ph:warning-circle-fill text-base shrink-0 text-[var(--bolt-mobile-error)]" />}

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-xs font-medium text-[var(--bolt-mobile-text-primary)]">
            {isStuck
              ? 'Stuck'
              : isError
                ? errorMessage || 'Error'
                : isDone
                  ? 'Done'
                  : STEPS[Math.min(currentIndex, STEPS.length - 1)]?.label}
          </span>
          {currentFile && !isDone && !isError && (
            <span className="max-w-[100px] truncate font-mono text-[10px] text-[var(--bolt-mobile-text-tertiary)]">
              {currentFile.split('/').pop()}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {!isError && (
          <div className="mt-1 h-[2px] overflow-hidden rounded-full bg-[var(--bolt-mobile-surface-border)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--bolt-gradient-start)] to-[var(--bolt-gradient-end)] transition-all duration-700 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </div>

      {/* Step dots */}
      <div className="flex shrink-0 items-center gap-1">
        {STEP_ORDER.slice(0, -1).map((step, i) => (
          <div
            key={step}
            className={classNames(
              'h-1.5 w-1.5 rounded-full transition-all duration-300',
              isDone || i < currentIndex
                ? 'bg-[var(--bolt-mobile-success)]'
                : i === currentIndex
                  ? 'scale-125 bg-[var(--bolt-mobile-accent-text)]'
                  : 'bg-[var(--bolt-mobile-text-tertiary)]/30',
            )}
          />
        ))}
      </div>

      {/* Elapsed */}
      {elapsed !== undefined && elapsed > 5 && !isDone && (
        <span className="shrink-0 font-mono text-[10px] text-[var(--bolt-mobile-text-tertiary)]">{elapsed}s</span>
      )}
    </div>
  );
}
