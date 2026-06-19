type LogLevel = "info" | "warn" | "error" | "debug";

type LogEntry = {
  id: string;
  timestamp: string;
  level: LogLevel;
  path: string;
  method: string;
  userId: string | null;
  message: string;
  error: string | null;
  duration: number | null;
};

const MAX_LOG_ENTRIES = 500;
const logs: LogEntry[] = [];

export function log(entry: {
  level?: LogLevel;
  path?: string;
  method?: string;
  userId?: string | null;
  message: string;
  error?: unknown;
  duration?: number;
}) {
  const logEntry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    level: entry.level || "info",
    path: entry.path || "",
    method: entry.method || "",
    userId: entry.userId || null,
    message: entry.message,
    error: entry.error ? (entry.error instanceof Error ? entry.error.stack || entry.error.message : String(entry.error)) : null,
    duration: entry.duration || null,
  };

  logs.unshift(logEntry);

  if (logs.length > MAX_LOG_ENTRIES) {
    logs.pop();
  }

  if (entry.level === "error") {
    console.error(`[${logEntry.level.toUpperCase()}] ${logEntry.method} ${logEntry.path}`, logEntry.message, entry.error || "");
  } else if (entry.level === "warn") {
    console.warn(`[${logEntry.level.toUpperCase()}] ${logEntry.method} ${logEntry.path}`, logEntry.message);
  } else {
    console.log(`[${logEntry.level.toUpperCase()}] ${logEntry.method} ${logEntry.path}`, logEntry.message);
  }
}

export function getLogs(limit = 100, level?: LogLevel) {
  let filtered = logs;
  if (level) {
    filtered = filtered.filter((l) => l.level === level);
  }
  return filtered.slice(0, limit);
}

export function clearLogs() {
  logs.length = 0;
}
