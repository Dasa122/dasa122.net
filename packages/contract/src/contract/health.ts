import { oc } from "@orpc/contract";
import z from "zod";

export const health = {
  check: oc
    .route({
      description:
        "Readiness probe: reports the database state and the API version.",
      method: "GET",
      operationId: "getHealth",
      path: "/health",
      tags: ["Health"],
    })
    .input(z.object({}))
    .output(
      z.object({
        database: z.enum(["up", "down"]),
        status: z.enum(["ok", "degraded"]),
        version: z.string(),
      }),
    ),
};
