import { oc } from "@orpc/contract";
import z from "zod";
import { siteSettingsSchema } from "../domains/site";

export const site = {
  get: oc
    .route({
      description: "Read the site settings.",
      method: "GET",
      operationId: "getSite",
      path: "/site",
      tags: ["Site"],
    })
    .input(z.object({}))
    .output(siteSettingsSchema),
};
