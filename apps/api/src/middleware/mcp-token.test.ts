import { describe, expect, test } from "bun:test";
import {
  constantTimeEqual,
  hasBearerScheme,
  mcpTokenSession,
  parseBearerToken,
} from "./mcp-token";

const ADMIN_GROUP = "dasa122.net-admin";

describe("parseBearerToken", () => {
  test("extracts a bearer value", () => {
    expect(parseBearerToken("Bearer secret-value")).toBe("secret-value");
  });

  test("is case-insensitive on the scheme", () => {
    expect(parseBearerToken("bearer secret-value")).toBe("secret-value");
  });

  test("ignores an absent header", () => {
    expect(parseBearerToken(null)).toBeNull();
  });

  test("ignores another scheme", () => {
    expect(parseBearerToken("Basic dXNlcjpwYXNz")).toBeNull();
  });

  test("ignores a valueless bearer header", () => {
    expect(parseBearerToken("Bearer ")).toBeNull();
  });

  test("rejects a bearer value that contains a space", () => {
    expect(parseBearerToken("Bearer a b")).toBeNull();
  });

  test("rejects a bearer value after a tab", () => {
    expect(parseBearerToken("Bearer\tx")).toBeNull();
  });
});

describe("hasBearerScheme", () => {
  test("is true for a well-formed bearer header", () => {
    expect(hasBearerScheme("Bearer secret-value")).toBe(true);
  });

  test("is true for a malformed bearer attempt", () => {
    expect(hasBearerScheme("Bearer a b")).toBe(true);
    expect(hasBearerScheme("Bearer\tx")).toBe(true);
  });

  test("is false for an absent header or another scheme", () => {
    expect(hasBearerScheme(null)).toBe(false);
    expect(hasBearerScheme("Basic dXNlcjpwYXNz")).toBe(false);
  });
});

describe("constantTimeEqual", () => {
  test("matches identical values", () => {
    expect(constantTimeEqual("correct-horse", "correct-horse")).toBe(true);
  });

  test("rejects different values", () => {
    expect(constantTimeEqual("correct-horse", "wrong-horse")).toBe(false);
  });

  test("handles unequal lengths without throwing", () => {
    expect(constantTimeEqual("short", "a much longer token value")).toBe(false);
  });
});

describe("mcpTokenSession", () => {
  test("a correct token yields the admin session", () => {
    const session = mcpTokenSession(
      "correct-horse",
      "correct-horse",
      ADMIN_GROUP,
    );

    expect(session).not.toBeNull();
    expect(session?.id).toBe("mcp-token");
    expect(session?.subject).toBe("mcp-token");
    expect(session?.name).toBe("MCP");
    expect(session?.email).toBeNull();
    expect(session?.groups).toEqual([ADMIN_GROUP]);
    expect(session?.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  test("a wrong token yields null", () => {
    expect(mcpTokenSession("wrong", "correct-horse", ADMIN_GROUP)).toBeNull();
  });

  test("an empty configured token disables the feature", () => {
    expect(mcpTokenSession("anything", "", ADMIN_GROUP)).toBeNull();
  });
});
