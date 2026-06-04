/**
 * Centralized maintenance tasks — scheduled cleanup of expired data.
 * Started by the server entry point after the server begins listening.
 */

import { cleanupExpiredUploads } from "../db/tempUploads";
import { cleanupSessions } from "../db/sessions";
import { cleanupExpiredLoginAttempts } from "../db/loginAttempts";
import { logger } from "./logger";

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export function startMaintenanceTasks(): void {
  // Run immediately on startup, then hourly
  runCleanup("expired_uploads", cleanupExpiredUploads);
  runCleanup("expired_sessions", cleanupSessions);
  runCleanup("expired_login_attempts", cleanupExpiredLoginAttempts);

  const interval = setInterval(() => {
    runCleanup("expired_uploads", cleanupExpiredUploads);
    runCleanup("expired_sessions", cleanupSessions);
    runCleanup("expired_login_attempts", cleanupExpiredLoginAttempts);
  }, CLEANUP_INTERVAL_MS);

  interval.unref(); // Don't prevent process exit
}

async function runCleanup(
  name: string,
  fn: () => Promise<number | void>,
): Promise<void> {
  try {
    const removed = await fn();
    if (removed && removed > 0) {
      logger.info("maintenance_cleanup", { task: name, removed });
    }
  } catch (error) {
    logger.error("maintenance_cleanup_failed", {
      task: name,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
