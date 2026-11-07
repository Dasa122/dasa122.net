import { afterEach, describe, expect, test } from "bun:test";
import { createClient, McpError } from "./client";

type Recorded = {
  body: unknown;
  headers: Headers;
  method: string;
  signal: AbortSignal | null;
  url: string;
};

let recorded: Recorded[] = [];

function stubFetch(
  response: { body?: unknown; status?: number; text?: string } = {},
): void {
  recorded = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    recorded.push({
      body:
        init?.body === undefined
          ? null
          : typeof init.body === "string"
            ? JSON.parse(init.body)
            : init.body,
      headers: new Headers(init?.headers),
      method: init?.method ?? "GET",
      signal: init?.signal instanceof AbortSignal ? init.signal : null,
      url,
    });
    const text =
      response.text ??
      JSON.stringify(response.body === undefined ? {} : response.body);
    return new Response(text, {
      headers: { "content-type": "application/json" },
      status: response.status ?? 200,
    });
  }) as typeof fetch;
}

const client = createClient({
  apiUrl: "http://api.test",
  token: "test-token-123",
});

afterEach(() => {
  recorded = [];
});

describe("ApiClient.request", () => {
  test("sends the bearer token, body and a timeout signal", async () => {
    stubFetch({ body: { ok: true } });

    const result = await client.request("PATCH", "/admin/settings", {
      tagline: "hi",
    });

    expect(result).toEqual({ ok: true });
    expect(recorded[0]?.url).toBe("http://api.test/api/admin/settings");
    expect(recorded[0]?.method).toBe("PATCH");
    expect(recorded[0]?.headers.get("authorization")).toBe(
      "Bearer test-token-123",
    );
    expect(recorded[0]?.headers.get("content-type")).toBe("application/json");
    expect(recorded[0]?.body).toEqual({ tagline: "hi" });
    expect(recorded[0]?.signal).not.toBeNull();
  });

  test("a GET has no body or content-type", async () => {
    stubFetch({ body: { name: "Dasa122" } });

    await client.request("GET", "/admin/settings");

    expect(recorded[0]?.headers.get("content-type")).toBeNull();
    expect(recorded[0]?.body).toBeNull();
  });

  test("a 401 names DASA_MCP_TOKEN in the suggestion", async () => {
    stubFetch({
      body: { code: "UNAUTHORIZED", message: "Authentication required" },
      status: 401,
    });

    const error = await client
      .request("GET", "/admin/settings")
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(McpError);
    expect((error as McpError).status).toBe(401);
    expect((error as McpError).message).toContain("DASA_MCP_TOKEN");
  });

  test("a 404 suggests checking the id", async () => {
    stubFetch({ body: { message: "Post not found" }, status: 404 });

    const error = await client
      .request("GET", "/admin/posts/abc")
      .catch((caught: unknown) => caught);

    expect((error as McpError).message).toContain("check the id");
  });

  test("validation issues are surfaced in the message", async () => {
    stubFetch({
      body: {
        code: "BAD_REQUEST",
        data: {
          issues: [{ message: "Too small", path: ["title"] }],
        },
        message: "Input validation failed",
      },
      status: 400,
    });

    const error = await client
      .request("POST", "/admin/posts", {})
      .catch((caught: unknown) => caught);

    expect((error as McpError).message).toContain("title: Too small");
  });
});
