import { afterEach, describe, expect, test } from "bun:test";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { createClient } from "./client";
import {
  createInputSchema,
  idInputSchema,
  listInputSchema,
  newsCreate,
  newsDelete,
  newsList,
  newsPublish,
  newsUnpublish,
  newsUpdate,
  updateInputSchema,
} from "./tools/news";
import {
  settingsGet,
  settingsUpdate,
  updateInputSchema as settingsUpdateInputSchema,
} from "./tools/settings";

type Recorded = {
  body: unknown;
  headers: Headers;
  method: string;
  url: string;
};

const POST_ID = "11111111-1111-4111-8111-111111111111";

const client = createClient({
  apiUrl: "http://api.test",
  token: "test-token-123",
});

let recorded: Recorded[] = [];

function stubFetch(body: unknown, status = 200): void {
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
      url,
    });
    return new Response(JSON.stringify(body), {
      headers: { "content-type": "application/json" },
      status,
    });
  }) as typeof fetch;
}

function textOf(result: CallToolResult): string {
  const block = result.content[0];
  if (block === undefined || block.type !== "text") {
    throw new Error("expected a text content block");
  }
  return block.text;
}

afterEach(() => {
  recorded = [];
});

describe("news tools", () => {
  test("dasa_news_list GETs /admin/posts with query parameters", async () => {
    stubFetch({ items: [], nextCursor: null, total: 0 });

    await newsList(
      client,
      listInputSchema.parse({ limit: 5, status: "draft" }),
    );

    expect(recorded[0]?.method).toBe("GET");
    expect(recorded[0]?.url).toBe(
      "http://api.test/api/admin/posts?limit=5&status=draft",
    );
    expect(recorded[0]?.body).toBeNull();
    expect(recorded[0]?.headers.get("authorization")).toBe(
      "Bearer test-token-123",
    );
  });

  test("dasa_news_create POSTs the post body", async () => {
    stubFetch({ id: "post-1", source: "own", status: "draft", title: "Hello" });

    await newsCreate(
      client,
      createInputSchema.parse({ body: "text", source: "own", title: "Hello" }),
    );

    expect(recorded[0]?.method).toBe("POST");
    expect(recorded[0]?.url).toBe("http://api.test/api/admin/posts");
    const body = recorded[0]?.body as Record<string, unknown>;
    expect(body.title).toBe("Hello");
    expect(body.source).toBe("own");
    expect(body.id).toBeUndefined();
  });

  test("dasa_news_update PATCHes only the supplied fields", async () => {
    stubFetch({ id: "post-1", title: "Patched" });

    await newsUpdate(
      client,
      updateInputSchema.parse({ id: POST_ID, title: "Patched" }),
    );

    expect(recorded[0]?.method).toBe("PATCH");
    expect(recorded[0]?.url).toBe(`http://api.test/api/admin/posts/${POST_ID}`);
    expect(recorded[0]?.body).toEqual({ title: "Patched" });
  });

  test("publish and unpublish POST to the action paths without a body", async () => {
    stubFetch({ id: "post-1", status: "published", title: "Hello" });
    const input = idInputSchema.parse({ id: POST_ID });

    await newsPublish(client, input);
    await newsUnpublish(client, input);

    expect(recorded.map((call) => `${call.method} ${call.url}`)).toEqual([
      `POST http://api.test/api/admin/posts/${POST_ID}/publish`,
      `POST http://api.test/api/admin/posts/${POST_ID}/unpublish`,
    ]);
    expect(recorded[0]?.body).toBeNull();
    expect(recorded[1]?.body).toBeNull();
  });

  test("dasa_news_delete DELETEs the post", async () => {
    stubFetch({ deleted: true });

    await newsDelete(client, idInputSchema.parse({ id: POST_ID }));

    expect(recorded[0]?.method).toBe("DELETE");
    expect(recorded[0]?.url).toBe(`http://api.test/api/admin/posts/${POST_ID}`);
    expect(recorded[0]?.body).toBeNull();
  });
});

describe("settings tools", () => {
  const settings = {
    accent: null,
    description: "desc",
    enabledSources: ["own"],
    githubUsername: "Dasa122",
    name: "Dasa122",
    ogImage: null,
    socials: {},
    tagline: "tagline",
  };

  test("dasa_settings_get GETs /admin/settings", async () => {
    stubFetch(settings);

    const result = await settingsGet(client);

    expect(recorded[0]?.method).toBe("GET");
    expect(recorded[0]?.url).toBe("http://api.test/api/admin/settings");
    expect(result.structuredContent).toEqual(settings);
  });

  test("dasa_settings_update sends only the provided keys", async () => {
    stubFetch(settings);

    await settingsUpdate(
      client,
      settingsUpdateInputSchema.parse({ tagline: "new tagline" }),
    );

    expect(recorded[0]?.method).toBe("PATCH");
    expect(recorded[0]?.url).toBe("http://api.test/api/admin/settings");
    expect(recorded[0]?.body).toEqual({ tagline: "new tagline" });
    expect(Object.keys(recorded[0]?.body as object)).toEqual(["tagline"]);
  });

  test("a 401 produces a message mentioning DASA_MCP_TOKEN", async () => {
    stubFetch(
      { code: "UNAUTHORIZED", message: "Authentication required" },
      401,
    );

    const result = await settingsGet(client);

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("DASA_MCP_TOKEN");
  });
});
