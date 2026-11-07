/** Drops keys whose value is `undefined`, so a patch never sends a blank key. */
export function stripUndefined<T extends object>(object: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

/** Serializes defined query parameters into a `?a=b` suffix (or an empty string). */
export function toQuery(
  params: Record<string, number | string | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query === "" ? "" : `?${query}`;
}
