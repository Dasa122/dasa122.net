import { requireAdmin } from "../../middleware/auth";
import { base } from "../../orpc";
import { getLinkedInStatus, publishLinkedInPost } from "./sync";

export const adminLinkedinRouter = {
  publish: base.adminLinkedin.publish.handler(async ({ context, input }) => {
    await requireAdmin(context);
    return publishLinkedInPost(input);
  }),
  status: base.adminLinkedin.status.handler(async ({ context }) => {
    await requireAdmin(context);
    return getLinkedInStatus();
  }),
};
