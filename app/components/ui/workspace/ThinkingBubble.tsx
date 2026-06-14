import { memo } from 'react';
import { classNames } from '~/utils/classNames';

/**
 * ThinkingBubble
 *
 * Small assistant thinking indicator. Three dots with a subtle wave animation.
 * Should feel polished and lightweight.
 *
 * Usage:
 *   <ThinkingBubble />
 *   <ThinkingBubble size="sm" />
 */

interface ThinkingBubbleProps {
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  sm: { wrapper: 'gap-[3px] py-1.5 px-3', dot: 'w-[4px] h-[4px]' },
  md: { wrapper: 'gap-[4px] py-2 px-4', dot: 'w-[5px] h-[5px]' },
  lg: { wrapper: 'gap-[5px] py-2.5 px-5', dot: 'w-[6px] h-[6px]' },
};

export const ThinkingBubble = memo(({ size = 'md', className }: ThinkingBubbleProps) => {
  const sizeConfig = SIZE_MAP[size];

  return (
    <div
      className={classNames(
        'inline-flex items-center rounded-2xl',
        'bg-bolt-elements-bg-depth-2/80 dark:bg-bolt-elements-bg-depth-2/60',
        'border border-bolt-elements-borderColor/40',
        'backdrop-blur-sm',
        sizeConfig.wrapper,
        className,
      )}
      role="status"
      aria-label="Assistant is thinking"
    >
      <span
        className={classNames(sizeConfig.dot, 'rounded-full bg-accent-400 dark:bg-purple-400 opacity-80')}
        style={{ animation: 'thinkingBubbleDot 1.4s ease-in-out infinite', animationDelay: '0ms' }}
      />
      <span
        className={classNames(sizeConfig.dot, 'rounded-full bg-accent-400 dark:bg-purple-400 opacity-80')}
        style={{ animation: 'thinkingBubbleDot 1.4s ease-in-out infinite', animationDelay: '160ms' }}
      />
      <span
        className={classNames(sizeConfig.dot, 'rounded-full bg-accent-400 dark:bg-purple-400 opacity-80')}
        style={{ animation: 'thinkingBubbleDot 1.4s ease-in-out infinite', animationDelay: '320ms' }}
      />
    </div>
  );
});

ThinkingBubble.displayName = 'ThinkingBubble';
