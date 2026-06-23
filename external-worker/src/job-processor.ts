/**
 * Job Processor — Phase 2 Skeleton
 *
 * Picks up a pending build_job from Supabase, claims it atomically, and runs
 * the generation pipeline:
 *
 *   1. plan          — LLM generates project_spec (features, stack, file tree)
 *   2. generate      — for each file in the tree, LLM generates full content
 *   3. validate      — run output-validator on each file
 *   4. repair        — if any file fails validation, LLM patches it
 *   5. finalize      — write all files to R2, manifest to Supabase,
 *                      set job status = ready_for_preview
 *
 * Each step is recorded in build_steps with status + summary.
 *
 * This file is a SKELETON — steps 1-5 are stubbed with TODOs that will be
 * implemented in subsequent commits as we migrate logic from api.chat.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger';

interface BuildJob {
  id: string;
  project_id: string | null;
  user_id: string;
  status: string;
  current_step: string | null;
  progress: number;
  retry_count: number;
}

/**
 * Atomically claim the next pending job.
 *
 * Uses a Supabase RPC that does:
 *   UPDATE build_jobs
 *   SET status = 'generating', current_step = 'claim'
 *   WHERE id = (
 *     SELECT id FROM build_jobs
 *     WHERE status = 'pending'
 *     ORDER BY created_at
 *     FOR UPDATE SKIP LOCKED
 *     LIMIT 1
 *   )
 *   RETURNING *;
 *
 * The SKIP LOCKED ensures multiple workers don't grab the same job.
 *
 * TODO: create this RPC in migration 0007. For now, we do a two-step
 * select-then-update which is NOT atomic but works for a single worker.
 */
async function claimNextJob(supabase: SupabaseClient): Promise<BuildJob | null> {
  // Phase 2 TODO: replace with RPC `claim_next_build_job()`
  const { data: jobs, error } = await supabase
    .from('build_jobs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) {
    logger.error('Failed to fetch pending jobs:', error.message);
    return null;
  }

  if (!jobs || jobs.length === 0) {
    return null;
  }

  const job = jobs[0] as BuildJob;

  // Attempt to claim (optimistic — assumes single worker for now)
  const { error: updateError } = await supabase
    .from('build_jobs')
    .update({ status: 'generating', current_step: 'claim', updated_at: new Date().toISOString() })
    .eq('id', job.id)
    .eq('status', 'pending'); // guard against race

  if (updateError) {
    logger.error(`Failed to claim job ${job.id}:`, updateError.message);
    return null;
  }

  logger.info(`Claimed job ${job.id} for user ${job.user_id}`);
  return job;
}

/**
 * Record a build step in the build_steps table.
 */
async function recordStep(
  supabase: SupabaseClient,
  jobId: string,
  step: { type: string; status: string; inputSummary?: string; outputSummary?: string; error?: string; order: number },
): Promise<void> {
  const { error } = await supabase.from('build_steps').insert({
    job_id: jobId,
    type: step.type,
    status: step.status,
    step_order: step.order,
    input_summary: step.inputSummary ?? null,
    output_summary: step.outputSummary ?? null,
    error: step.error ?? null,
  });

  if (error) {
    logger.error(`Failed to record step for job ${jobId}:`, error.message);
  }
}

/**
 * Update job progress + current step.
 */
async function updateJobProgress(
  supabase: SupabaseClient,
  jobId: string,
  progress: number,
  currentStep: string,
): Promise<void> {
  const { error } = await supabase
    .from('build_jobs')
    .update({ progress, current_step: currentStep, updated_at: new Date().toISOString() })
    .eq('id', jobId);

  if (error) {
    logger.error(`Failed to update progress for job ${jobId}:`, error.message);
  }
}

/**
 * Process one job end-to-end.
 *
 * TODO: implement each phase. Currently stubbed to demonstrate the flow
 * and the Supabase update pattern. Real implementation will migrate
 * logic from app/routes/api.chat.ts.
 */
export async function processNextJob(supabase: SupabaseClient): Promise<void> {
  const job = await claimNextJob(supabase);

  if (!job) {
    return; // no pending jobs
  }

  logger.info(`Processing job ${job.id}`);

  try {
    // Phase 1: plan
    await updateJobProgress(supabase, job.id, 10, 'plan');
    await recordStep(supabase, job.id, { type: 'plan', status: 'running', order: 1 });

    // TODO: call LLM to generate project_spec.json
    // const spec = await planProject(job);
    await sleep(100); // placeholder

    await recordStep(supabase, job.id, {
      type: 'plan',
      status: 'completed',
      order: 1,
      outputSummary: 'spec generated (TODO)',
    });

    // Phase 2: generate files
    await updateJobProgress(supabase, job.id, 30, 'generate_files');
    await recordStep(supabase, job.id, { type: 'generate_file', status: 'running', order: 2 });

    // TODO: for each file in spec.fileTree:
    //   const content = await generateFile(job, filePath, spec);
    //   await writeToR2(`${job.project_id}/${filePath}`, content);
    //   await recordManifestEntry(supabase, job.project_id, filePath, hash, size);
    await sleep(100);

    await recordStep(supabase, job.id, {
      type: 'generate_file',
      status: 'completed',
      order: 2,
      outputSummary: 'files generated (TODO)',
    });

    // Phase 3: validate
    await updateJobProgress(supabase, job.id, 60, 'validate');
    await recordStep(supabase, job.id, { type: 'validate', status: 'running', order: 3 });

    // TODO: run output-validator on each file
    await sleep(100);

    await recordStep(supabase, job.id, {
      type: 'validate',
      status: 'completed',
      order: 3,
      outputSummary: 'validation passed (TODO)',
    });

    // Phase 4: repair (if needed)
    // TODO: if validation fails, call LLM with error + file → patch

    // Phase 5: finalize
    await updateJobProgress(supabase, job.id, 100, 'finalize');
    await recordStep(supabase, job.id, { type: 'finalize', status: 'running', order: 4 });

    const { error: finalizeError } = await supabase
      .from('build_jobs')
      .update({
        status: 'ready_for_preview',
        current_step: 'done',
        progress: 100,
        has_completion_marker: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    if (finalizeError) {
      throw new Error(`Failed to finalize job: ${finalizeError.message}`);
    }

    await recordStep(supabase, job.id, {
      type: 'finalize',
      status: 'completed',
      order: 4,
      outputSummary: 'job ready_for_preview',
    });

    logger.info(`Job ${job.id} completed → ready_for_preview`);
  } catch (err: any) {
    logger.error(`Job ${job.id} failed:`, err.message);

    await supabase
      .from('build_jobs')
      .update({
        status: 'failed_clean',
        error_summary: err.message ?? 'Unknown error',
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    await recordStep(supabase, job.id, {
      type: 'finalize',
      status: 'failed',
      order: 4,
      error: err.message,
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
