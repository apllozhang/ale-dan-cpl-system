/**
 * Structured logger for the CPL system.
 * Outputs JSON-formatted log lines to stdout/stderr for easy parsing by log aggregators.
 */

interface LogEntry {
  timestamp: string;
  level: string;
  event: string;
  [key: string]: unknown;
}

function formatEntry(level: string, event: string, data?: Record<string, unknown>): string {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...data,
  };
  return JSON.stringify(entry);
}

export const logger = {
  info(event: string, data?: Record<string, unknown>) {
    console.info(formatEntry("info", event, data));
  },
  warn(event: string, data?: Record<string, unknown>) {
    console.warn(formatEntry("warn", event, data));
  },
  error(event: string, data?: Record<string, unknown>) {
    console.error(formatEntry("error", event, data));
  },
  debug(event: string, data?: Record<string, unknown>) {
    if (process.env.LOG_LEVEL === "debug") {
      console.debug(formatEntry("debug", event, data));
    }
  },
};

const SLOW_THRESHOLD_MS = 2000; // 2 seconds

/**
 * Log a warning if an operation exceeds the slow threshold.
 */
export function logSlowOperation(label: string, durationMs: number): void {
  if (durationMs > SLOW_THRESHOLD_MS) {
    logger.warn("slow_operation", { label, durationMs, threshold: SLOW_THRESHOLD_MS });
  }
}
