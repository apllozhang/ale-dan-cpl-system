/**
 * Structured logger for the CPL system.
 * Outputs JSON-formatted log lines to stdout/stderr for easy parsing by log aggregators.
 * Automatically redacts sensitive fields (password, token, etc.) to prevent credential leakage.
 */

const SENSITIVE_KEYS = new Set([
  "password", "passwordHash", "token", "cookie", "authorization",
  "secret", "apiKey", "accessToken", "refreshToken",
]);

interface LogEntry {
  timestamp: string;
  level: string;
  event: string;
  [key: string]: unknown;
}

/**
 * Recursively redact sensitive fields in a data object.
 * Replaces values with "[REDACTED]" without mutating the original.
 */
function redact(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;
  if (Array.isArray(data)) return data.map(redact);

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key)) {
      result[key] = "[REDACTTED]";
    } else if (typeof value === "object" && value !== null) {
      result[key] = redact(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function formatEntry(level: string, event: string, data?: Record<string, unknown>): string {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...(data ? redact(data) as Record<string, unknown> : {}),
  };
  return JSON.stringify(entry);
}

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;

function getCurrentLevel(): number {
  const env = process.env.LOG_LEVEL?.toLowerCase() ?? "info";
  return LOG_LEVELS[env as keyof typeof LOG_LEVELS] ?? 1;
}

export const logger = {
  info(event: string, data?: Record<string, unknown>) {
    if (getCurrentLevel() <= 1) console.info(formatEntry("info", event, data));
  },
  warn(event: string, data?: Record<string, unknown>) {
    if (getCurrentLevel() <= 2) console.warn(formatEntry("warn", event, data));
  },
  error(event: string, data?: Record<string, unknown>) {
    if (getCurrentLevel() <= 3) console.error(formatEntry("error", event, data));
  },
  debug(event: string, data?: Record<string, unknown>) {
    if (getCurrentLevel() <= 0) console.debug(formatEntry("debug", event, data));
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
