import z from "zod";

/**
 * The canonical list response: `{ items, total }`, with no envelope. Cursor
 * pagination adds `nextCursor` where a procedure needs it (see
 * `postsListResponseSchema`); plain lists stop at `total`.
 */
export const listResponse = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), total: z.number() });
