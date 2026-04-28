interface LogPayload {
  [key: string]: unknown;
}

function write(level: "info" | "error" | "warn", payload: LogPayload, message?: string): void {
  const line = {
    level,
    time: new Date().toISOString(),
    ...payload,
    ...(message ? { message } : {}),
  };
  const printer = level === "error" ? console.error : console.log;
  printer(JSON.stringify(line));
}

export const logger = {
  info(payload: LogPayload, message?: string) {
    write("info", payload, message);
  },
  error(payload: LogPayload, message?: string) {
    write("error", payload, message);
  },
  warn(payload: LogPayload, message?: string) {
    write("warn", payload, message);
  },
};
