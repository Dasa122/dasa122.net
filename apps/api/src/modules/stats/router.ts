import type { adminStatsSchema } from "@dasa122/contract";
import { count, eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "../../database";
import { postsTable, syncStateTable } from "../../database/schema";
import { requireAdmin } from "../../middleware/auth";
import { base } from "../../orpc";

export type AdminStats = z.infer<typeof adminStatsSchema>;

/** The dashboard numbers: post counts, a per-source split and sync state. */
export async function getStats(): Promise<AdminStats> {
  const [publishedRow] = await db
    .select({ value: count() })
    .from(postsTable)
    .where(eq(postsTable.status, "published"));
  const [draftRow] = await db
    .select({ value: count() })
    .from(postsTable)
    .where(eq(postsTable.status, "draft"));
  const sourceRows = await db
    .select({ source: postsTable.source, value: count() })
    .from(postsTable)
    .groupBy(postsTable.source);
  const syncRows = await db
    .select({
      lastError: syncStateTable.lastError,
      lastRunAt: syncStateTable.lastRunAt,
      lastStatus: syncStateTable.lastStatus,
      source: syncStateTable.source,
    })
    .from(syncStateTable);

  return {
    bySource: Object.fromEntries(
      sourceRows.map((row) => [row.source, row.value] as const),
    ),
    drafts: draftRow?.value ?? 0,
    lastSync: syncRows.map((row) => ({
      lastError: row.lastError,
      lastRunAt: row.lastRunAt?.toISOString() ?? null,
      lastStatus: row.lastStatus,
      source: row.source,
    })),
    published: publishedRow?.value ?? 0,
  };
}

export const adminStatsRouter = {
  get: base.adminStats.get.handler(async ({ context }) => {
    await requireAdmin(context);
    return getStats();
  }),
};
