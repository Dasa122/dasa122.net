/**
 * Turns a title into a URL-safe slug: lowercases, collapses every run of
 * non-alphanumeric characters into a single dash, trims the edges and caps the
 * result at 80 characters. Input with no alphanumerics yields `''`; callers
 * substitute a fallback before persisting.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/**
 * Returns `base` when it is free, otherwise `base-2`, `base-3`, and so on. The
 * existence check is injected so this helper stays free of database imports;
 * the posts and LinkedIn domains share it.
 */
export async function uniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  const root = base === "" ? "post" : base;
  let candidate = root;
  let suffix = 2;
  while (await exists(candidate)) {
    candidate = `${root}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}
