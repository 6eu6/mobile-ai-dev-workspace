/**
 * Sandbox hook — connects worker-built files to E2B cloud sandbox.
 *
 * E2B is the ONLY sandbox for ALL devices (desktop + mobile + tablet).
 * WebContainer was removed because it doesn't work on mobile and requires
 * SharedArrayBuffer which many browsers lack.
 *
 * Routing:
 *   static                → blob URL (handled in Preview.tsx, not here)
 *   react / vue / nextjs  → E2B sandbox (npm install + npm run dev)
 *   python                → E2B sandbox (python app.py)
 *   flutter / react-native → E2B sandbox (if web build available)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { buildStatusStore } from '~/lib/stores/build-status';
import { previewFilesStore } from '~/lib/stores/build-status';
import {
  isRemoteSandboxAvailable,
  createRemoteSandbox,
  pushFiles,
  startRemoteSandbox,
  checkRemoteStatus,
} from '~/lib/sandbox/remoteSandbox';

export type SandboxRunState = 'idle' | 'writing' | 'installing' | 'starting' | 'ready' | 'error';

export interface WorkerSandboxResult {
  sandboxState: SandboxRunState;
  sandboxUrl: string | undefined;
  sandboxError: string | undefined;
  launchSandbox: () => void;
  usesMobileE2B: boolean;
  canUseSandbox: boolean;
}

/*
 * E2B is the ONLY sandbox for all devices and all app types.
 * WebContainer was removed because:
 * 1. It doesn't work on mobile (the primary target for Palmkit)
 * 2. It requires SharedArrayBuffer / COOP-COEP which many browsers lack
 * 3. It's unreliable in headless / embedded webviews
 *
 * E2B works everywhere — desktop, mobile, tablet — because it's a cloud
 * sandbox. The user clicks "Launch Preview" → E2B starts → npm install →
 * npm run dev → preview URL is served back.
 */
const E2B_TYPES = new Set(['react', 'vue', 'nextjs', 'python', 'flutter', 'react-native']);

export function useWorkerSandbox(): WorkerSandboxResult {
  const buildStatus = useStore(buildStatusStore);

  const [sandboxState, setSandboxState] = useState<SandboxRunState>('idle');
  const [sandboxUrl, setSandboxUrl] = useState<string | undefined>();
  const [sandboxError, setSandboxError] = useState<string | undefined>();
  const [usesMobileE2B, setUsesMobileE2B] = useState(false);

  const launchRef = useRef(false);
  const prevJobRef = useRef(buildStatus.jobStatus);

  const appType = buildStatus.appType ?? '';
  const canUseSandbox = Boolean(appType && E2B_TYPES.has(appType));

  // Reset sandbox when a new job starts generating.
  useEffect(() => {
    if (buildStatus.jobStatus === 'generating' && prevJobRef.current !== 'generating') {
      setSandboxState('idle');
      setSandboxUrl(undefined);
      setSandboxError(undefined);
      launchRef.current = false;
    }

    prevJobRef.current = buildStatus.jobStatus;
  }, [buildStatus.jobStatus]);

  const doLaunch = useCallback(async () => {
    if (launchRef.current) {
      return;
    }

    const files = previewFilesStore.get();

    if (Object.keys(files).length === 0) {
      return;
    }

    const type = buildStatusStore.get().appType;

    if (!type) {
      return;
    }

    launchRef.current = true;
    setSandboxError(undefined);

    try {
      // E2B for ALL devices and ALL app types (no WebContainer)
      setUsesMobileE2B(true);
      await _runInE2B(files, type, setSandboxState, setSandboxUrl, setSandboxError);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSandboxError(msg);
      setSandboxState('error');
    } finally {
      launchRef.current = false;
    }
  }, []);

  /*
   * NO auto-launch — sandbox only starts when user clicks "Launch Preview".
   *
   * Previously, the sandbox auto-launched on page load for desktop WebContainer
   * types. This caused:
   * - "جاري تشغيل الساندبوكس" appearing immediately on chat open (bad UX)
   * - Resource waste (sandbox boots even if user just wants to read code)
   * - Mobile users seeing sandbox errors before touching Preview tab
   *
   * Now: sandbox is LAZY — only boots when user explicitly clicks the
   * "Launch Preview" button in the Preview tab.
   */

  const launchSandbox = useCallback(() => {
    doLaunch().catch(console.error);
  }, [doLaunch]);

  return { sandboxState, sandboxUrl, sandboxError, launchSandbox, usesMobileE2B, canUseSandbox };
}

async function _runInE2B(
  files: Record<string, string>,
  appType: string,
  setState: (s: SandboxRunState) => void,
  setUrl: (u: string) => void,
  setError: (e: string) => void,
): Promise<void> {
  const available = await isRemoteSandboxAvailable();

  if (!available) {
    setError('Cloud preview is not configured. Download the project files to run locally.');
    setState('error');

    return;
  }

  setState('writing');

  const sandbox = await createRemoteSandbox(appType);
  await pushFiles(sandbox.id, files);

  setState('installing');

  const previewUrl = await startRemoteSandbox(sandbox.id, { port: 3000 });

  setState('starting');

  // Poll until the cloud dev server responds (up to ~160s).
  for (let i = 0; i < 40; i++) {
    if (await checkRemoteStatus(sandbox.id, 3000)) {
      break;
    }

    await new Promise((r) => setTimeout(r, 4000));
  }

  setUrl(previewUrl);
  setState('ready');
}
