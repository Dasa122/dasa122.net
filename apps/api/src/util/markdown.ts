import { Marked, type Token, type Tokens } from "marked";
import { codeToHtml } from "shiki";

const HIGHLIGHT_THEME = "github-dark";
const URL_BASE = "https://example.invalid";
const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

const BLOCKED_TAGS = [
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "form",
] as const;

/**
 * A raw HTML token that opens (or closes) a blocked element is discarded
 * whole, so its content never survives as text either.
 */
const BLOCKED_ELEMENT =
  /^<\s*\/?\s*(?:script|style|iframe|object|embed|form)\b/i;

/** Event-handler attributes are removed before author HTML is escaped. */
const EVENT_HANDLER_ATTRIBUTE =
  /\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

const URL_ATTRIBUTE = /\b(href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;

const NAMED_REFERENCES: Record<string, string> = {
  amp: "&",
  apos: "'",
  colon: ":",
  gt: ">",
  lt: "<",
  newline: "\n",
  quot: '"',
  tab: "\t",
};

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Decodes character references once, the way a browser parses an attribute. */
function decodeCharacterReferences(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (match, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    })
    .replace(/&#(\d+);?/g, (match, decimal: string) => {
      const code = Number.parseInt(decimal, 10);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    })
    .replace(
      /&([a-z]+);/gi,
      (match, name: string) => NAMED_REFERENCES[name.toLowerCase()] ?? match,
    );
}

/** Browsers ignore ASCII whitespace and control characters inside a URL. */
function stripUnsafeUrlCharacters(value: string): string {
  let result = "";
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code > 0x20 && code !== 0x7f) {
      result += character;
    }
  }
  return result;
}

/**
 * Parses a decoded attribute value and allowlists its scheme. Browsers strip
 * ASCII whitespace/control characters before resolving a URL, so those are
 * removed before the protocol check too.
 */
function isSafeUrl(raw: string): boolean {
  const decoded = decodeCharacterReferences(raw);
  const normalized = stripUnsafeUrlCharacters(decoded);
  if (normalized === "") {
    return true;
  }
  try {
    return SAFE_PROTOCOLS.has(new URL(normalized, URL_BASE).protocol);
  } catch {
    return false;
  }
}

/**
 * Author-authored HTML is never emitted as markup: blocked elements are
 * discarded and everything else is escaped to visible text. Event-handler
 * attributes are stripped first so even the escaped text cannot masquerade as
 * markup.
 */
function renderAuthorHtml(raw: string): string {
  const token = raw.trim();
  if (BLOCKED_ELEMENT.test(token)) {
    return "";
  }
  return escapeHtmlText(token.replace(EVENT_HANDLER_ATTRIBUTE, ""));
}

function sanitizeUrlAttributes(html: string): string {
  // Only real tags are rewritten; escaped author HTML (`&lt;img ...&gt;`) is
  // visible text and must not be mistaken for markup.
  return html.replace(/<[^>]*>/g, (tag) =>
    tag.replace(
      URL_ATTRIBUTE,
      (
        _match,
        name: string,
        doubleQuoted?: string,
        singleQuoted?: string,
        unquoted?: string,
      ) => {
        const value = doubleQuoted ?? singleQuoted ?? unquoted ?? "";
        const safe = isSafeUrl(value) ? value : "#";
        return `${name}="${safe.replace(/"/g, "&quot;")}"`;
      },
    ),
  );
}

/**
 * Defence in depth: removes the blocked elements (with their content) from any
 * HTML string and allowlists every `href`/`src` scheme. The primary guard is
 * that author HTML is escaped by `renderAuthorHtml`; this catches a future
 * change that accidentally emits raw HTML.
 */
export function sanitizeHtml(html: string): string {
  let sanitized = html;
  for (const tag of BLOCKED_TAGS) {
    sanitized = sanitized.replace(
      new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, "gi"),
      "",
    );
    sanitized = sanitized.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, "gi"), "");
  }
  return sanitizeUrlAttributes(sanitized);
}

/** Highlights one fenced block, falling back to plain text for unknown languages. */
async function highlight(
  code: string,
  lang: string | undefined,
): Promise<string> {
  const language = lang?.trim().split(/\s+/)[0] ?? "";
  try {
    return await codeToHtml(code, {
      lang: language || "text",
      theme: HIGHLIGHT_THEME,
    });
  } catch {
    return await codeToHtml(code, {
      lang: "text",
      theme: HIGHLIGHT_THEME,
    });
  }
}

function renderPlainCode(token: Tokens.Code): string {
  const language = token.lang?.trim().split(/\s+/)[0];
  return language === undefined || language === ""
    ? `<pre><code>${escapeHtmlText(token.text)}</code></pre>`
    : `<pre><code class="language-${escapeHtmlText(language)}">${escapeHtmlText(token.text)}</code></pre>`;
}

/**
 * Marked awaits `walkTokens` before parsing, so shiki can run asynchronously
 * and the `code` renderer can return the generated markup verbatim. The
 * WeakMap keys are the per-parse token objects, so concurrent requests cannot
 * see each other's highlights.
 */
const highlightedBlocks = new WeakMap<Token, string>();

const markdown = new Marked({
  async: true,
  gfm: true,
  renderer: {
    code(token) {
      return highlightedBlocks.get(token) ?? renderPlainCode(token);
    },
    html(token) {
      return renderAuthorHtml(token.text);
    },
  },
  walkTokens: async (token) => {
    if (token.type !== "code") {
      return;
    }
    const code = token as Tokens.Code;
    highlightedBlocks.set(token, await highlight(code.text, code.lang));
  },
});

/** Renders markdown to sanitized HTML with shiki-highlighted code blocks. */
export async function renderMarkdown(source: string): Promise<string> {
  return sanitizeHtml(await markdown.parse(source));
}
