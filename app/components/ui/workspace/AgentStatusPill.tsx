import { memo } from 'react';
import { classNames } from '~/utils/classNames';

/**
 * AgentStatusPill
 *
 * Premium status pill with design-token-driven colors and animated dot indicator.
 * Dark developer-tool aesthetic with purple/violet accent system.
 *
 * Usage:
 *   <AgentStatusPill status="generating" />
 *   <AgentStatusPill status="thinking" compact />
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
    colorClass:
      'bg-[var(--bolt-mobile-surface-bg)] text-[var(--bolt-mobile-text-tertiary)] border-[var(--bolt-mobile-surface-border)]',
  },
  thinking: {
    icon: 'i-ph:brain',
    label: 'Thinking',
    colorClass:
      'bg-[var(--bolt-mobile-accent-faint)] text-[var(--bolt-mobile-accent-text)] border-[var(--bolt-mobile-surface-border)]',
    animate: true,
  },
  generating: {
    icon: 'i-ph:lightning',
    label: 'Generating',
    colorClass:
      'bg-[var(--bolt-mobile-accent-muted)] text-[var(--bolt-mobile-accent-text)] border-[var(--bolt-mobile-surface-border-strong)]',
    animate: true,
  },
  saving: {
    icon: 'i-ph:floppy-disk',
    label: 'Saving',
    colorClass: 'bg-[var(--bolt-mobile-info-muted)] text-[var(--bolt-mobile-info)] border-[rgba(96,165,250,0.2)]',
    animate: true,
  },
  restored: {
    icon: 'i-ph:arrow-counter-clockwise',
    label: 'Restored',
    colorClass: 'bg-[var(--bolt-mobile-success-muted)] text-[var(--bolt-mobile-success)] border-[rgba(74,222,128,0.2)]',
  },
  stuck: {
    icon: 'i-ph:warning',
    label: 'Stuck',
    colorClass: 'bg-[var(--bolt-mobile-warning-muted)] text-[var(--bolt-mobile-warning)] border-[rgba(251,191,36,0.2)]',
    animate: true,
  },
  error: {
    icon: 'i-ph:x-circle',
    label: 'Error',
    colorClass: 'bg-[var(--bolt-mobile-error-muted)] text-[var(--bolt-mobile-error)] border-[rgba(248,113,113,0.2)]',
  },
  done: {
    icon: 'i-ph:check-circle',
    label: 'Done',
    colorClass: 'bg-[var(--bolt-mobile-success-muted)] text-[var(--bolt-mobile-success)] border-[rgba(74,222,128,0.2)]',
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
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
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
            className="h-[3px] w-[3px] rounded-full bg-current opacity-60"
            style={{ animation: 'agentPillDot 1.2s ease-in-out infinite', animationDelay: '0ms' }}
          />
          <span
            className="h-[3px] w-[3px] rounded-full bg-current opacity-60"
            style={{ animation: 'agentPillDot 1.2s ease-in-out infinite', animationDelay: '200ms' }}
          />
          <span
            className="h-[3px] w-[3px] rounded-full bg-current opacity-60"
            style={{ animation: 'agentPillDot 1.2s ease-in-out infinite', animationDelay: '400ms' }}
          />
        </span>
      )}
    </div>
  );
});

AgentStatusPill.displayName = 'AgentStatusPill';
