import { oc } from "@orpc/contract";
import z from "zod";
import {
  adminLinkedInImportSchema,
  adminLinkedInPublishSchema,
  linkedInStatusSchema,
} from "../domains/admin";
import { postSummarySchema } from "../domains/posts";

const ADMIN_LINKEDIN_TAGS = ["Admin / LinkedIn"];

export const adminLinkedin = {
  import: oc
    .route({
      description:
        "Import one LinkedIn post from its public permalink (no credentials needed).",
      method: "POST",
      operationId: "postAdminLinkedinImport",
      path: "/admin/linkedin/import",
      tags: ADMIN_LINKEDIN_TAGS,
    })
    .input(adminLinkedInImportSchema)
    .output(postSummarySchema),
  publish: oc
    .route({
      description: "Publish a LinkedIn post into the feed.",
      method: "POST",
      operationId: "postAdminLinkedin",
      path: "/admin/linkedin",
      tags: ADMIN_LINKEDIN_TAGS,
    })
    .input(adminLinkedInPublishSchema)
    .output(postSummarySchema),
  status: oc
    .route({
      description:
        "Why automatic LinkedIn sync is (in)active; publishing always works.",
      method: "GET",
      operationId: "getAdminLinkedin",
      path: "/admin/linkedin",
      tags: ADMIN_LINKEDIN_TAGS,
    })
    .input(z.object({}))
    .output(linkedInStatusSchema),
};
