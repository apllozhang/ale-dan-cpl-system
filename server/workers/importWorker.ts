/**
 * Import job worker — polls for pending import jobs and processes them.
 * Started as a background task by the server entry point.
 *
 * Concurrency note: Uses atomic conditional UPDATE (status = 'pending')
 * to prevent multiple workers from grabbing the same job.
 * TODO: For multi-instance deployment, add DB-level advisory lock or Redis lock.
 */

import { getDb } from "../db";
import { importJobs } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "../_core/logger";

const POLL_INTERVAL_MS = 5_000; // 5 seconds
let workerRunning = false;

/**
 * Atomically claim a pending job by setting status to 'processing'.
 * Returns true if this worker successfully claimed the job.
 */
async function claimJob(jobId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  // Atomic conditional update: only succeeds if status is still 'pending'
  const result = await db
    .update(importJobs)
    .set({ status: "processing", startedAt: new Date() })
    .where(and(eq(importJobs.id, jobId), eq(importJobs.status, "pending")));

  return (result[0] as { affectedRows: number }).affectedRows > 0;
}

async function processPendingJobs() {
  const db = await getDb();
  if (!db) return;

  try {
    const pending = await db
      .select()
      .from(importJobs)
      .where(eq(importJobs.status, "pending"))
      .limit(1);

    for (const job of pending) {
      // Atomic claim — skip if another worker grabbed it first
      const claimed = await claimJob(job.id);
      if (!claimed) continue;

      try {
        // TODO: Replace with actual import logic (cplImportProcessor / eflashImportProcessor)
        // Currently a stub — real import is handled synchronously in the router
        await db
          .update(importJobs)
          .set({ status: "succeeded", progress: 100, finishedAt: new Date() })
          .where(eq(importJobs.id, job.id));
        logger.info("import_job_completed", { jobId: job.id, type: job.type });
      } catch (error) {
        await db
          .update(importJobs)
          .set({
            status: "failed",
            errorMessage: error instanceof Error ? error.message : String(error),
            finishedAt: new Date(),
          })
          .where(eq(importJobs.id, job.id));
        logger.error("import_job_failed", { jobId: job.id, error: error instanceof Error ? error.message : String(error) });
      }
    }
  } catch (error) {
    logger.error("import_worker_poll_error", { error: error instanceof Error ? error.message : String(error) });
  }
}

export function startImportWorker() {
  if (workerRunning) return;

  // Allow disabling the worker via env var (e.g. when actual import logic isn't deployed)
  if (process.env.IMPORT_WORKER_ENABLED !== "true") {
    logger.info("import_worker_skipped", { reason: "IMPORT_WORKER_ENABLED is not 'true'" });
    return;
  }

  workerRunning = true;
  logger.info("import_worker_started", { pollIntervalMs: POLL_INTERVAL_MS });

  const interval = setInterval(processPendingJobs, POLL_INTERVAL_MS);
  interval.unref(); // Don't prevent process exit
}

export function stopImportWorker() {
  workerRunning = false;
  logger.info("import_worker_stopped");
}
