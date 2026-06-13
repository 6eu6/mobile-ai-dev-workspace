import { useStore } from '@nanostores/react';
import { memo, useCallback, useEffect, useState } from 'react';
import { MobileBottomTabs } from './MobileBottomTabs';
import { mobileActiveTab } from '~/lib/stores/mobile';
import { workbenchStore } from '~/lib/stores/workbench';
import { chatStore } from '~/lib/stores/chat';
import { ControlPanel } from '~/components/@settings/core/ControlPanel';

/**
 * MobileShell provides the mobile-specific UI layer.
 *
 * It renders:
 * 1. MobileBottomTabs — fixed bottom tab navigation
 * 2. A "spacer" div that adds bottom padding to the page content
 *    so nothing is hidden behind the tab bar.
 * 3. Quick action buttons for the "Actions" tab.
 *
 * The entire component is visible only on viewports < 640px
 * because MobileBottomTabs uses `sm:hidden` CSS class.
 *
 * SSR Safety:
 * - No `window.innerWidth` is read during render.
 * - The `useEffect` below syncs the tab state with the workbench
 *   visibility store, but only runs after mount (client-only).
 * - On first SSR render, the desktop layout is the stable fallback.
 *   The mobile shell's CSS `sm:hidden` ensures it is invisible on
 *   desktop regardless of JavaScript state.
 */
export const MobileShell = memo(() => {
  const activeTab = useStore(mobileActiveTab);
  const showWorkbench = useStore(workbenchStore.showWorkbench);

  /**
   * Sync mobile tab state with external store changes.
   *
   * When the workbench is shown by other code (e.g. after the first
   * AI response starts streaming), we auto-switch the active tab to
   * 'preview' so the tab bar reflects the actual UI state.
   *
   * When the workbench is hidden (user clicks the X button in the
   * workbench header), we switch back to 'chat' AND restore
   * chatStore.showChat so the chat panel is actually visible.
   */
  useEffect(() => {
    if (showWorkbench && activeTab === 'chat') {
      mobileActiveTab.set('preview');
    } else if (!showWorkbench && activeTab !== 'chat' && activeTab !== 'settings') {
      mobileActiveTab.set('chat');
      chatStore.setKey('showChat', true);
    }
  }, [showWorkbench, activeTab]);

  /**
   * On first mount on a mobile viewport, ensure the workbench is hidden
   * so the chat is the primary view. This runs only once.
   *
   * We check `window.innerWidth` inside useEffect (not render) to avoid
   * SSR/hydration mismatch. useEffect only runs client-side after mount.
   */
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      chatStore.setKey('showChat', true);
      workbenchStore.showWorkbench.set(false);
    }
  }, []);

  /**
   * BUG-1 FIX: When the viewport crosses from mobile (<640px) to desktop
   * (>=640px), restore the desktop-default store state so the chat panel
   * is visible. Without this, mobile tab clicks that set showChat=false
   * persist into the desktop layout, causing a blank screen.
   *
   * Uses matchMedia inside useEffect (SSR-safe, client-only) to listen
   * for the breakpoint crossing without polling or resize events.
   */
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) {
        chatStore.setKey('showChat', true);
        mobileActiveTab.set('chat');
      }
    };
    mq.addEventListener('change', handler);

    return () => mq.removeEventListener('change', handler);
  }, []);

  const handleExportZip = useCallback(() => {
    workbenchStore.downloadZip();
  }, []);

  const handleToggleTerminal = useCallback(() => {
    const current = workbenchStore.showTerminal.get();
    workbenchStore.toggleTerminal(!current);
  }, []);

  const isActionsTab = activeTab === 'actions';
  const isSettingsTab = activeTab === 'settings';

  /**
   * BUG-3 FIX: Settings dialog state for mobile.
   *
   * The sidebar's ControlPanel (Menu.client.tsx) uses local useState and
   * is hidden on mobile via CSS display:none. Rather than refactoring the
   * sidebar to use the shared Zustand store, we render a separate
   * ControlPanel instance here that is controlled by our own local state.
   *
   * This is safe because:
   * - ControlPanel uses a Radix Dialog portal, so it renders at the
   *   document root level regardless of where its React parent is.
   * - On desktop, the sidebar is visible and manages its own instance.
   * - On mobile, the sidebar is hidden so only this instance matters.
   * - Both instances cannot be open simultaneously because the sidebar
   *   is not interactive on mobile.
   */
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);

  // Open settings when the Settings tab is activated
  useEffect(() => {
    if (isSettingsTab) {
      setMobileSettingsOpen(true);
    }
  }, [isSettingsTab]);

  const handleCloseSettings = useCallback(() => {
    setMobileSettingsOpen(false);
    mobileActiveTab.set('chat');
  }, []);

  return (
    <>
      {/* Bottom tab navigation — hidden on desktop via sm:hidden */}
      <MobileBottomTabs />

      {/* Spacer: adds bottom padding on mobile so content isn't hidden behind the tab bar.
          Uses sm:hidden so the spacer only exists on mobile. */}
      <div className="h-[56px] sm:hidden" style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }} />

      {/* Quick Actions overlay — shown when Actions tab is active on mobile */}
      {isActionsTab && (
        <div
          className="fixed bottom-[56px] left-0 right-0 z-40 p-3 sm:hidden"
          style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="bg-bolt-elements-bg-depth-2 border border-bolt-elements-borderColor rounded-xl p-3 flex flex-col gap-2 shadow-lg">
            <h3 className="text-sm font-medium text-bolt-elements-textPrimary px-1">Quick Actions</h3>
            <button
              onClick={handleToggleTerminal}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text text-sm transition-colors"
            >
              <div className="i-ph:terminal" />
              Toggle Terminal
            </button>
            <button
              onClick={handleExportZip}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-bolt-elements-button-secondary-background hover:bg-bolt-elements-button-secondary-backgroundHover text-bolt-elements-button-secondary-text text-sm transition-colors"
            >
              <div className="i-ph:download-simple" />
              Export ZIP
            </button>
            {/* TODO: Fix current error — needs safe access to error state from workbenchStore */}
            <button
              disabled
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-bolt-elements-bg-depth-3 text-bolt-elements-textTertiary text-sm cursor-not-allowed opacity-60"
            >
              <div className="i-ph:warning-circle" />
              Fix Current Error
              <span className="ml-auto text-[10px]">(coming soon)</span>
            </button>
            {/* TODO: Revert last change — needs undo/history support in workbenchStore */}
            <button
              disabled
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-bolt-elements-bg-depth-3 text-bolt-elements-textTertiary text-sm cursor-not-allowed opacity-60"
            >
              <div className="i-ph:arrow-counter-clockwise" />
              Revert Last Change
              <span className="ml-auto text-[10px]">(coming soon)</span>
            </button>
          </div>
        </div>
      )}

      {/* BUG-3 FIX: Settings dialog for mobile.
          Rendered as a separate ControlPanel instance controlled by local
          state. The sidebar's ControlPanel is hidden on mobile, so this
          is the only way to access settings from the mobile shell.
          Wrapped in sm:hidden to avoid duplicate dialogs on desktop. */}
      <div className="sm:hidden">
        <ControlPanel open={mobileSettingsOpen} onClose={handleCloseSettings} />
      </div>
    </>
  );
});

MobileShell.displayName = 'MobileShell';
