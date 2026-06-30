/**
 * Build Status Store — Phase 1 Ready-for-Preview Gate
 *
 * Single source of truth for the current build's validation state.
 * Populated from the `validation` annotations streamed by api.chat.ts
 * (see writeMessageAnnotation({type:'validation', ...}) in the route).
 *
 * The Preview component reads `buildStatus` to decide whether to render
 * the iframe or show the "No preview available" state. This is the GATE
 * that prevents partial/broken previews from reaching the user.
 *
 * See ROADMAP.md → Phase 1 → "Fix partial preview".
 */

import { atom, computed } from 'nanostores';

export type BuildCompleteness = 'complete' | 'incomplete' | 'garbage' | 'invalid' | 'unknown';
export type BuildJobStatus = 'generating' | 'incomplete_retrying' | 'failed_clean' | 'ready_for_preview' | 'idle';

export interface BuildStatusState {
  /** Latest completeness verdict from the validator. */
  completeness: BuildCompleteness;

  /** Mapped job status from api.chat.ts. */
  jobStatus: BuildJobStatus;

  /** Did the LLM emit __PALMKIT_DONE__? */
  hasCompletionMarker: boolean;

  /** Are all <palmkitArtifact> tags balanced? */
  artifactTagsBalanced: boolean;

  /** Are all <palmkitAction> tags balanced? */
  fileActionsBalanced: boolean;

  /** Number of file actions detected. */
  fileCount: number;

  /** Human-readable issues from the validator. */
  issues: Array<{ code: string; message: string; severity: 'error' | 'warning'; filePath?: string }>;

  /** Retry count so far. */
  retryCount: number;

  /** Timestamp of the last update (ms since epoch). */
  updatedAt: number;

  /** Phase 2: app type from the external worker (static/react/nextjs/vue/python). */
  appType: string | null;
}

const initial: BuildStatusState = {
  completeness: 'unknown',
  jobStatus: 'idle',
  hasCompletionMarker: false,
  artifactTagsBalanced: false,
  fileActionsBalanced: false,
  fileCount: 0,
  issues: [],
  retryCount: 0,
  updatedAt: 0,
  appType: null,
};

export const buildStatusStore = atom<BuildStatusState>(initial);

/**
 * Phase 2: Preview files from the external worker (R2).
 * When the worker completes a job, the frontend fetches files via /api/files
 * and populates this store. The Preview component reads it to build a blob URL.
 */
export const previewFilesStore = atom<Record<string, string>>({});

export function setPreviewFiles(files: Record<string, string>): void {
  previewFilesStore.set(files);
}

export function resetPreviewFiles(): void {
  previewFilesStore.set({});
}

/** Phase 8 — current Oracle Worker job ID (for export). */
export const currentJobIdStore = atom<string | null>(null);

export function setCurrentJobId(jobId: string | null): void {
  currentJobIdStore.set(jobId);
}

/** Phase 5 — real-time worker progress events shown in the chat panel. */
export interface WorkerEvent {
  type: string;
  seq: number;
  message: string;
  payload?: Record<string, unknown>;
  created_at: string;
}

export const workerEventsStore = atom<WorkerEvent[]>([]);

export function setWorkerEvents(events: WorkerEvent[]): void {
  workerEventsStore.set(events);
}

export function clearWorkerEvents(): void {
  workerEventsStore.set([]);
}

/*
 * Structured Todo item — published by the agent via the `update_todos` tool.
 * The agent sends the FULL list each time (not diffs), so we just keep the
 * latest snapshot per agent (Builder, Tester, Researcher).
 */
export interface AgentTodo {
  text: string;
  status: 'pending' | 'in_progress' | 'done';
}

export interface AgentTodoSnapshot {
  agent: string;
  todos: AgentTodo[];
  counts: { total: number; done: number; inProgress: number; pending: number };
  updatedAt: number;
}

/*
 * Latest todos snapshot PER agent. Key = agent name (e.g. "Builder").
 * When a new `todos_updated` event arrives, we replace the snapshot for that
 * agent (the agent always sends the full list, so this is correct).
 */
export const agentTodosStore = atom<Record<string, AgentTodoSnapshot>>({});

export function setAgentTodos(agent: string, todos: AgentTodo[], counts: AgentTodoSnapshot['counts']): void {
  const current = agentTodosStore.get();
  agentTodosStore.set({
    ...current,
    [agent]: { agent, todos, counts, updatedAt: Date.now() },
  });
}

export function clearAgentTodos(): void {
  agentTodosStore.set({});
}

/*
 * Reasoning text — emitted by the orchestrator as a `reasoning` event
 * between tool calls. Stored as a flat list per agent so the UI can render
 * a chronological "Thought Process" panel.
 */
export interface ReasoningEntry {
  agent: string;
  text: string;
  stepType?: string;
  timestamp: number;
  seq: number;
}

export const reasoningStore = atom<ReasoningEntry[]>([]);

export function appendReasoning(entry: ReasoningEntry): void {
  const current = reasoningStore.get();
  // Avoid duplicates by seq
  if (current.some((r) => r.seq === entry.seq)) {
    return;
  }
  reasoningStore.set([...current, entry]);
}

export function clearReasoning(): void {
  reasoningStore.set([]);
}

/*
 * Activity stream — groups of events per agent (Builder, Tester, Researcher).
 * Each group has a summary ("Explored X files, Wrote Y files, Ran Z commands")
 * and a list of inner events that can be expanded.
 */
export interface ActivityEvent {
  seq: number;
  type: string;
  message: string;
  kind?: string;
  path?: string;
  command?: string;
  timestamp: number;
}

export interface ActivityGroup {
  agent: string;
  role: string;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  success?: boolean;
  events: ActivityEvent[];
}

export const activityGroupsStore = atom<ActivityGroup[]>([]);

export function startActivityGroup(agent: string, role: string, startedAt: number): void {
  const current = activityGroupsStore.get();
  // Don't add a duplicate if the same agent already has an open group
  if (current.some((g) => g.agent === agent && !g.endedAt)) {
    return;
  }
  activityGroupsStore.set([
    ...current,
    { agent, role, startedAt, events: [] },
  ]);
}

export function appendActivityEvent(agent: string, event: ActivityEvent): void {
  const current = activityGroupsStore.get();
  // Find the latest open group for this agent
  const groupIdx = current.findIndex((g) => g.agent === agent && !g.endedAt);
  if (groupIdx === -1) {
    // No open group for this agent — create one on the fly
    activityGroupsStore.set([
      ...current,
      {
        agent,
        role: agent,
        startedAt: event.timestamp,
        events: [event],
      },
    ]);
    return;
  }
  const updated = [...current];
  updated[groupIdx] = {
    ...updated[groupIdx],
    events: [...updated[groupIdx].events, event],
  };
  activityGroupsStore.set(updated);
}

export function endActivityGroup(agent: string, endedAt: number, durationMs: number, success: boolean): void {
  const current = activityGroupsStore.get();
  const groupIdx = current.findIndex((g) => g.agent === agent && !g.endedAt);
  if (groupIdx === -1) {
    return;
  }
  const updated = [...current];
  updated[groupIdx] = {
    ...updated[groupIdx],
    endedAt,
    durationMs,
    success,
  };
  activityGroupsStore.set(updated);
}

export function clearActivityGroups(): void {
  activityGroupsStore.set([]);
}

/** Reset all real-time progress stores — called when a new chat starts. */
export function resetAllProgressStores(): void {
  workerEventsStore.set([]);
  agentTodosStore.set({});
  reasoningStore.set([]);
  activityGroupsStore.set([]);
}

/** Phase 10 — real progress percentage + step from the Oracle Worker. */
export interface WorkerProgress {
  progress: number;
  currentStep: string;
}

export const workerProgressStore = atom<WorkerProgress>({ progress: 0, currentStep: '' });

export function setWorkerProgress(progress: number, currentStep: string): void {
  workerProgressStore.set({ progress, currentStep });
}

export function resetWorkerProgress(): void {
  workerProgressStore.set({ progress: 0, currentStep: '' });
}

/**
 * Update the store from a validation annotation value.
 * Called by Chat.client.tsx when it sees a `type: 'validation'` annotation.
 */
export function setBuildStatus(payload: Partial<BuildStatusState>): void {
  const current = buildStatusStore.get();
  buildStatusStore.set({
    ...current,
    ...payload,
    updatedAt: Date.now(),
  });
}

/** Reset to idle — called when a new chat starts. */
export function resetBuildStatus(): void {
  buildStatusStore.set({ ...initial, updatedAt: Date.now() });
}

/**
 * Computed: is it SAFE to show the preview?
 *
 * The gate is CLOSED (preview blocked) unless ALL of:
 *   - completeness === 'complete'
 *   - hasCompletionMarker === true
 *   - artifactTagsBalanced === true
 *   - fileActionsBalanced === true
 *   - fileCount > 0
 *
 * Any other state → show "No preview available" + the status message.
 */
export const canShowPreview = computed(buildStatusStore, (status) => {
  // Before any build has run, allow the normal "no preview" state.
  if (status.jobStatus === 'idle') {
    return true;
  }

  return (
    status.completeness === 'complete' &&
    status.hasCompletionMarker &&
    status.artifactTagsBalanced &&
    status.fileActionsBalanced &&
    status.fileCount > 0
  );
});

/**
 * Computed: human-readable status message for the UI.
 * Returns null when there's nothing to show (idle or complete).
 */
export const buildStatusMessage = computed(buildStatusStore, (status) => {
  switch (status.jobStatus) {
    case 'idle':
      return null;
    case 'generating':
      return 'Generating Response';
    case 'incomplete_retrying':
      return `Still building… (attempt ${status.retryCount + 1})`;
    case 'failed_clean':
      return status.issues[0]?.message || 'Build incomplete — stream was interrupted. Please try again.';
    case 'ready_for_preview': {
      const appType = status.appType;

      if (appType === 'flutter') {
        return 'Flutter app ready — run: flutter pub get && flutter run';
      }

      if (appType === 'react-native') {
        return 'React Native app ready — run: npx expo start';
      }

      if (appType && appType !== 'static') {
        return `${appType} app ready — download files and run: npm install && npm run dev`;
      }

      return 'Build complete — ready for preview';
    }
    default:
      return null;
  }
});
