import { useStore } from '@nanostores/react';
import { motion, AnimatePresence } from 'framer-motion';
import { restoreStatusStore, isRestoring, RESTORE_STEP_LABELS, type RestoreStep } from '~/lib/stores/generationStatus';
import { classNames } from '~/utils/classNames';
import { RestoreSnapshotCard, type RestoreSnapshotStatus } from './workspace/RestoreSnapshotCard';

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

/**
 * Maps RestoreStep to RestoreSnapshotStatus for RestoreSnapshotCard.
 */
function restoreStepToStatus(step: RestoreStep, wasInterrupted: boolean): RestoreSnapshotStatus {
  switch (step) {
    case 'done':
      return wasInterrupted ? 'interrupted-restored' : 'restored';
    case 'error':
      return 'restore-failed';
    default:
      return 'restoring';
  }
}

export function RestoreOverlay() {
  const restoring = useStore(isRestoring);
  const status = useStore(restoreStatusStore);

  const currentStepIndex = STEP_ORDER.indexOf(status.step);
  const snapshotStatus = restoreStepToStatus(status.step, status.wasInterrupted);

  return (
    <AnimatePresence>
      {restoring && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-bolt-elements-bg-depth-1/85 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="flex flex-col items-center gap-6 p-8 max-w-sm w-full"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            {/* Main spinner */}
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-accent-200/40 dark:border-purple-800/40 border-t-accent-500 dark:border-t-purple-400 animate-spin" />
              <div
                className={classNames(
                  'absolute inset-0 flex items-center justify-center text-2xl',
                  'text-accent-600 dark:text-purple-400',
                )}
              >
                <div className={RESTORE_ICONS[status.step]} />
              </div>
            </div>

            {/* Status text */}
            <div className="text-center">
              <h2 className="text-lg font-semibold text-bolt-elements-textPrimary">Restoring Workspace</h2>
              <p className="mt-2 text-sm text-bolt-elements-textSecondary">{RESTORE_STEP_LABELS[status.step]}</p>
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
                        isCurrent &&
                          'bg-accent-500 dark:bg-purple-400 scale-125 ring-2 ring-accent-300/30 dark:ring-purple-400/20',
                        isPending && 'bg-bolt-elements-bg-depth-3',
                      )}
                    />
                    {idx < STEP_ORDER.length - 1 && (
                      <div
                        className={classNames(
                          'w-6 h-0.5 transition-colors duration-300',
                          isCompleted ? 'bg-green-500/60 dark:bg-green-400/60' : 'bg-bolt-elements-bg-depth-3',
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* RestoreSnapshotCard for interrupted restore */}
            {status.wasInterrupted && (
              <RestoreSnapshotCard status={snapshotStatus} wasInterrupted={status.wasInterrupted} />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
