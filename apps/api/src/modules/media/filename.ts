const UNSAFE_RUN = /[^a-zA-Z0-9._-]+/g;
const DOT_RUN = /\.{2,}/g;
const EDGE_DOTS = /^\.+|\.+$/g;
const CONTROL_CHARACTER = /\p{Cc}/u;

/**
 * Validates a raw (percent-encoded) path segment against the media directory.
 * Returns the decoded filename when it is safe to resolve, or `null` when it
 * is empty, a lone dot, contains a separator or `..`, or contains a control
 * character. The single decode is deliberate: a second pass is never applied.
 */
export function parseMediaFilename(rawPath: string): string | null {
  let filename: string;
  try {
    filename = decodeURIComponent(rawPath);
  } catch {
    return null;
  }

  if (filename === "" || filename === ".") {
    return null;
  }
  if (
    filename.includes("/") ||
    filename.includes("\\") ||
    filename.includes("..")
  ) {
    return null;
  }
  if (CONTROL_CHARACTER.test(filename)) {
    return null;
  }
  return filename;
}

/**
 * Produces a name the route guard always accepts: unsafe runs become one
 * dash, runs of dots collapse to one, and edge dots are stripped. An input
 * with nothing left falls back to a random UUID.
 */
export function sanitizeFilename(input: string): string {
  const cleaned = input
    .replace(UNSAFE_RUN, "-")
    .replace(DOT_RUN, ".")
    .replace(EDGE_DOTS, "")
    .toLowerCase();
  return cleaned === "" ? crypto.randomUUID() : cleaned;
}
