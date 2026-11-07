import { Prose } from "@dasa122/ui";

/**
 * Renders the API's rendered post body. `bodyHtml` is sanitised at the API
 * boundary, so it goes to `Prose` untouched — sanitising again here would be a
 * second implementation that could drift from the first. A post without a body
 * renders nothing rather than an empty container.
 */
export function MarkdownBody({ html }: { html: string | null }) {
  if (!html) {
    return null;
  }
  return <Prose html={html} />;
}
