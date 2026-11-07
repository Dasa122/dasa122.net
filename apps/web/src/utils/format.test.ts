import { describe, expect, test } from "bun:test";
import { formatDate, formatNumber, formatRelativeTime } from "./format";

describe("formatDate", () => {
  test("renders an ISO datetime as a day-month-year string", () => {
    expect(formatDate("2026-11-07T10:00:00.000Z")).toBe("7 Nov 2026");
  });

  test("renders null as an empty string", () => {
    expect(formatDate(null)).toBe("");
  });

  test("renders an invalid date as an empty string", () => {
    expect(formatDate("not-a-date")).toBe("");
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-11-07T12:00:00.000Z");

  test("says just now inside a minute", () => {
    expect(formatRelativeTime("2026-11-07T11:59:30.000Z", now)).toBe(
      "just now",
    );
  });

  test("reports minutes", () => {
    expect(formatRelativeTime("2026-11-07T11:55:00.000Z", now)).toBe("5m ago");
  });

  test("reports hours", () => {
    expect(formatRelativeTime("2026-11-07T09:00:00.000Z", now)).toBe("3h ago");
  });

  test("reports days", () => {
    expect(formatRelativeTime("2026-11-05T12:00:00.000Z", now)).toBe("2d ago");
  });

  test("falls back to the absolute date after seven days", () => {
    expect(formatRelativeTime("2026-10-01T12:00:00.000Z", now)).toBe(
      "1 Oct 2026",
    );
  });

  test("renders an invalid date as an empty string", () => {
    expect(formatRelativeTime("not-a-date", now)).toBe("");
  });
});

describe("formatNumber", () => {
  test("groups thousands", () => {
    expect(formatNumber(12345)).toBe("12,345");
  });
});
