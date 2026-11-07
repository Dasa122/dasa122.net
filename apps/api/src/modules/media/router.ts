import { ORPCError } from "@orpc/server";
import { requireAdmin } from "../../middleware/auth";
import { base } from "../../orpc";
import { type MediaUpload, uploadMedia } from "./repository";

/**
 * Reads the single `file` part of a multipart request and stores it.
 *
 * The contract's input describes the resulting metadata, which cannot carry
 * file bytes; the upload endpoint is therefore dispatched as multipart from
 * `index.ts` before the oRPC JSON input validation runs.
 */
export async function readMediaUpload(request: Request): Promise<MediaUpload> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ORPCError("BAD_REQUEST", {
      message: "Expected multipart form data",
    });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Expected a file part named 'file'",
    });
  }

  return uploadMedia({
    bytes: new Uint8Array(await file.arrayBuffer()),
    filename: file.name,
    mime: file.type,
  });
}

export const adminMediaRouter = {
  upload: base.adminMedia.upload.handler(async ({ context }) => {
    await requireAdmin(context);
    return readMediaUpload(context.request);
  }),
};
