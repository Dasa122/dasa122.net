import { oc } from "@orpc/contract";
import z from "zod";

export const adminMedia = {
  upload: oc
    .route({
      description:
        "Upload an image as multipart/form-data with a single `file` field and return its public URL.",
      method: "POST",
      operationId: "postAdminMedia",
      path: "/admin/media",
      tags: ["Admin / Media"],
    })
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
