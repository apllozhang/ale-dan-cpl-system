/**
 * Import Worker — Background processor for async CPL import jobs
 *
 * Polls the import_jobs table for pending jobs and processes them.
 * Runs as an in-process background loop (no external queue needed).
 */

import { eq } from "drizzle-orm";
import * as db from "../db";
import { importJobs, type InsertCplProduct, type InsertCplSheet } from "../../drizzle/schema";
import { parseExcelBuffer } from "../routers/cpl";
import { acquireLock, releaseLock } from "../db/locks";
import type { Organization, UserGroup } from "../../drizzle/schema";

const POLL_INTERVAL_MS = 10_000; // 10 seconds
const JOB_LOCK_TTL_MS = 10 * 60 * 1000; // 10 minutes
const IMPORT_LOCK_NAME = "cpl_import_job";

let isRunning = false;
let pollTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Start the import worker (call once at server startup)
 */
export function startImportWorker(): void {
  if (isRunning) return;
  isRunning = true;
  console.log("[ImportWorker] Started — polling every", POLL_INTERVAL_MS / 1000, "seconds");
  scheduleNext();
}

/**
 * Stop the import worker
 */
export function stopImportWorker(): void {
  isRunning = false;
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  console.log("[ImportWorker] Stopped");
}

function scheduleNext(): void {
  if (!isRunning) return;
  pollTimer = setTimeout(async () => {
    try {
      await processNextJob();
    } catch (error) {
      console.error("[ImportWorker] Unexpected error:", error);
    }
    scheduleNext();
  }, POLL_INTERVAL_MS);
}

/**
 * Process the next pending import job
 */
async function processNextJob(): Promise<void> {
  // Try to claim a pending job
  const job = await db.claimNextPendingJob();
  if (!job) return; // No pending jobs

  console.log(`[ImportWorker] Claimed job ${job.id} for file "${job.fileName}"`);

  // Acquire distributed lock to prevent concurrent imports
  const lockOwner = `worker:${job.id}:${Date.now()}`;
  const lockAcquired = await acquireLock(IMPORT_LOCK_NAME, lockOwner, JOB_LOCK_TTL_MS);
  if (!lockAcquired) {
    console.log(`[ImportWorker] Could not acquire lock for job ${job.id}, skipping`);
    // Reset job back to pending
    await db.updateImportJobStatus(job.id, "pending");
    return;
  }

  try {
    // Get the temp upload file
    const upload = job.uploadId ? await db.getTempUploadById(job.uploadId) : null;
    if (!upload) {
      await db.updateImportJobStatus(job.id, "failed", {
        errorMessage: "Upload file not found or expired",
      });
      console.log(`[ImportWorker] Job ${job.id} failed: upload not found`);
      return;
    }

    // Update progress: reading file
    await db.updateImportJobStatus(job.id, "processing", { progress: 10 });

    // Read the file
    const fs = await import("fs/promises");
    let buffer: Buffer;
    try {
      buffer = await fs.readFile(upload.filePath);
    } catch (error) {
      await db.updateImportJobStatus(job.id, "failed", {
        errorMessage: `Failed to read uploaded file: ${error instanceof Error ? error.message : String(error)}`,
      });
      console.log(`[ImportWorker] Job ${job.id} failed: cannot read file`);
      return;
    }

    // Update progress: parsing Excel
    await db.updateImportJobStatus(job.id, "processing", { progress: 30 });

    // Parse Excel
    let parseResult: ReturnType<typeof parseExcelBuffer>;
    try {
      parseResult = parseExcelBuffer(buffer, job.selectedSheets ?? undefined);
    } catch (error) {
      await db.updateImportJobStatus(job.id, "failed", {
        errorMessage: `Failed to parse Excel file: ${error instanceof Error ? error.message : String(error)}`,
      });
      console.log(`[ImportWorker] Job ${job.id} failed: parse error`);
      return;
    }

    const { products, sheetMeta, summaryContent } = parseResult;

    if (products.length === 0) {
      await db.updateImportJobStatus(job.id, "failed", {
        errorMessage: "No valid products found in the imported file",
      });
      console.log(`[ImportWorker] Job ${job.id} failed: no products`);
      return;
    }

    // Update progress: writing to database
    await db.updateImportJobStatus(job.id, "processing", { progress: 50 });

    // Fetch org/group names for logging
    let orgName = "";
    let groupName = "";
    try {
      // Get the user who created the job
      const user = await db.getUserById(job.createdBy);
      if (user) {
        if (user.organizationId) {
          const orgs: Organization[] = await db.getAllOrganizations();
          orgName = orgs.find((o) => o.id === user.organizationId)?.name || "";
        }
        if (user.groupId) {
          const groups: UserGroup[] = await db.getAllUserGroups();
          groupName = groups.find((g) => g.id === user.groupId)?.name || "";
        }
      }
    } catch (error) {
      console.warn("[ImportWorker] Failed to fetch org/group info:", error);
      // Non-fatal, continue with import
    }

    const cleanedSheets: Omit<InsertCplSheet, "id">[] = sheetMeta.map((s) => {
      const { id: _id, ...rest } = s as InsertCplSheet & { id?: number };
      return rest;
    });

    // Write to database
    try {
      await db.importCplOverwrite({
        fileName: job.fileName,
        userId: job.createdBy,
        username: "system", // Worker doesn't have username context
        orgName: orgName || null,
        groupName: groupName || null,
        sheetNames: sheetMeta.map((s) => s.sheetName),
        sheetsCount: sheetMeta.length,
        productsCount: products.length,
        products: products as InsertCplProduct[],
        sheets: cleanedSheets as Omit<InsertCplSheet, "id">[],
        summary: summaryContent ? { content: summaryContent, version: job.fileName } : undefined,
      });
    } catch (error) {
      await db.updateImportJobStatus(job.id, "failed", {
        errorMessage: `Failed to write to database: ${error instanceof Error ? error.message : String(error)}`,
      });
      console.log(`[ImportWorker] Job ${job.id} failed: DB write error`);
      return;
    }

    // Update progress: finalizing
    await db.updateImportJobStatus(job.id, "processing", { progress: 90 });

    // Mark upload as consumed
    if (job.uploadId) {
      await db.markTempUploadConsumed(job.uploadId);
    }

    // Clean up temp file
    try {
      await fs.unlink(upload.filePath).catch(() => {});
    } catch {
      // Non-fatal
    }

    // Mark job as succeeded
    await db.updateImportJobStatus(job.id, "succeeded", {
      progress: 100,
      result: {
        sheetsImported: sheetMeta.length,
        productsImported: products.length,
        hasSummary: !!summaryContent,
      },
    });

    // Log activity
    try {
      // We need a minimal context for logging
      const user = await db.getUserById(job.createdBy);
      if (user) {
        await db.createActivityLog({
          userId: user.id,
          username: user.username || "unknown",
          action: "import_data",
          resourceType: "import",
          detail: JSON.stringify({
            fileName: job.fileName,
            mode: "overwrite",
            productsCount: products.length,
            jobId: job.id,
          }),
        });
      }
    } catch (error) {
      console.warn("[ImportWorker] Failed to log activity:", error);
      // Non-fatal
    }

    console.log(`[ImportWorker] Job ${job.id} succeeded: ${sheetMeta.length} sheets, ${products.length} products`);
  } finally {
    await releaseLock(IMPORT_LOCK_NAME, lockOwner);
  }
}
