import { memo } from 'react';
import { classNames } from '~/utils/classNames';

/**
 * EmptyWorkspaceState
 *
 * Premium first-impression empty state for the AI workspace.
 * Dark developer-tool aesthetic with purple/violet accent system.
 * Designed to feel crafted, not dumped — with gradient text, floating logo,
 * glass morphism CTAs, and staggered entrance animations.
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
          'flex flex-col items-center justify-center',
          'px-[var(--bolt-space-6)] py-[var(--bolt-space-12)]',
          'min-h-[60dvh] w-full max-w-md mx-auto',
          'text-center',
          className,
        )}
      >
        {/* Logo / icon — floating with accent glow */}
        <div
          className={classNames(
            'w-16 h-16 rounded-[var(--bolt-radius-xl)]',
            'flex items-center justify-center',
            'mb-[var(--bolt-space-6)]',
            'bg-gradient-to-br from-[var(--bolt-gradient-start)] to-[var(--bolt-gradient-end)]',
            'shadow-[var(--bolt-shadow-accent-strong)]',
            'animate-float-subtle',
          )}
        >
          <div className="i-ph:lightning-fill text-4xl text-white" />
        </div>

        {/* Heading — gradient text */}
        <h1 className="text-[var(--bolt-text-2xl)] font-bold gradient-text mb-[var(--bolt-space-2)]">
          Start a Project
        </h1>

        {/* Description */}
        <p
          className={classNames(
            'text-[var(--bolt-text-sm)]',
            'text-[var(--bolt-mobile-text-secondary)]',
            'leading-[1.7]',
            'mb-[var(--bolt-space-8)]',
            'max-w-[300px]',
          )}
        >
          Describe what you want to build and the AI will generate a full project for you.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col gap-[var(--bolt-space-3)] w-full max-w-[280px]">
          {/* Primary CTA — full gradient */}
          <button
            onClick={onNewProject}
            className={classNames(
              'w-full flex items-center justify-center gap-2',
              'py-3 px-6 rounded-[var(--bolt-radius-md)]',
              'bg-gradient-to-r from-[var(--bolt-gradient-start)] to-[var(--bolt-gradient-mid)]',
              'text-white font-semibold text-[var(--bolt-text-md)]',
              'shadow-[var(--bolt-shadow-accent)]',
              'hover:shadow-[var(--bolt-shadow-accent-strong)]',
              'active:scale-[0.97]',
              'transition-all duration-[var(--bolt-duration-normal)]',
              'animate-fade-in-up',
              'opacity-0',
            )}
          >
            <div className="i-ph:plus-circle text-base" />
            Start New Project
          </button>

          {/* Secondary CTAs — glass morphism */}
          <div className="flex gap-[var(--bolt-space-2)]">
            <button
              onClick={onImportChat}
              className={classNames(
                'flex-1 flex items-center justify-center gap-1.5',
                'py-[var(--bolt-space-2)] px-[var(--bolt-space-3)]',
                'rounded-[var(--bolt-radius-md)]',
                'bg-[var(--bolt-mobile-accent-faint)]',
                'text-[var(--bolt-mobile-accent-text)] text-[var(--bolt-text-xs)] font-medium',
                'border border-[var(--bolt-mobile-surface-border)]',
                'hover:border-[var(--bolt-mobile-surface-border-strong)]',
                'hover:bg-[var(--bolt-mobile-accent-subtle)]',
                'active:scale-[0.97]',
                'transition-all duration-[var(--bolt-duration-normal)]',
                'animate-fade-in-up animation-delay-100',
                'opacity-0',
              )}
            >
              <div className="i-ph:chat-centered-dots text-sm" />
              Import Chat
            </button>
            <button
              onClick={onCloneRepo}
              className={classNames(
                'flex-1 flex items-center justify-center gap-1.5',
                'py-[var(--bolt-space-2)] px-[var(--bolt-space-3)]',
                'rounded-[var(--bolt-radius-md)]',
                'bg-[var(--bolt-mobile-accent-faint)]',
                'text-[var(--bolt-mobile-accent-text)] text-[var(--bolt-text-xs)] font-medium',
                'border border-[var(--bolt-mobile-surface-border)]',
                'hover:border-[var(--bolt-mobile-surface-border-strong)]',
                'hover:bg-[var(--bolt-mobile-accent-subtle)]',
                'active:scale-[0.97]',
                'transition-all duration-[var(--bolt-duration-normal)]',
                'animate-fade-in-up animation-delay-200',
                'opacity-0',
              )}
            >
              <div className="i-ph:git-clone text-sm" />
              Clone Repo
            </button>
          </div>
        </div>

        {/* Hint text */}
        <p className="text-[var(--bolt-text-2xs)] text-[var(--bolt-mobile-text-tertiary)] mt-[var(--bolt-space-8)]">
          or just start typing in the chat below
        </p>
      </div>
    );
  },
);

EmptyWorkspaceState.displayName = 'EmptyWorkspaceState';
