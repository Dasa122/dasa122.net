import { Marked, type Token, type Tokens } from "marked";
import { codeToHtml } from "shiki";

const HIGHLIGHT_THEME = "github-dark";

const BLOCKED_TAGS = [
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "form",
] as const;

/**
 * Removes elements whose content must never reach the browser — together with
 * their content, not only their tags — and neutralises `javascript:` URLs in
 * `href`/`src`. This is the only guard between an author-written post and the
 * frontend's `dangerouslySetInnerHTML`.
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
  sanitized = sanitized.replace(
    /\b(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi,
    '$1="#"',
  );
  sanitized = sanitized.replace(
    /\b(href|src)\s*=\s*(?!["'])\s*javascript:[^\s>]+/gi,
    '$1="#"',
  );
  return sanitized;
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

/**
 * Marked awaits `walkTokens` before parsing, so each fenced code token can be
 * replaced with shiki's HTML and rendered as raw markup by the built-in
 * `html` renderer.
 */
const markdown = new Marked({
  async: true,
  gfm: true,
  walkTokens: async (token: Token) => {
    if (token.type !== "code") {
      return;
    }
    const code = token as Tokens.Code;
    const highlighted = await highlight(code.text, code.lang);
    Object.assign(token, { text: highlighted, type: "html" });
  },
});

/** Renders markdown to sanitized HTML with shiki-highlighted code blocks. */
export async function renderMarkdown(source: string): Promise<string> {
  return sanitizeHtml(await markdown.parse(source));
}
