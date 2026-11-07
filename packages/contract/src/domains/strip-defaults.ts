import z from "zod";

/**
 * The field type after a `.default()` is removed, unwrapping an optional that
 * wraps one. Other schemas pass through unchanged.
 */
type WithoutDefault<T> =
  T extends z.ZodDefault<infer U extends z.core.$ZodType>
    ? U
    : T extends z.ZodOptional<infer U extends z.core.$ZodType>
      ? z.ZodOptional<WithoutDefault<U>>
      : T;

/**
 * Replaces a field that carries a `.default()` with the same field without one,
 * including a default wrapped in `.optional()`.
 */
function stripDefault(schema: z.core.$ZodType): z.core.$ZodType {
  if (schema instanceof z.ZodDefault) {
    return schema.removeDefault();
  }
  if (schema instanceof z.ZodOptional) {
    const inner = schema.unwrap();
    if (inner instanceof z.ZodDefault) {
      return z.optional(inner.removeDefault());
    }
  }
  return schema;
}

/**
 * Drops the create-time defaults from a shape. `.partial()` only marks a field
 * optional: a `ZodDefault` still substitutes its default for an omitted key,
 * which would turn a one-field PATCH into a full overwrite.
 *
 * The return type preserves every key with the `WithoutDefault` field type, so
 * `.shape.<field>` lookups still type-check. The cast is needed only because
 * `Object.fromEntries` forgets which keys it was given; the runtime transform
 * above produces exactly that type.
 */
export function withoutDefaults<T extends z.ZodRawShape>(
  shape: T,
): { [K in keyof T]: WithoutDefault<T[K]> } {
  return Object.fromEntries(
    Object.entries(shape).map(([key, schema]) => [key, stripDefault(schema)]),
  ) as { [K in keyof T]: WithoutDefault<T[K]> };
}
