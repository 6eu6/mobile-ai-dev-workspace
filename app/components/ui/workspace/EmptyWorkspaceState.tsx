import { memo } from 'react';
import { classNames } from '~/utils/classNames';

/**
 * EmptyWorkspaceState
 *
 * For first load / no project selected.
 * Clear CTA: Start new project, Import chat, Clone repo.
 * Should be mobile-safe and not overflow.
 *
 * Usage:
 *   <EmptyWorkspaceState
 *     onNewProject={() => {}}
 *     onImportChat={() => {}}
 *     onCloneRepo={() => {}}
 *   />
 */

interface EmptyWorkspaceStateProps {
  onNewProject?: () => void;
  onImportChat?: () => void;
  onCloneRepo?: () => void;
  className?: string;
}

export const EmptyWorkspaceState = memo(
  ({ onNewProject, onImportChat, onCloneRepo, className }: EmptyWorkspaceStateProps) => {
    return (
      <div
        className={classNames(
          'flex flex-col items-center justify-center px-6 py-12',
          'min-h-[60dvh] w-full max-w-md mx-auto',
          'text-center',
          className,
        )}
      >
        {/* Logo / icon */}
        <div
          className={classNames(
            'w-14 h-14 rounded-xl flex items-center justify-center mb-6',
            'bg-gradient-to-br from-[var(--bolt-gradient-start)] to-[var(--bolt-gradient-end)]',
            'shadow-[0_0_20px_var(--bolt-glow-color)]',
          )}
        >
          <div className="i-bolt:logo text-3xl text-white" />
        </div>

        {/* Heading */}
        <h1 className="text-xl font-bold text-bolt-elements-textPrimary mb-2">Start a Project</h1>
        <p className="text-sm text-bolt-elements-textSecondary mb-8 max-w-[280px] leading-relaxed">
          Describe what you want to build and the AI will generate a full project for you.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col gap-3 w-full max-w-[260px]">
          {/* Primary CTA */}
          <button
            onClick={onNewProject}
            className={classNames(
              'w-full flex items-center justify-center gap-2',
              'py-2.5 px-4 rounded-lg',
              'bg-gradient-to-r from-[var(--bolt-gradient-start)] to-[var(--bolt-gradient-mid)]',
              'text-white font-semibold text-sm',
              'hover:shadow-[0_0_24px_var(--bolt-glow-color)]',
              'transition-all duration-200',
              'active:scale-[0.97]',
            )}
          >
            <div className="i-ph:plus-circle text-base" />
            Start New Project
          </button>

          {/* Secondary CTAs */}
          <div className="flex gap-2">
            <button
              onClick={onImportChat}
              className={classNames(
                'flex-1 flex items-center justify-center gap-1.5',
                'py-2 px-3 rounded-lg',
                'bg-bolt-elements-button-secondary-background',
                'hover:bg-[rgba(139,92,246,0.08)] hover:border-[rgba(139,92,246,0.2)] hover:text-purple-200',
                'text-bolt-elements-button-secondary-text text-xs font-medium',
                'border border-[rgba(139,92,246,0.12)]',
                'transition-all duration-200',
                'active:scale-[0.97]',
              )}
            >
              <div className="i-ph:chat-centered-dots text-sm" />
              Import Chat
            </button>
            <button
              onClick={onCloneRepo}
              className={classNames(
                'flex-1 flex items-center justify-center gap-1.5',
                'py-2 px-3 rounded-lg',
                'bg-bolt-elements-button-secondary-background',
                'hover:bg-[rgba(139,92,246,0.08)] hover:border-[rgba(139,92,246,0.2)] hover:text-purple-200',
                'text-bolt-elements-button-secondary-text text-xs font-medium',
                'border border-[rgba(139,92,246,0.12)]',
                'transition-all duration-200',
                'active:scale-[0.97]',
              )}
            >
              <div className="i-ph:git-clone text-sm" />
              Clone Repo
            </button>
          </div>
        </div>

        {/* Hint text */}
        <p className="text-[10px] text-purple-300/30 mt-6">or just start typing in the chat below</p>
      </div>
    );
  },
);

EmptyWorkspaceState.displayName = 'EmptyWorkspaceState';
