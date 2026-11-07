import { orpc } from "./orpc";

/**
 * One query options object shared by the admin layout's gate and the
 * dashboard's loader, so the guard's check and the page's render hit the same
 * cache entry.
 */
export const adminStatsOptions = orpc.adminStats.get.queryOptions({
  input: {},
});
