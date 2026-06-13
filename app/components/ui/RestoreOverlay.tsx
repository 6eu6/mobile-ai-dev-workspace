import { useStore } from '@nanostores/react';
import { restoreStatusStore, isRestoring, RESTORE_STEP_LABELS, type RestoreStep } from '~/lib/stores/generationStatus';
import { classNames } from '~/utils/classNames';

const RESTORE_ICONS: Record<RestoreStep, string> = {
  idle: 'i-ph:circle-notch',
  'loading-messages': 'i-ph:chat-circle-dots',
  'restoring-chat': 'i-ph:chat-centered-text',
  'restoring-files': 'i-ph:folder-open',
  'restoring-webcontainer': 'i-ph:cube',
  done: 'i-ph:check-circle',
  error: 'i-ph:warning-circle',
};

const STEP_ORDER: RestoreStep[] = ['loading-messages', 'restoring-chat', 'restoring-files', 'restoring-webcontainer'];

export function RestoreOverlay() {
  const restoring = useStore(isRestoring);
  const status = useStore(restoreStatusStore);

  if (!restoring) {
    return null;
  }

  const currentStepIndex = STEP_ORDER.indexOf(status.step);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6 p-8 max-w-sm w-full">
        {/* Main spinner */}
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-purple-200 dark:border-purple-900 border-t-purple-600 dark:border-t-purple-400 animate-spin" />
          <div
            className={classNames(
              'absolute inset-0 flex items-center justify-center text-2xl',
              'text-purple-600 dark:text-purple-400',
            )}
          >
            <div className={RESTORE_ICONS[status.step]} />
          </div>
        </div>

        {/* Status text */}
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Restoring Workspace</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{RESTORE_STEP_LABELS[status.step]}</p>
          {status.wasInterrupted && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              Generation was interrupted. Restoring the latest saved snapshot.
            </p>
          )}
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 w-full justify-center">
          {STEP_ORDER.map((step, idx) => {
            const isCompleted = currentStepIndex > idx;
            const isCurrent = currentStepIndex === idx;
            const isPending = currentStepIndex < idx;

            return (
              <div key={step} className="flex items-center gap-2">
                <div
                  className={classNames(
                    'w-2.5 h-2.5 rounded-full transition-all duration-300',
                    isCompleted && 'bg-green-500 dark:bg-green-400',
                    isCurrent && 'bg-purple-600 dark:bg-purple-400 scale-125',
                    isPending && 'bg-gray-300 dark:bg-gray-700',
                  )}
                />
                {idx < STEP_ORDER.length - 1 && (
                  <div
                    className={classNames(
                      'w-6 h-0.5 transition-colors duration-300',
                      isCompleted ? 'bg-green-500 dark:bg-green-400' : 'bg-gray-300 dark:bg-gray-700',
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
