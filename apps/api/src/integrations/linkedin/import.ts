import { ORPCError } from "@orpc/server";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { type Database, db } from "../../database";
import { postsTable } from "../../database/schema";
import { insertPostRepo, slugExistsRepo } from "../../modules/posts/repository";
import { type PostSummary, toSummary } from "../../modules/posts/service";
import { deriveExcerpt, readingTimeMinutes } from "../../util/excerpt";
import { slugify, uniqueSlug } from "../../util/slug";

const LINKEDIN_HOST = "linkedin.com";
const EMBED_BASE =
  "https://www.linkedin.com/embed/feed/update/urn:li:activity:";
const TIMEOUT_MS = 10_000;
const TITLE_MAX_LENGTH = 120;

/**
 * LinkedIn serves the embed page only to a browser-looking client; its bot
 * block (`999`) is triggered by unknown agents, so the UA is deliberately real.
 */
const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const INVALID_URL_MESSAGE =
  "Paste a LinkedIn post link — a linkedin.com/posts/…-activity-… URL or the post's embed URL.";
const FETCH_FAILED_MESSAGE =
  "Could not read that post from LinkedIn. It may be deleted or private; check the link and try again.";

/** What the public embed exposes: the post text and, when present, its date. */
export type PublicPost = {
  postedAt: Date | null;
  text: string;
};

/**
 * The digits of a LinkedIn activity, from a post permalink or an embed URL.
 * Anything else — another host, a profile page, a `javascript:` URL — is
 * `null`, so callers can never turn this into a generic fetcher.
 */
export function extractPostId(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (host !== LINKEDIN_HOST && !host.endsWith(`.${LINKEDIN_HOST}`)) {
    return null;
  }

  const embed = /^\/embed\/feed\/update\/urn:li:activity:(\d+)\/?$/.exec(
    url.pathname,
  );
  if (embed !== null) {
    return embed[1] ?? null;
  }

  if (!url.pathname.startsWith("/posts/")) {
    return null;
  }
  return /activity-(\d+)/.exec(url.pathname)?.[1] ?? null;
}

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

/** Decodes the named and numeric entities LinkedIn writes into meta tags. */
function decodeEntities(value: string): string {
  return value.replace(
    /&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi,
    (match, entity: string) => {
      if (entity.startsWith("#")) {
        const hex = entity[1]?.toLowerCase() === "x";
        const code = Number.parseInt(
          hex ? entity.slice(2) : entity.slice(1),
          hex ? 16 : 10,
        );
        return Number.isInteger(code) && code >= 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : match;
      }
      return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
    },
  );
}

/** The text of one `<meta>` tag, whichever order its attributes arrive in. */
function metaContent(html: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:name|property)="${escaped}"[^>]+content="([^"]*)"`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content="([^"]*)"[^>]+(?:name|property)="${escaped}"`,
      "i",
    ),
  ];
  for (const pattern of patterns) {
    const value = pattern.exec(html)?.[1];
    if (value !== undefined && value.trim() !== "") {
      return value;
    }
  }
  return null;
}

/** Plain text: entities decoded, CRLF normalised, paragraphs kept, no dangling
 * ellipsis or whitespace. */
function normaliseText(raw: string): string {
  return decodeEntities(raw)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .replace(/\s*(?:…|\.{3})\s*$/, "")
    .trim();
}

/**
 * `GET` the public embed page for one activity and read the post text out of
 * its `description` meta (`og:description` as the fallback). A non-200 answer
 * and an unreadable body are distinct, named failures.
 */
export async function fetchPublicPost(
  activityId: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<PublicPost> {
  const response = await fetchImpl(`${EMBED_BASE}${activityId}`, {
    headers: { Accept: "text/html", "User-Agent": DESKTOP_UA },
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status !== 200) {
    throw new Error("linkedin_fetch_failed");
  }

  const html = await response.text();
  const description =
    metaContent(html, "description") ?? metaContent(html, "og:description");
  const text = description === null ? "" : normaliseText(description);
  if (text === "") {
    throw new Error("linkedin_parse_failed");
  }

  const datetime = /<time[^>]+datetime="([^"]+)"/i.exec(html)?.[1];
  const postedAt = datetime === undefined ? null : new Date(datetime);
  return {
    postedAt:
      postedAt === null || Number.isNaN(postedAt.getTime()) ? null : postedAt,
    text,
  };
}

function canonicalPostUrl(activityId: string): string {
  return `https://www.linkedin.com/feed/update/urn:li:activity:${activityId}/`;
}

/** The title is the post's first non-empty line, capped at 120 characters. */
function titleFrom(text: string): string {
  const firstLine = text.split("\n").find((line) => line.trim() !== "") ?? "";
  return firstLine.trim().slice(0, TITLE_MAX_LENGTH).trim();
}

/**
 * An existing post that already links to this activity, matched by the URL the
 * admin pasted or by the canonical URL, on either the `externalUrl` column or
 * the stored LinkedIn metadata.
 */
async function findExisting(
  executor: Database,
  urls: string[],
): Promise<PostSummary | null> {
  const [row] = await executor
    .select()
    .from(postsTable)
    .where(
      and(
        eq(postsTable.source, "linkedin"),
        or(
          inArray(postsTable.externalUrl, urls),
          inArray(sql<string>`${postsTable.linkedinMeta}->>'permalink'`, urls),
        ),
      ),
    )
    .limit(1);
  return row === undefined ? null : toSummary(row);
}

export type ImportOptions = {
  database?: Database;
  fetchImpl?: typeof fetch;
};

/**
 * Imports one LinkedIn post from its public permalink. No credentials are
 * involved: the embed page is public, so the admin only needs the link.
 * Importing the same post twice returns the post that already exists.
 */
export async function importLinkedInPost(
  input: { permalink: string },
  options: ImportOptions = {},
): Promise<PostSummary> {
  const database = options.database ?? db;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  const permalink = input.permalink.trim();
  const activityId = extractPostId(permalink);
  if (activityId === null) {
    throw new ORPCError("BAD_REQUEST", { message: INVALID_URL_MESSAGE });
  }

  const canonicalUrl = canonicalPostUrl(activityId);
  const existing = await findExisting(database, [permalink, canonicalUrl]);
  if (existing !== null) {
    return existing;
  }

  let post: PublicPost;
  try {
    post = await fetchPublicPost(activityId, fetchImpl);
  } catch {
    throw new ORPCError("BAD_GATEWAY", { message: FETCH_FAILED_MESSAGE });
  }

  const title = titleFrom(post.text);
  const slug = await uniqueSlug(slugify(title), (candidate) =>
    slugExistsRepo(database, candidate),
  );
  const row = await insertPostRepo(database, {
    body: post.text,
    excerpt: deriveExcerpt(post.text),
    externalUrl: canonicalUrl,
    linkedinMeta: {
      permalink,
      postedAt: post.postedAt?.toISOString() ?? null,
    },
    publishedAt: post.postedAt ?? new Date(),
    readTimeMin: readingTimeMinutes(post.text),
    slug,
    source: "linkedin",
    status: "published",
    tags: [],
    title: title === "" ? "LinkedIn post" : title,
  });
  return toSummary(row);
}
