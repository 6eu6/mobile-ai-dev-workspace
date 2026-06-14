import { memo, type ReactNode } from 'react';
import { classNames } from '~/utils/classNames';

/**
 * ComposerBar
 *
 * Better mobile chat input wrapper.
 * - Provider/model compact display
 * - API key status indicator
 * - Attach, web, enhance, mic, send/stop buttons
 * - Send button clearly switches between send and stop during generation
 *
 * This is a wrapper/layout component — it renders children in a structured way.
 * The actual input and button logic come from the existing ChatBox.
 *
 * Usage:
 *   <ComposerBar
 *     providerName="OpenAI"
 *     modelName="gpt-4"
 *     hasApiKey={true}
 *     isStreaming={false}
 *     onSend={handleSend}
 *     onStop={handleStop}
 *   >
 *     <textarea ... />
 *   </ComposerBar>
 */

interface ComposerBarProps {
  children: ReactNode;

  /** Provider name for compact display */
  providerName?: string;

  /** Model name for compact display */
  modelName?: string;

  /** Whether API key is configured */
  hasApiKey?: boolean;

  /** Whether the model is currently streaming */
  isStreaming?: boolean;

  /** Send handler */
  onSend?: () => void;

  /** Stop handler */
  onStop?: () => void;

  /** Attachment button click */
  onAttach?: () => void;

  /** Web search button click */
  onWebSearch?: () => void;

  /** Enhance prompt button click */
  onEnhance?: () => void;

  /** Mic button click */
  onMic?: () => void;

  /** Is enhance in progress */
  enhancing?: boolean;

  /** Is mic active */
  isListening?: boolean;

  /** Action buttons slot — for full control */
  actionsSlot?: ReactNode;
  className?: string;
}

export const ComposerBar = memo(
  ({
    children,
    providerName,
    modelName,
    hasApiKey,
    isStreaming = false,
    onSend,
    onStop,
    onAttach,
    onWebSearch,
    onEnhance,
    onMic,
    enhancing,
    isListening,
    actionsSlot,
    className,
  }: ComposerBarProps) => {
    return (
      <div
        className={classNames(
          'relative w-full max-w-chat mx-auto',
          'bg-bolt-elements-prompt-background backdrop-blur-xl',
          'rounded-xl border border-bolt-elements-borderColor',
          'shadow-[0_2px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_20px_rgba(0,0,0,0.3)]',
          'transition-shadow duration-300',
          'hover:shadow-[0_4px_30px_var(--bolt-glow-color)]',
          'overflow-hidden',
          className,
        )}
      >
        {/* Provider/model compact header */}
        {(providerName || modelName) && (
          <div className="flex items-center gap-1.5 px-3 pt-2 pb-0.5">
            {providerName && (
              <span className="text-[10px] font-medium text-bolt-elements-textTertiary bg-bolt-elements-bg-depth-3/50 px-1.5 py-0.5 rounded">
                {providerName}
              </span>
            )}
            {modelName && (
              <span className="text-[10px] font-mono text-bolt-elements-textTertiary truncate">{modelName}</span>
            )}
            {hasApiKey !== undefined && (
              <div
                className={classNames(
                  'w-1.5 h-1.5 rounded-full shrink-0 ml-auto',
                  hasApiKey ? 'bg-green-500' : 'bg-red-500',
                )}
                title={hasApiKey ? 'API key configured' : 'API key missing'}
              />
            )}
          </div>
        )}

        {/* Input area */}
        <div className="px-2 py-1">{children}</div>

        {/* Action bar */}
        {actionsSlot ? (
          <div className="flex items-center gap-0.5 px-2 pb-2 pt-0.5">{actionsSlot}</div>
        ) : (
          <div className="flex items-center gap-0.5 px-2 pb-2 pt-0.5">
            {/* Attach */}
            {onAttach && <ComposerIconButton icon="i-ph:paperclip" label="Attach" onClick={onAttach} />}

            {/* Web search */}
            {onWebSearch && (
              <ComposerIconButton icon="i-ph:globe" label="Search" onClick={onWebSearch} disabled={isStreaming} />
            )}

            {/* Enhance */}
            {onEnhance && (
              <ComposerIconButton
                icon={enhancing ? 'i-svg-spinners:90-ring-with-bg' : 'i-bolt:stars'}
                label="Enhance"
                onClick={onEnhance}
                disabled={isStreaming}
                spinning={enhancing}
              />
            )}

            {/* Mic */}
            {onMic && (
              <ComposerIconButton
                icon="i-ph:microphone"
                label="Mic"
                onClick={onMic}
                active={isListening}
                disabled={isStreaming}
              />
            )}

            {/* Send / Stop */}
            <div className="ml-auto flex items-center">
              {isStreaming ? (
                <button
                  onClick={onStop}
                  className={classNames(
                    'flex items-center justify-center w-8 h-8 rounded-lg',
                    'bg-red-500/15 text-red-500 dark:text-red-400',
                    'border border-red-500/30',
                    'hover:bg-red-500/25 transition-all duration-200',
                    'active:scale-90',
                  )}
                  aria-label="Stop generation"
                >
                  <div className="i-ph:stop-fill text-sm" />
                </button>
              ) : (
                <button
                  onClick={onSend}
                  className={classNames(
                    'flex items-center justify-center w-8 h-8 rounded-lg',
                    'bg-gradient-to-r from-[var(--bolt-gradient-start)] to-[var(--bolt-gradient-mid)]',
                    'text-white',
                    'hover:shadow-[0_0_16px_var(--bolt-glow-color)]',
                    'transition-all duration-200',
                    'active:scale-90',
                  )}
                  aria-label="Send message"
                >
                  <div className="i-ph:arrow-up text-sm" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  },
);

ComposerBar.displayName = 'ComposerBar';

/** Compact icon button for the composer bar */
interface ComposerIconButtonProps {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  spinning?: boolean;
}

const ComposerIconButton = memo(({ icon, label, onClick, disabled, active, spinning }: ComposerIconButtonProps) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={classNames(
      'flex items-center justify-center w-8 h-8 rounded-lg',
      'text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary',
      'hover:bg-bolt-elements-bg-depth-3/50',
      'transition-all duration-150',
      'active:scale-90',
      'disabled:opacity-40 disabled:pointer-events-none',
      active && 'text-accent-500 dark:text-purple-400 bg-accent-500/10 dark:bg-purple-500/10',
      spinning && 'animate-spin',
    )}
    aria-label={label}
    title={label}
  >
    <div className={classNames(icon, 'text-lg')} />
  </button>
));

ComposerIconButton.displayName = 'ComposerIconButton';
