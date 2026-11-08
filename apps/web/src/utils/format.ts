const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

const numberFormatter = new Intl.NumberFormat("en-US");

const monthYearFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

/** An ISO datetime as `November 2026`; `null` or unusable input renders "". */
export function formatMonthYear(value: string | null): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return monthYearFormatter.format(date);
}

/** An ISO datetime as `7 Nov 2026`; `null` or unusable input renders "". */
export function formatDate(value: string | null): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return dateFormatter.format(date);
}

/**
 * `just now`, `5m ago`, `3h ago`, `2d ago`, or the absolute date once the
 * value is older than seven days.
 */
export function formatRelativeTime(
  value: string | null,
  now: Date = new Date(),
): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) {
    return "just now";
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ago`;
  }
  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)}h ago`;
  }
  if (seconds < 604800) {
    return `${Math.floor(seconds / 86400)}d ago`;
  }
  return formatDate(value);
}

/** A locale-grouped number, e.g. `12,345`. */
export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}
