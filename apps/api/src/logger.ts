const REDACTED = "[redacted]";
const CIRCULAR = "[circular]";

const SECRET_KEY_PATTERN =
  /secret|token|password|codeverifier|authorization|cookie|apikey|client_secret/i;

/**
 * Deep-copies `value`, replacing the value of every secret-bearing key with
 * `[redacted]`. Applied to every log payload so a token, secret, password or
 * cookie can never reach stdout. Errors are expanded to their own fields
 * because their properties are not enumerable, and cycles become `[circular]`
 * rather than a stack overflow.
 */
export function redact(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return CIRCULAR;
    }
    seen.add(value);
    const result = value.map((item) => redact(item, seen));
    seen.delete(value);
    return result;
  }
  if (value instanceof Date) {
    return value;
  }
  if (value instanceof Error) {
    return { message: value.message, name: value.name, stack: value.stack };
  }
  if (value !== null && typeof value === "object") {
    if (seen.has(value)) {
      return CIRCULAR;
    }
    seen.add(value);
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      result[key] = SECRET_KEY_PATTERN.test(key)
        ? REDACTED
        : redact(entry, seen);
    }
    seen.delete(value);
    return result;
  }
  return value;
}

type Level = "debug" | "error" | "info" | "warn";

type LogPayload = Record<string, unknown>;

export interface Logger {
  child(bindings: LogPayload): Logger;
  debug(payload: LogPayload, message?: string): void;
  error(payload: LogPayload, message?: string): void;
  info(payload: LogPayload, message?: string): void;
  warn(payload: LogPayload, message?: string): void;
}

function emit(
  level: Level,
  bindings: LogPayload,
  payload: LogPayload,
  message?: string,
): void {
  const time = new Date().toISOString();
  let line: string;
  try {
    const fields = redact({ ...bindings, ...payload }) as LogPayload;
    line = JSON.stringify({
      ...fields,
      level,
      time,
      ...(message === undefined ? {} : { msg: message }),
    });
  } catch {
    line = JSON.stringify({
      level: "error",
      msg: "log_serialization_failed",
      time,
    });
  }
  try {
    process.stdout.write(`${line}\n`);
  } catch {
    // A failing or short write (EPIPE in a container) must not take down the
    // request that was only trying to log.
  }
}

function createLogger(bindings: LogPayload = {}): Logger {
  return {
    child: (extra) => createLogger({ ...bindings, ...extra }),
    debug: (payload, message) => {
      if (process.env.NODE_ENV !== "production") {
        emit("debug", bindings, payload, message);
      }
    },
    error: (payload, message) => emit("error", bindings, payload, message),
    info: (payload, message) => emit("info", bindings, payload, message),
    warn: (payload, message) => emit("warn", bindings, payload, message),
  };
}

/** One JSON object per line on stdout, with every payload redacted first. */
export const logger: Logger = createLogger();
