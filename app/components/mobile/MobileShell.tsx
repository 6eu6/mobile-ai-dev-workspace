import { useStore } from '@nanostores/react';
import { memo, useCallback, useEffect, useState } from 'react';
import { MobileActionDock } from '~/components/ui/workspace/MobileActionDock';
import { ProjectSwitcherDrawer } from '~/components/ui/workspace/ProjectSwitcherDrawer';
import { mobileActiveTab } from '~/lib/stores/mobile';
import { workbenchStore } from '~/lib/stores/workbench';
import { chatStore } from '~/lib/stores/chat';
import { ControlPanel } from '~/components/@settings/core/ControlPanel';
import { classNames } from '~/utils/classNames';

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
      <div className="mobile-dock-spacer sm:hidden shrink-0" />

      {/* Workbench floating action bar */}
      {showWorkbench && (
        <div className="mobile-workbench-float-bar fixed left-2 right-2 z-40 sm:hidden">
          <div
            className={classNames(
              'flex items-center gap-2 p-2 rounded-xl',
              'shadow-lg shadow-black/20',
              'border border-[rgba(139,92,246,0.1)]',
              'bg-[rgba(8,8,16,0.92)] backdrop-blur-xl',
            )}
          >
            <button
              onClick={handleToggleTerminal}
              className={classNames(
                'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium',
                'bg-gradient-to-br from-[rgba(139,92,246,0.14)] to-[rgba(168,85,247,0.08)]',
                'text-purple-300 border border-[rgba(139,92,246,0.18)]',
                'active:scale-[0.97] transition-transform duration-150',
              )}
            >
              <div className="i-ph:terminal-window text-sm" />
              Terminal
            </button>
            <button
              onClick={handleExportZip}
              className={classNames(
                'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium',
                'bg-[rgba(255,255,255,0.04)] text-gray-400',
                'border border-[rgba(255,255,255,0.06)]',
                'active:scale-[0.97] transition-transform duration-150',
              )}
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
