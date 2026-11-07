import { oc } from "@orpc/contract";
import z from "zod";
import { settingsUpdateSchema, siteSettingsSchema } from "../domains/site";

const ADMIN_SETTINGS_TAGS = ["Admin / Settings"];

export const adminSettings = {
  get: oc
    .route({
      description: "Read the site settings.",
      method: "GET",
      operationId: "getAdminSettings",
      path: "/admin/settings",
      tags: ADMIN_SETTINGS_TAGS,
    })
    .input(z.object({}))
    .output(siteSettingsSchema),
  update: oc
    .route({
      description: "Patch the site settings.",
      method: "PATCH",
      operationId: "patchAdminSettings",
      path: "/admin/settings",
      tags: ADMIN_SETTINGS_TAGS,
    })
    .input(settingsUpdateSchema)
    .output(siteSettingsSchema),
};
