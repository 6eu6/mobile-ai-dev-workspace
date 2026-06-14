import { useStore } from '@nanostores/react';
import { memo, useCallback, useEffect, useState } from 'react';
import { MobileActionDock } from '~/components/ui/workspace/MobileActionDock';
import { ProjectSwitcherDrawer } from '~/components/ui/workspace/ProjectSwitcherDrawer';
import { mobileActiveTab } from '~/lib/stores/mobile';
import { workbenchStore } from '~/lib/stores/workbench';
import { chatStore } from '~/lib/stores/chat';
import { ControlPanel } from '~/components/@settings/core/ControlPanel';

export const MobileShell = memo(() => {
  const activeTab = useStore(mobileActiveTab);
  const showWorkbench = useStore(workbenchStore.showWorkbench);

  useEffect(() => {
    if (showWorkbench && activeTab === 'chat') {
      mobileActiveTab.set('preview');
    } else if (!showWorkbench && activeTab !== 'chat' && activeTab !== 'settings' && activeTab !== 'projects') {
      mobileActiveTab.set('chat');
      chatStore.setKey('showChat', true);
    }
  }, [showWorkbench, activeTab]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      chatStore.setKey('showChat', true);
      workbenchStore.showWorkbench.set(false);
    }
  }, []);

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

  const isSettingsTab = activeTab === 'settings';
  const isProjectsTab = activeTab === 'projects';

  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [mobileProjectsOpen, setMobileProjectsOpen] = useState(false);

  useEffect(() => {
    if (isSettingsTab) {
      setMobileSettingsOpen(true);
    }
  }, [isSettingsTab]);

  useEffect(() => {
    if (isProjectsTab) {
      setMobileProjectsOpen(true);
    }
  }, [isProjectsTab]);

  const handleCloseSettings = useCallback(() => {
    setMobileSettingsOpen(false);
    mobileActiveTab.set('chat');
  }, []);

  const handleCloseProjects = useCallback(() => {
    setMobileProjectsOpen(false);
    mobileActiveTab.set('chat');
  }, []);

  return (
    <>
      <MobileActionDock />

      {/* Bottom spacer: pushes content above the dock */}
      <div className="sm:hidden shrink-0" style={{ height: 'var(--bolt-mobile-dock-height)' }} />

      {/* Workbench floating action bar */}
      {showWorkbench && (
        <div className="fixed left-2 right-2 z-40 sm:hidden">
          <div
            className="flex items-center gap-2 p-2 rounded-xl backdrop-blur-xl"
            style={{
              background: 'var(--bolt-mobile-surface-bg-elevated)',
              boxShadow: 'var(--bolt-shadow-md)',
              border: '1px solid var(--bolt-mobile-surface-border)',
            }}
          >
            <button
              onClick={handleToggleTerminal}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium active:scale-[0.95]"
              style={{
                background: 'var(--bolt-mobile-accent-muted)',
                color: 'var(--bolt-mobile-accent-text)',
                border: '1px solid var(--bolt-mobile-surface-border)',
                transition: 'transform var(--bolt-duration-fast) var(--bolt-ease-default)',
              }}
            >
              <div className="i-ph:terminal-window text-sm" />
              Terminal
            </button>
            <button
              onClick={handleExportZip}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium active:scale-[0.95]"
              style={{
                background: 'var(--bolt-mobile-accent-faint)',
                color: 'var(--bolt-mobile-text-secondary)',
                border: '1px solid var(--bolt-mobile-surface-border)',
                transition: 'transform var(--bolt-duration-fast) var(--bolt-ease-default)',
              }}
            >
              <div className="i-ph:download-simple text-sm" />
              Export ZIP
            </button>
          </div>
        </div>
      )}

      <div className="sm:hidden">
        <ControlPanel open={mobileSettingsOpen} onClose={handleCloseSettings} />
      </div>

      <div className="sm:hidden">
        <ProjectSwitcherDrawer open={mobileProjectsOpen} onClose={handleCloseProjects} />
      </div>
    </>
  );
});

MobileShell.displayName = 'MobileShell';
