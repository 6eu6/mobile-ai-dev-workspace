import { useStore } from '@nanostores/react';
import { memo, useCallback } from 'react';
import { mobileActiveTab, type MobileTab } from '~/lib/stores/mobile';
import { workbenchStore } from '~/lib/stores/workbench';
import { chatStore } from '~/lib/stores/chat';
import { classNames } from '~/utils/classNames';

const tabs: { id: MobileTab; label: string; icon: string }[] = [
  { id: 'chat', label: 'Chat', icon: 'i-ph:chat-circle-text' },
  { id: 'preview', label: 'Preview', icon: 'i-ph:eye' },
  { id: 'files', label: 'Files', icon: 'i-ph:folder-open' },
  { id: 'actions', label: 'Actions', icon: 'i-ph:lightning' },
  { id: 'settings', label: 'Settings', icon: 'i-ph:gear-six' },
];

/**
 * Bottom tab navigation for mobile viewport.
 *
 * This component is always rendered in the DOM but hidden on screens >= 640px
 * via the CSS class `sm:hidden`. This avoids any SSR/hydration mismatch
 * because no JavaScript viewport detection is used for the show/hide logic.
 *
 * Tab clicks update shared nanostores (chatStore, workbenchStore) which
 * also drive the desktop layout. On desktop the stores have no visible
 * effect from this component because the component itself is hidden.
 */
export const MobileBottomTabs = memo(() => {
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
      case 'settings':
        /*
         * Settings dialog is opened by MobileShell when this tab activates.
         * We only set the active tab here; MobileShell's useEffect opens
         * the ControlPanel instance it renders for mobile.
         */
        break;
    }
  }, []);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around bg-bolt-elements-bg-depth-2 border-t border-bolt-elements-borderColor sm:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => handleTabChange(tab.id)}
          className={classNames(
            'flex flex-col items-center justify-center py-2 px-3 min-w-[48px] min-h-[48px] transition-colors outline-none',
            activeTab === tab.id
              ? 'text-accent-500'
              : 'text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary',
          )}
          aria-label={tab.label}
          aria-pressed={activeTab === tab.id}
        >
          <div className={classNames(tab.icon, 'text-xl')} />
          <span className="text-[10px] mt-0.5 leading-tight">{tab.label}</span>
        </button>
      ))}
    </div>
  );
});

MobileBottomTabs.displayName = 'MobileBottomTabs';
