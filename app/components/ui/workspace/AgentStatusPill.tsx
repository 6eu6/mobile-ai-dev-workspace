import { memo } from 'react';
import { classNames } from '~/utils/classNames';

/**
 * AgentStatusPill
 *
 * Shows agent states: idle, thinking, generating, saving, restored, stuck, error, done.
 * Uses icon + label + subtle animation. No excessive motion.
 *
 * Usage:
 *   <AgentStatusPill status="generating" />
 */

export type AgentStatus = 'idle' | 'thinking' | 'generating' | 'saving' | 'restored' | 'stuck' | 'error' | 'done';

interface AgentStatusPillProps {
  status: AgentStatus;

  /** Optional compact mode — hides label, shows only icon */
  compact?: boolean;
  className?: string;
}

const STATUS_CONFIG: Record<AgentStatus, { icon: string; label: string; colorClass: string; animate?: boolean }> = {
  idle: {
    icon: 'i-ph:circle-dashed',
    label: 'Idle',
    colorClass: 'bg-bolt-elements-bg-depth-3/60 text-bolt-elements-textTertiary border-bolt-elements-borderColor/50',
  },
  thinking: {
    icon: 'i-ph:brain',
    label: 'Thinking',
    colorClass:
      'bg-accent-500/10 dark:bg-purple-500/15 text-accent-600 dark:text-purple-300 border-accent-300/40 dark:border-purple-500/30',
    animate: true,
  },
  generating: {
    icon: 'i-ph:lightning',
    label: 'Generating',
    colorClass:
      'bg-accent-500/15 dark:bg-purple-500/20 text-accent-600 dark:text-purple-300 border-accent-300/50 dark:border-purple-500/35',
    animate: true,
  },
  saving: {
    icon: 'i-ph:floppy-disk',
    label: 'Saving',
    colorClass:
      'bg-blue-500/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-300/40 dark:border-blue-500/30',
    animate: true,
  },
  restored: {
    icon: 'i-ph:arrow-counter-clockwise',
    label: 'Restored',
    colorClass:
      'bg-green-500/10 dark:bg-green-500/15 text-green-600 dark:text-green-300 border-green-300/40 dark:border-green-500/30',
  },
  stuck: {
    icon: 'i-ph:warning',
    label: 'Stuck',
    colorClass:
      'bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-300/40 dark:border-amber-500/30',
    animate: true,
  },
  error: {
    icon: 'i-ph:x-circle',
    label: 'Error',
    colorClass:
      'bg-red-500/10 dark:bg-red-500/15 text-red-600 dark:text-red-300 border-red-300/40 dark:border-red-500/30',
  },
  done: {
    icon: 'i-ph:check-circle',
    label: 'Done',
    colorClass:
      'bg-green-500/10 dark:bg-green-500/15 text-green-600 dark:text-green-300 border-green-300/40 dark:border-green-500/30',
  },
};

export const AgentStatusPill = memo(({ status, compact = false, className }: AgentStatusPillProps) => {
  if (status === 'idle') {
    return null;
  }

  const config = STATUS_CONFIG[status];

  return (
    <div
      className={classNames(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium',
        'transition-all duration-300 ease-out',
        'select-none',
        config.colorClass,
        className,
      )}
      role="status"
      aria-label={config.label}
    >
      <div className={classNames(config.icon, 'text-sm shrink-0', config.animate && 'animate-pulse')} />
      {!compact && <span className="whitespace-nowrap">{config.label}</span>}
      {config.animate && (
        <span className="flex gap-[2px]">
          <span
            className="w-[3px] h-[3px] rounded-full bg-current opacity-60"
            style={{ animation: 'agentPillDot 1.2s ease-in-out infinite', animationDelay: '0ms' }}
          />
          <span
            className="w-[3px] h-[3px] rounded-full bg-current opacity-60"
            style={{ animation: 'agentPillDot 1.2s ease-in-out infinite', animationDelay: '200ms' }}
          />
          <span
            className="w-[3px] h-[3px] rounded-full bg-current opacity-60"
            style={{ animation: 'agentPillDot 1.2s ease-in-out infinite', animationDelay: '400ms' }}
          />
        </span>
      )}
    </div>
  );
});

AgentStatusPill.displayName = 'AgentStatusPill';
