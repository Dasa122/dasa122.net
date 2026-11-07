import { oc } from "@orpc/contract";
import z from "zod";
import { mediaUploadSchema } from "../domains/admin";

export const adminMedia = {
  upload: oc
    .route({
      description: "Upload an image and return its public URL.",
      method: "POST",
      operationId: "postAdminMedia",
      path: "/admin/media",
      tags: ["Admin / Media"],
    })
    .input(mediaUploadSchema)
    .output(
      z.object({
        bytes: z.number().int(),
        filename: z.string(),
        id: z.uuid(),
        mime: z.string(),
        url: z.string(),
      }),
    ),
};
