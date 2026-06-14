import { memo } from 'react';
import { classNames } from '~/utils/classNames';

/**
 * FileCreatedCard
 *
 * Shows when AI creates or updates a file.
 * Contains file icon, filename, path, status.
 * Optional small pulse when updated.
 *
 * Usage:
 *   <FileCreatedCard filename="App.tsx" path="src/" status="created" />
 *   <FileCreatedCard filename="index.ts" path="src/routes/" status="updated" language="typescript" />
 */

export type FileCreatedStatus = 'created' | 'updated' | 'error' | 'pending';

interface FileCreatedCardProps {
  /** File name with extension */
  filename: string;

  /** Directory path */
  path?: string;

  /** File status */
  status?: FileCreatedStatus;

  /** Programming language for icon selection */
  language?: string;

  /** Show pulse animation on update */
  pulse?: boolean;

  /** Compact mode — single line */
  compact?: boolean;
  className?: string;

  /** Click handler */
  onClick?: () => void;
}

const STATUS_CONFIG: Record<FileCreatedStatus, { icon: string; colorClass: string; label: string }> = {
  created: {
    icon: 'i-ph:plus-circle',
    colorClass: 'text-green-500 dark:text-green-400',
    label: 'Created',
  },
  updated: {
    icon: 'i-ph:pencil-simple',
    colorClass: 'text-accent-500 dark:text-purple-400',
    label: 'Updated',
  },
  error: {
    icon: 'i-ph:warning-circle',
    colorClass: 'text-red-500 dark:text-red-400',
    label: 'Error',
  },
  pending: {
    icon: 'i-ph:clock',
    colorClass: 'text-bolt-elements-textTertiary',
    label: 'Pending',
  },
};

/** Map file extension to Phosphor icon */
function getFileIcon(filename: string, _language?: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  const iconMap: Record<string, string> = {
    ts: 'i-ph:file-code',
    tsx: 'i-ph:file-code',
    js: 'i-ph:file-code',
    jsx: 'i-ph:file-code',
    html: 'i-ph:file-code',
    css: 'i-ph:file-code',
    scss: 'i-ph:file-code',
    json: 'i-ph:brackets-curly',
    md: 'i-ph:file-text',
    py: 'i-ph:file-code',
    rs: 'i-ph:file-code',
    go: 'i-ph:file-code',
    svg: 'i-ph:image',
    png: 'i-ph:image',
    jpg: 'i-ph:image',
    gif: 'i-ph:image',
    yaml: 'i-ph:file-text',
    yml: 'i-ph:file-text',
    toml: 'i-ph:file-text',
    env: 'i-ph:lock-simple',
    sh: 'i-ph:terminal',
    bash: 'i-ph:terminal',
  };

  return iconMap[ext] || 'i-ph:file';
}

export const FileCreatedCard = memo(
  ({
    filename,
    path,
    status = 'created',
    language,
    pulse = false,
    compact = false,
    className,
    onClick,
  }: FileCreatedCardProps) => {
    const statusConfig = STATUS_CONFIG[status];
    const fileIcon = getFileIcon(filename, language);

    if (compact) {
      return (
        <div
          className={classNames(
            'inline-flex items-center gap-1.5 px-2 py-1 rounded-md',
            'bg-bolt-elements-bg-depth-2/60 border border-bolt-elements-borderColor/30',
            'text-xs',
            onClick && 'cursor-pointer hover:bg-bolt-elements-bg-depth-3/60 transition-colors',
            pulse && 'animate-pulse-glow',
            className,
          )}
          onClick={onClick}
          role={onClick ? 'button' : undefined}
          tabIndex={onClick ? 0 : undefined}
        >
          <div className={classNames(fileIcon, 'text-sm text-bolt-elements-textSecondary shrink-0')} />
          <span className="text-bolt-elements-textPrimary font-mono truncate max-w-[120px]">{filename}</span>
          <div className={classNames(statusConfig.icon, 'text-xs shrink-0', statusConfig.colorClass)} />
        </div>
      );
    }

    return (
      <div
        className={classNames(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg',
          'bg-bolt-elements-bg-depth-2/40 border border-bolt-elements-borderColor/30',
          'transition-all duration-200',
          onClick && 'cursor-pointer hover:bg-bolt-elements-bg-depth-2/70 active:scale-[0.98]',
          pulse && 'animate-pulse-glow',
          status === 'error' && 'border-red-500/20',
          className,
        )}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
      >
        {/* File icon */}
        <div
          className={classNames(
            'w-8 h-8 rounded-md flex items-center justify-center shrink-0',
            'bg-bolt-elements-bg-depth-3/50 border border-bolt-elements-borderColor/20',
            status === 'created' && 'text-green-500/70 dark:text-green-400/70',
            status === 'updated' && 'text-accent-500/70 dark:text-purple-400/70',
            status === 'error' && 'text-red-500/70 dark:text-red-400/70',
            status === 'pending' && 'text-bolt-elements-textTertiary',
          )}
        >
          <div className={classNames(fileIcon, 'text-base')} />
        </div>

        {/* File info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-bolt-elements-textPrimary truncate font-mono">{filename}</span>
            <div className={classNames(statusConfig.icon, 'text-xs shrink-0', statusConfig.colorClass)} />
          </div>
          {path && <div className="text-[10px] text-bolt-elements-textTertiary font-mono truncate mt-0.5">{path}</div>}
        </div>

        {/* Status label */}
        <span
          className={classNames(
            'text-[10px] font-medium px-1.5 py-0.5 rounded',
            'bg-bolt-elements-bg-depth-3/50',
            statusConfig.colorClass,
          )}
        >
          {statusConfig.label}
        </span>
      </div>
    );
  },
);

FileCreatedCard.displayName = 'FileCreatedCard';
