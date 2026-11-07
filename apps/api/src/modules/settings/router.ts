import { requireAdmin } from "../../middleware/auth";
import { base } from "../../orpc";
import { getSettings, updateSettings } from "./repository";

/** Public: the merged settings the site shell renders. */
export const siteRouter = {
  get: base.site.get.handler(() => getSettings()),
};

export const adminSettingsRouter = {
  get: base.adminSettings.get.handler(async ({ context }) => {
    await requireAdmin(context);
    return getSettings();
  }),
  update: base.adminSettings.update.handler(async ({ context, input }) => {
    await requireAdmin(context);
    return updateSettings(input);
  }),
};
