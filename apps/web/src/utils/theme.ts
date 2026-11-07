import type { CSSProperties } from "react";

/**
 * A complete `oklch()` colour and nothing else: letters, parens, digits,
 * separators, a slash and a percent sign. No semicolon, quote or brace can
 * reach the document root through this value.
 */
const OKLCH =
  /^oklch\(\s*-?(?:\d+(?:\.\d+)?|\.\d+)%?\s+-?(?:\d+(?:\.\d+)?|\.\d+)%?\s+-?(?:\d+(?:\.\d+)?|\.\d+)(?:deg)?(?:\s*\/\s*(?:\d+(?:\.\d+)?|\.\d+)%?)?\s*\)$/i;

/** A stored accent, or `null` when the value is not a standalone oklch colour. */
export function validAccent(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const accent = value.trim();
  return accent.length > 0 && accent.length <= 80 && OKLCH.test(accent)
    ? accent
    : null;
}

/**
 * The accent overrides the static ember trio on the root element. Everything
 * that uses the palette inherits it; an invalid value yields no style at all.
 */
export function accentStyle(
  value: string | null | undefined,
): CSSProperties | undefined {
  const accent = validAccent(value);
  if (accent === null) {
    return undefined;
  }
  return {
    "--color-ember": accent,
    "--color-ember-fill": accent,
    "--color-ember-text": accent,
  } as CSSProperties;
}
