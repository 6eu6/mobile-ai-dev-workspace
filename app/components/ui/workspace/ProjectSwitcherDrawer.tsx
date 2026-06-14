import { memo, useCallback, useEffect, useState } from 'react';
import { useNavigate } from '@remix-run/react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { db, getAll, deleteById, getSnapshot, type ChatHistoryItem } from '~/lib/persistence';
import { chatId } from '~/lib/persistence';
import { binDates } from '~/components/sidebar/date-binning';
import { classNames } from '~/utils/classNames';

/**
 * ProjectSwitcherDrawer
 *
 * Mobile-friendly project list drawer.
 * - New Project button
 * - Recent Projects with date binning
 * - Project item: title, last updated, status badge
 * - Delete and open actions
 * - Should not break current IndexedDB logic
 *
 * Usage:
 *   <ProjectSwitcherDrawer open={open} onClose={onClose} />
 */

type ProjectStatus = 'saved' | 'generating' | 'interrupted';

interface ProjectItem extends ChatHistoryItem {
  status: ProjectStatus;
}

interface ProjectSwitcherDrawerProps {
  open: boolean;
  onClose: () => void;
}

const DRAWER_VARIANTS = {
  hidden: { y: '100%' },
  visible: { y: 0 },
  exit: { y: '100%' },
};

const OVERLAY_VARIANTS = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

export const ProjectSwitcherDrawer = memo(({ open, onClose }: ProjectSwitcherDrawerProps) => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectItem[]>([]);

  const loadProjects = useCallback(async () => {
    if (!db) {
      return;
    }

    try {
      const dbInstance = db;
      const chats = await getAll(dbInstance);
      const withStatus: ProjectItem[] = await Promise.all(
        chats
          .filter((item) => item.urlId && item.description)
          .map(async (item) => {
            let status: ProjectStatus = 'saved';

            try {
              const snapshot = await getSnapshot(dbInstance, item.id);

              if (snapshot && snapshot.files && Object.keys(snapshot.files).length > 0) {
                const lastMsg = item.messages[item.messages.length - 1];

                if (lastMsg?.role === 'assistant' && lastMsg.content) {
                  const hasArtifact = lastMsg.content.includes('<boltArtifact');
                  const hasClose = lastMsg.content.includes('</boltArtifact>');

                  if (hasArtifact && !hasClose) {
                    status = 'interrupted';
                  }
                }
              }
            } catch {
              // ignore snapshot errors
            }

            return { ...item, status };
          }),
      );

      withStatus.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setProjects(withStatus);
    } catch (error) {
      toast.error('Failed to load projects');
      console.error(error);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadProjects();
    }
  }, [open, loadProjects]);

  const handleOpenProject = (item: ChatHistoryItem) => {
    const targetUrl = item.urlId ? `/chat/${item.urlId}` : `/chat/${item.id}`;
    navigate(targetUrl);
    onClose();
  };

  const handleDeleteProject = async (event: React.UIEvent, item: ChatHistoryItem) => {
    event.stopPropagation();

    if (!db) {
      return;
    }

    try {
      await deleteById(db, item.id);

      if (chatId.get() === item.id) {
        window.location.pathname = '/';
      } else {
        loadProjects();
        toast.success('Project deleted');
      }
    } catch (error) {
      toast.error('Failed to delete project');
      console.error(error);
    }
  };

  const handleNewProject = () => {
    navigate('/');
    onClose();
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'Just now';
    }

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    }

    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }

    if (diffDays < 7) {
      return `${diffDays}d ago`;
    }

    return date.toLocaleDateString();
  };

  const renderStatusBadge = (status: ProjectStatus) => {
    switch (status) {
      case 'generating':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-accent-500/10 dark:bg-purple-500/15 text-accent-600 dark:text-purple-300 border border-[rgba(139,92,246,0.2)]">
            <span className="w-1 h-1 rounded-full bg-accent-500 dark:bg-purple-400 animate-pulse" />
            Generating
          </span>
        );
      case 'interrupted':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-[rgba(251,191,36,0.2)]">
            <span className="w-1 h-1 rounded-full bg-amber-500 dark:bg-amber-400" />
            Interrupted
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 dark:bg-green-500/15 text-green-600 dark:text-green-300 border border-[rgba(74,222,128,0.2)]">
            <span className="w-1 h-1 rounded-full bg-green-500 dark:bg-green-400" />
            Saved
          </span>
        );
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[998] bg-black/50 backdrop-blur-sm"
            variants={OVERLAY_VARIANTS}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            className={classNames(
              'fixed inset-x-0 bottom-0 z-[999] flex flex-col',
              'bg-[rgba(10,10,18,0.98)]',
              'border-t border-bolt-elements-borderColor/60',
              'rounded-t-2xl',
              'shadow-[0_-8px_40px_rgba(0,0,0,0.5)]',
            )}
            style={{ maxHeight: '85dvh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            variants={DRAWER_VARIANTS}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            {/* Top border accent */}
            <div
              className="absolute top-0 left-0 right-0 h-px pointer-events-none"
              style={{
                background:
                  'linear-gradient(90deg, transparent 5%, var(--bolt-gradient-start) 30%, var(--bolt-gradient-mid) 50%, var(--bolt-gradient-end) 70%, transparent 95%)',
                opacity: 0.35,
              }}
            />

            {/* Drag handle */}
            <div className="flex justify-center pt-2.5 pb-1">
              <div className="w-8 h-1 rounded-full bg-[rgba(139,92,246,0.2)]" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3">
              <h2 className="text-base font-semibold text-bolt-elements-textPrimary">Projects</h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-[rgba(139,92,246,0.08)] hover:text-purple-300 text-bolt-elements-textTertiary transition-colors active:scale-95"
                aria-label="Close"
              >
                <div className="i-ph:x text-base" />
              </button>
            </div>

            {/* New project button */}
            <div className="px-5 pb-3">
              <button
                onClick={handleNewProject}
                className={classNames(
                  'w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5',
                  'bg-gradient-to-r from-[var(--bolt-gradient-start)] to-[var(--bolt-gradient-mid)]',
                  'text-white font-medium text-sm',
                  'hover:shadow-[0_0_20px_var(--bolt-glow-color)]',
                  'transition-all duration-200 active:scale-[0.98]',
                )}
              >
                <div className="i-ph:plus-circle text-base" />
                New Project
              </button>
            </div>

            {/* Project list */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-bolt-elements-textTertiary">
                  <div className="i-ph:folder-open text-4xl mb-3 opacity-40" />
                  <p className="text-sm">No projects yet</p>
                  <p className="text-xs mt-1 opacity-60">Start a new project to begin</p>
                </div>
              ) : (
                <div className="pb-4">
                  {binDates(projects).map(({ category, items }) => (
                    <div key={category}>
                      <div className="px-5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-purple-300/30 sticky top-0 bg-[rgba(10,10,18,0.95)] backdrop-blur-sm z-1">
                        {category}
                      </div>
                      {(items as ProjectItem[]).map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleOpenProject(item)}
                          className={classNames(
                            'w-full text-left px-5 py-3 transition-colors group flex items-start gap-3',
                            'hover:bg-[rgba(139,92,246,0.06)] active:bg-[rgba(139,92,246,0.1)]',
                          )}
                        >
                          {/* Project icon */}
                          <div className="w-8 h-8 rounded-lg bg-accent-500/10 dark:bg-purple-500/10 flex items-center justify-center shrink-0 mt-0.5">
                            <div className="i-ph:code text-sm text-accent-500 dark:text-purple-400" />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-bolt-elements-textPrimary truncate">
                              {item.description || 'Untitled Project'}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-bolt-elements-textTertiary">
                                {formatTime(item.timestamp)}
                              </span>
                              {renderStatusBadge(item.status)}
                            </div>
                          </div>

                          {/* Delete */}
                          <button
                            onClick={(e) => handleDeleteProject(e, item)}
                            className={classNames(
                              'opacity-0 group-hover:opacity-100 p-1.5 rounded-lg shrink-0',
                              'hover:bg-[rgba(248,113,113,0.1)] text-bolt-elements-textTertiary hover:text-red-400',
                              'transition-all active:scale-95',
                            )}
                            title="Delete project"
                          >
                            <div className="i-ph:trash text-sm" />
                          </button>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});

ProjectSwitcherDrawer.displayName = 'ProjectSwitcherDrawer';
