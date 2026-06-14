import { memo } from 'react';
import { classNames } from '~/utils/classNames';

/**
 * RestoreSnapshotCard
 *
 * Shows restored workspace state after refresh.
 * States: restoring, restored, interrupted-restored, restore-failed.
 * Must be clear and reassuring.
 *
 * Usage:
 *   <RestoreSnapshotCard status="restoring" />
 *   <RestoreSnapshotCard status="restored" wasInterrupted />
 */

export type RestoreSnapshotStatus = 'restoring' | 'restored' | 'interrupted-restored' | 'restore-failed';

interface RestoreSnapshotCardProps {
  /** Current restore status */
  status: RestoreSnapshotStatus;

  /** Whether the generation was interrupted */
  wasInterrupted?: boolean;

  /** Optional timestamp of the snapshot */
  snapshotTime?: string;
  className?: string;
}

const STATUS_CONFIG: Record<
  RestoreSnapshotStatus,
  { icon: string; title: string; description: string; colorClass: string; animate?: boolean }
> = {
  restoring: {
    icon: 'i-ph:arrow-counter-clockwise',
    title: 'Restoring workspace',
    description: 'Recovering your last session...',
    colorClass: 'border-accent-300/30 dark:border-purple-500/30 bg-accent-500/5 dark:bg-purple-500/5',
    animate: true,
  },
  restored: {
    icon: 'i-ph:check-circle',
    title: 'Workspace restored',
    description: 'Your session has been recovered successfully.',
    colorClass: 'border-green-300/30 dark:border-green-500/30 bg-green-500/5',
  },
  'interrupted-restored': {
    icon: 'i-ph:arrow-counter-clockwise',
    title: 'Session recovered',
    description: 'The last generation was interrupted. Your progress has been saved and restored.',
    colorClass: 'border-amber-300/30 dark:border-amber-500/30 bg-amber-500/5',
  },
  'restore-failed': {
    icon: 'i-ph:warning-circle',
    title: 'Restore failed',
    description: 'Could not recover your last session. Starting fresh.',
    colorClass: 'border-red-300/30 dark:border-red-500/30 bg-red-500/5',
  },
};

const ICON_COLOR: Record<RestoreSnapshotStatus, string> = {
  restoring: 'text-accent-500 dark:text-purple-400',
  restored: 'text-green-500 dark:text-green-400',
  'interrupted-restored': 'text-amber-500 dark:text-amber-400',
  'restore-failed': 'text-red-500 dark:text-red-400',
};

export const RestoreSnapshotCard = memo(
  ({ status, wasInterrupted, snapshotTime, className }: RestoreSnapshotCardProps) => {
    const effectiveStatus = wasInterrupted && status === 'restored' ? 'interrupted-restored' : status;
    const config = STATUS_CONFIG[effectiveStatus];

    return (
      <div
        className={classNames(
          'flex items-start gap-3 px-4 py-3 rounded-xl border',
          'transition-all duration-300 ease-out',
          config.colorClass,
          className,
        )}
        role="alert"
        aria-live="polite"
      >
        {/* Status icon */}
        <div
          className={classNames(
            'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
            'bg-bolt-elements-bg-depth-2/60',
            ICON_COLOR[effectiveStatus],
            config.animate && 'animate-pulse',
          )}
        >
          <div className={classNames(config.icon, 'text-lg')} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-bolt-elements-textPrimary">{config.title}</h3>
            {config.animate && (
              <div className="w-3 h-3 rounded-full border-2 border-accent-300 dark:border-purple-600 border-t-accent-500 dark:border-t-purple-400 animate-spin" />
            )}
          </div>
          <p className="text-xs text-bolt-elements-textSecondary mt-0.5 leading-relaxed">{config.description}</p>
          {snapshotTime && (
            <p className="text-[10px] text-bolt-elements-textTertiary mt-1 font-mono">Snapshot from {snapshotTime}</p>
          )}
        </div>
      </div>
    );
  },
);

RestoreSnapshotCard.displayName = 'RestoreSnapshotCard';
