/**
 * Import job worker — polls for pending import jobs and processes them.
 * Started as a background task by the server entry point.
 *
 * Concurrency note: Uses atomic conditional UPDATE (status = 'pending')
 * to prevent multiple workers from grabbing the same job.
 */

import { getDb } from "../db";
import { getUserById, getAllOrganizations, getAllUserGroups } from "../db/index";
import { getTempUploadById, markTempUploadConsumed } from "../db/tempUploads";
import { importCplOverwrite } from "../db/cpl";
import { parseExcelBuffer } from "../routers/cpl";
import { importJobs } from "../../drizzle/schema";
import type { Organization, UserGroup } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "../_core/logger";
import fs from "node:fs/promises";

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
        // Step 1: Resolve temp upload
        if (!job.uploadId) throw new Error("Job has no uploadId");
        const upload = await getTempUploadById(job.uploadId);
        if (!upload) throw new Error("Temp upload not found or expired");

        await db
          .update(importJobs)
          .set({ progress: 10 })
          .where(eq(importJobs.id, job.id));

        // Step 2: Read file from disk
        let buffer: Buffer;
        try {
          buffer = await fs.readFile(upload.filePath);
        } catch (err) {
          throw new Error(
            "Failed to read uploaded file: " +
              (err instanceof Error ? err.message : String(err)),
          );
        }

        await db
          .update(importJobs)
          .set({ progress: 20 })
          .where(eq(importJobs.id, job.id));

        // Step 3: Parse Excel
        const { products, sheetMeta, summaryContent } = parseExcelBuffer(
          buffer,
          job.selectedSheets ?? undefined,
        );
        if (products.length === 0) {
          throw new Error("No valid products found in the imported file");
        }

        await db
          .update(importJobs)
          .set({ progress: 40 })
          .where(eq(importJobs.id, job.id));

        // Step 4: Resolve user org/group for audit trail
        const importUser = await getUserById(job.createdBy);
        let orgName = "";
        let groupName = "";
        try {
          if (importUser?.organizationId) {
            const orgs: Organization[] = await getAllOrganizations();
            orgName =
              orgs.find((o) => o.id === importUser.organizationId)?.name ?? "";
          }
          if (importUser?.groupId) {
            const groups: UserGroup[] = await getAllUserGroups();
            groupName =
              groups.find((g) => g.id === importUser.groupId)?.name ?? "";
          }
        } catch {
          // Non-fatal — import can proceed without audit metadata
        }

        await db
          .update(importJobs)
          .set({ progress: 50 })
          .where(eq(importJobs.id, job.id));

        // Step 5: Clean sheetMeta — strip any stray 'id' field
        const cleanedSheets = sheetMeta.map((s) => {
          const { id: _id, ...rest } = s as typeof s & { id?: number };
          return rest;
        });

        // Step 6: Execute real import
        await importCplOverwrite({
          fileName: job.fileName,
          userId: job.createdBy,
          username: importUser?.username || "unknown",
          orgName: orgName || null,
          groupName: groupName || null,
          sheetNames: sheetMeta.map((s) => s.sheetName),
          sheetsCount: sheetMeta.length,
          productsCount: products.length,
          products: products as (typeof products)[number][],
          sheets: cleanedSheets as (typeof cleanedSheets)[number][],
          summary: summaryContent
            ? { content: summaryContent, version: job.fileName }
            : undefined,
        });

        // Step 7: Mark job succeeded with result
        await db
          .update(importJobs)
          .set({
            status: "succeeded",
            progress: 100,
            finishedAt: new Date(),
            result: {
              sheetsImported: sheetMeta.length,
              productsImported: products.length,
              hasSummary: !!summaryContent,
            },
          })
          .where(eq(importJobs.id, job.id));

        // Step 8: Clean up temp upload file and mark consumed
        await fs.unlink(upload.filePath).catch(() => {});
        await markTempUploadConsumed(upload.id);

        logger.info("import_job_completed", {
          jobId: job.id,
          type: job.type,
          productsCount: products.length,
        });
      } catch (error) {
        await db
          .update(importJobs)
          .set({
            status: "failed",
            errorMessage:
              error instanceof Error ? error.message : String(error),
            finishedAt: new Date(),
          })
          .where(eq(importJobs.id, job.id));
        logger.error("import_job_failed", {
          jobId: job.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } catch (error) {
    logger.error("import_worker_poll_error", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function startImportWorker() {
  if (workerRunning) return;

  // Allow disabling the worker via env var (for single-instance control)
  if (process.env.IMPORT_WORKER_ENABLED === "false") {
    logger.info("import_worker_disabled", {
      reason: "IMPORT_WORKER_ENABLED is 'false'",
    });
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
