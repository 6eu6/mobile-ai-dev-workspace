import { useStore } from '@nanostores/react';
import { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { mobileActiveTab, type MobileTab } from '~/lib/stores/mobile';
import { workbenchStore } from '~/lib/stores/workbench';
import { chatStore } from '~/lib/stores/chat';
import { classNames } from '~/utils/classNames';

/**
 * MobileActionDock
 *
 * Polished mobile dock replacing MobileBottomTabs.
 * 5 actions: Chat, Preview, Files, Actions, Settings
 * Compact icons and labels, safe-area aware, no white square blocks.
 * Active state is clear but elegant.
 *
 * Usage:
 *   <MobileActionDock />
 */

const DOCK_ITEMS: { id: MobileTab; label: string; icon: string; iconActive: string }[] = [
  { id: 'chat', label: 'Chat', icon: 'i-ph:chat-circle-text', iconActive: 'i-ph:chat-circle-text-bold' },
  { id: 'preview', label: 'Preview', icon: 'i-ph:play', iconActive: 'i-ph:play-bold' },
  { id: 'files', label: 'Code', icon: 'i-ph:code', iconActive: 'i-ph:code-bold' },
  { id: 'actions', label: 'Actions', icon: 'i-ph:terminal', iconActive: 'i-ph:terminal-bold' },
  { id: 'settings', label: 'Settings', icon: 'i-ph:gear-six', iconActive: 'i-ph:gear-six-bold' },
];

export const MobileActionDock = memo(() => {
  const activeTab = useStore(mobileActiveTab);

  const handleTabChange = useCallback((tab: MobileTab) => {
    mobileActiveTab.set(tab);

    switch (tab) {
      case 'chat':
        chatStore.setKey('showChat', true);
        workbenchStore.showWorkbench.set(false);
        break;
      case 'preview':
        chatStore.setKey('showChat', false);
        workbenchStore.showWorkbench.set(true);
        workbenchStore.currentView.set('preview');
        break;
      case 'files':
        chatStore.setKey('showChat', false);
        workbenchStore.showWorkbench.set(true);
        workbenchStore.currentView.set('code');
        break;
      case 'actions':
        chatStore.setKey('showChat', false);
        workbenchStore.showWorkbench.set(true);
        workbenchStore.currentView.set('code');
        workbenchStore.toggleTerminal(true);
        break;
      case 'projects':
        break;
      case 'settings':
        break;
    }
  }, []);

  return (
    <div
      className={classNames(
        'fixed bottom-0 left-0 right-0 z-50 sm:hidden',
        'bg-bolt-elements-bg-depth-1/80 dark:bg-[#0a0a0f]/85',
        'backdrop-blur-2xl',
        'border-t border-bolt-elements-borderColor/40',
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Subtle top glow line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, var(--bolt-gradient-mid) 50%, transparent)',
          opacity: 0.3,
        }}
      />

      <div className="flex items-center justify-around px-1 pt-1 pb-1">
        {DOCK_ITEMS.map((item) => {
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={classNames(
                'relative flex flex-col items-center justify-center',
                'min-w-[48px] min-h-[44px]',
                'rounded-xl transition-all duration-200 outline-none',
                'active:scale-90',
                isActive
                  ? 'text-accent-500 dark:text-purple-400'
                  : 'text-bolt-elements-textTertiary active:text-bolt-elements-textSecondary',
              )}
              aria-label={item.label}
              aria-pressed={isActive}
            >
              {/* Active background pill */}
              {isActive && (
                <motion.div
                  className="absolute inset-1 rounded-lg bg-accent-500/8 dark:bg-purple-500/10"
                  layoutId="dockActivePill"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}

              {/* Icon */}
              <div className="relative z-1">
                <div
                  className={classNames(
                    isActive ? item.iconActive : item.icon,
                    'text-[18px] transition-all duration-200',
                    isActive && 'drop-shadow-[0_0_6px_var(--bolt-glow-color)]',
                  )}
                />
              </div>

              {/* Label */}
              <span
                className={classNames(
                  'relative z-1 text-[9px] mt-0.5 leading-tight font-medium transition-all duration-200',
                  isActive ? 'text-accent-500 dark:text-purple-400' : 'text-bolt-elements-textTertiary',
                )}
              >
                {item.label}
              </span>

              {/* Active indicator dot */}
              {isActive && (
                <motion.div
                  className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent-500 dark:bg-purple-400"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  style={{
                    boxShadow: '0 0 6px var(--bolt-glow-color-strong)',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});

MobileActionDock.displayName = 'MobileActionDock';
