const WINDOWS_RESERVED = new Set([
  "CON", "PRN", "AUX", "NUL",
  "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
  "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
]);

export function getSocketPath(): string {
  return `/tmp/otterwise-bridge-${process.pid}.sock`;
}

export function getMetaPath(): string {
  return `/tmp/otterwise-bridge-${process.pid}.meta.json`;
}

export function getLockPath(): string {
  return `/tmp/otterwise-session.lock`;
}

export function validatePathSegment(segment: string): void {
  if (!segment) {
    throw new Error("Path segment must not be empty");
  }

  if (segment.includes("..")) {
    throw new Error("Path segment must not contain '..'");
  }

  if (segment.includes("/") || segment.includes("\\")) {
    throw new Error("Path segment must not contain path separators");
  }

  if (segment.includes("\0")) {
    throw new Error("Path segment must not contain null bytes");
  }

  const upper = segment.toUpperCase().replace(/\.[^.]*$/, "");
  if (WINDOWS_RESERVED.has(upper)) {
    throw new Error(`Path segment must not use Windows reserved name: ${segment}`);
  }
}
