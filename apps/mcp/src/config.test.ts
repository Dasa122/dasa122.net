import { describe, expect, test } from "bun:test";
import { parseConfig } from "./config";

describe("parseConfig", () => {
  test("defaults the API URL and strips a trailing slash", () => {
    expect(parseConfig({ DASA_MCP_TOKEN: "test-token-123" })).toEqual({
      apiUrl: "http://localhost:3001",
      token: "test-token-123",
    });
    expect(
      parseConfig({
        DASA_API_URL: "https://dasa122.net/",
        DASA_MCP_TOKEN: "test-token-123",
      }).apiUrl,
    ).toBe("https://dasa122.net");
  });

  test("a missing token fails fast with a readable message", () => {
    expect(() => parseConfig({})).toThrow(/DASA_MCP_TOKEN is required/);
  });

  test("a short token is rejected", () => {
    expect(() => parseConfig({ DASA_MCP_TOKEN: "short" })).toThrow(
      /DASA_MCP_TOKEN/,
    );
  });

  test("a non-URL API base is rejected", () => {
    expect(() =>
      parseConfig({
        DASA_API_URL: "not a url",
        DASA_MCP_TOKEN: "test-token-123",
      }),
    ).toThrow(/Invalid MCP configuration/);
  });
});
