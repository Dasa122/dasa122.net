import { oc } from "@orpc/contract";
import z from "zod";
import { adminStatsSchema } from "../domains/admin";

export const adminStats = {
  get: oc
    .route({
      description: "The admin dashboard numbers.",
      method: "GET",
      operationId: "getAdminStats",
      path: "/admin/stats",
      tags: ["Admin / Stats"],
    })
    .input(z.object({}))
    .output(adminStatsSchema),
};
