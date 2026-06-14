import { memo, type ReactNode } from 'react';
import { classNames } from '~/utils/classNames';

/**
 * WorkspaceShell
 *
 * Provides the consistent mobile page background, prevents horizontal overflow,
 * handles safe-area spacing, and defines the visual shell for all workspace views.
 *
 * Usage:
 *   <WorkspaceShell>
 *     <ChatView />
 *   </WorkspaceShell>
 */

interface WorkspaceShellProps {
  children: ReactNode;

  /** Optional class name for the inner content area */
  className?: string;

  /** Show the subtle grid/noise background pattern */
  showBackgroundPattern?: boolean;

  /** ID for the scrollable content area */
  contentId?: string;
}

export const WorkspaceShell = memo(
  ({ children, className, showBackgroundPattern = true, contentId }: WorkspaceShellProps) => {
    return (
      <div
        className={classNames(
          'relative flex flex-col min-h-dvh w-full overflow-x-hidden',
          'bg-bolt-elements-bg-depth-1',
          className,
        )}
      >
        {/* Subtle background pattern — grid + noise */}
        {showBackgroundPattern && (
          <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
            {/* Grid pattern */}
            <div
              className="absolute inset-0 opacity-[0.025] dark:opacity-[0.04]"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(139, 92, 246, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(139, 92, 246, 0.3) 1px, transparent 1px)',
                backgroundSize: '48px 48px',
              }}
            />
            {/* Radial glow */}
            <div
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(ellipse 60% 40% at 50% 0%, var(--bolt-glow-color), transparent)',
              }}
            />
          </div>
        )}

        {/* Main content */}
        <main id={contentId} className={classNames('relative z-1 flex-1 flex flex-col w-full overflow-x-hidden')}>
          {children}
        </main>
      </div>
    );
  },
);

WorkspaceShell.displayName = 'WorkspaceShell';
