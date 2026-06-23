/**
 * Event Emitter — writes job_events rows as the worker progresses.
 *
 * Each event has a type, a human-readable message, and an optional payload.
 * The frontend reads these (via /api/jobs?include=events) to show real-time
 * progress like:
 *
 *   ✓ Planning app structure
 *   ✓ Created index.html (284 lines)
 *   ✓ Created styles.css (502 lines)
 *   ⏳ Creating app.js...
 *   ○ Validating output
 *
 * See ROADMAP.md → Phase 2 → "job_events".
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger';

export type JobEventType =
  | 'job_created'
  | 'planning_started'
  | 'planning_completed'
  | 'file_generation_started'
  | 'file_written'
  | 'file_generation_completed'
  | 'validation_started'
  | 'validation_passed'
  | 'validation_failed'
  | 'upload_started'
  | 'file_uploaded'
  | 'snapshot_uploaded'
  | 'ready_for_preview'
  | 'job_failed';

export interface JobEventPayload {
  [key: string]: unknown;
}

/**
 * Emit a job event. Auto-increments the sequence number per job.
 */
export async function emitEvent(
  supabase: SupabaseClient,
  jobId: string,
  type: JobEventType,
  message: string,
  payload?: JobEventPayload,
): Promise<void> {
  // Get the current max seq for this job (cheap with the index).
  const { data: lastEvent } = await supabase
    .from('job_events')
    .select('seq')
    .eq('job_id', jobId)
    .order('seq', { ascending: false })
    .limit(1)
    .maybeSingle();

  const seq = (lastEvent?.seq ?? -1) + 1;

  const { error } = await supabase.from('job_events').insert({
    job_id: jobId,
    type,
    seq,
    message,
    payload: payload ?? null,
  });

  if (error) {
    logger.warn(`Failed to emit event ${type} for job ${jobId}:`, error.message);
  } else {
    logger.debug(`Event [${seq}] ${type}: ${message}`);
  }
}

/**
 * Emit a batch of events for a single file write.
 * Convenience wrapper.
 */
export async function emitFileWritten(
  supabase: SupabaseClient,
  jobId: string,
  filePath: string,
  lineCount: number,
  sizeBytes: number,
): Promise<void> {
  await emitEvent(supabase, jobId, 'file_written', `Created ${filePath} (${lineCount} lines)`, {
    filePath,
    lineCount,
    sizeBytes,
  });
}
