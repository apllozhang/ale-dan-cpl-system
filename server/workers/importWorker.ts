/**
 * Import job worker — polls for pending import jobs and processes them.
 * Started as a background task by the server entry point.
 */

import { getDb } from "../db";
import { importJobs } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { logger } from "../_core/logger";

const POLL_INTERVAL_MS = 5_000; // 5 seconds
let workerRunning = false;

async function processPendingJobs() {
  const db = await getDb();
  if (!db) return;

  try {
    const pending = await db.select().from(importJobs).where(eq(importJobs.status, "pending")).limit(1);
    for (const job of pending) {
      try {
        await db.update(importJobs).set({ status: "processing", startedAt: new Date() }).where(eq(importJobs.id, job.id));
        // Placeholder: actual import logic would go here
        // For now, mark as succeeded since the real import is handled synchronously in the router
        await db.update(importJobs).set({ status: "succeeded", progress: 100, finishedAt: new Date() }).where(eq(importJobs.id, job.id));
        logger.info("import_job_completed", { jobId: job.id, type: job.type });
      } catch (error) {
        await db.update(importJobs).set({
          status: "failed",
          errorMessage: error instanceof Error ? error.message : String(error),
          finishedAt: new Date(),
        }).where(eq(importJobs.id, job.id));
        logger.error("import_job_failed", { jobId: job.id, error: error instanceof Error ? error.message : String(error) });
      }
    }
  } catch (error) {
    logger.error("import_worker_poll_error", { error: error instanceof Error ? error.message : String(error) });
  }
}

export function startImportWorker() {
  if (workerRunning) return;
  workerRunning = true;

  logger.info("import_worker_started", { pollIntervalMs: POLL_INTERVAL_MS });

  const interval = setInterval(processPendingJobs, POLL_INTERVAL_MS);
  interval.unref(); // Don't prevent process exit
}

export function stopImportWorker() {
  workerRunning = false;
  logger.info("import_worker_stopped");
}
