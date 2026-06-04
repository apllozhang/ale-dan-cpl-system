/**
 * Unified structured logger for the application.
 *
 * Outputs JSON-formatted log entries to stdout/stderr.
 * No external dependencies — uses console.log/error internally.
 *
 * Usage:
 *   import { logger } from "./logger";
 *   logger.info("user_login", { userId: 1, ip: "127.0.0.1" });
 *   logger.error("db_error", { query: "SELECT ...", error: err.message });
 *
 * Child logger with context:
 *   const reqLogger = logger.child({ requestId: "abc", userId: 1 });
 *   reqLogger.info("processing_request");  // includes requestId and userId
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Minimum log level — defaults to "info", can be set via LOG_LEVEL env var
const MIN_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[MIN_LEVEL];
}

function formatEntry(level: LogLevel, message: string, data?: Record<string, unknown>, context?: Record<string, unknown>): string {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
    ...data,
  };
  return JSON.stringify(entry);
}

export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  child(context: Record<string, unknown>): Logger;
}

function createLogger(context?: Record<string, unknown>): Logger {
  return {
    debug(message: string, data?: Record<string, unknown>) {
      if (shouldLog("debug")) {
        console.log(formatEntry("debug", message, data, context));
      }
    },
    info(message: string, data?: Record<string, unknown>) {
      if (shouldLog("info")) {
        console.log(formatEntry("info", message, data, context));
      }
    },
    warn(message: string, data?: Record<string, unknown>) {
      if (shouldLog("warn")) {
        console.warn(formatEntry("warn", message, data, context));
      }
    },
    error(message: string, data?: Record<string, unknown>) {
      if (shouldLog("error")) {
        console.error(formatEntry("error", message, data, context));
      }
    },
    child(childContext: Record<string, unknown>) {
      return createLogger({ ...context, ...childContext });
    },
  };
}

/** Root logger instance */
export const logger: Logger = createLogger();

/**
 * Log slow operations (queries, imports, etc.)
 * @param operation - Name of the operation
 * @param duration - Duration in milliseconds
 * @param threshold - Alert threshold in milliseconds (default: 1000ms)
 */
export function logSlowOperation(operation: string, duration: number, threshold = 1000): void {
  if (duration > threshold) {
    logger.warn("slow_operation", { operation, duration, threshold });
  }
}

/**
 * Create a request-scoped logger with common request context
 */
export function createRequestLogger(requestId: string, userId?: number | null, path?: string): Logger {
  return logger.child({
    requestId,
    userId: userId ?? null,
    path: path ?? null,
  });
}
