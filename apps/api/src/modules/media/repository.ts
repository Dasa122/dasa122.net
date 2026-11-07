import { ORPCError } from "@orpc/server";
import { db } from "../../database";
import { mediaTable } from "../../database/schema";
import { env } from "../../env";
import { sanitizeFilename } from "./filename";

export type MediaUpload = {
  bytes: number;
  filename: string;
  id: string;
  mime: string;
  url: string;
};

export type MediaUploadInput = {
  bytes: Uint8Array;
  filename: string;
  mime: string;
};

const ALLOWED_MIME = new Set([
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * The directory uploads live in. Read from `process.env` on each call so a
 * test (or a process that boots before the environment is finalised) can point
 * it elsewhere; `env` is parsed once at module load.
 */
export function mediaDir(): string {
  return process.env.MEDIA_DIR ?? env.mediaDir;
}

/** Joins a filename onto `mediaDir` without importing a path module. */
export function mediaFilePath(filename: string): string {
  return `${mediaDir().replace(/\/+$/, "")}/${filename}`;
}

/** Adds a short random token so a re-upload never reuses an immutable URL. */
async function uniqueFilename(filename: string): Promise<string> {
  const dot = filename.lastIndexOf(".");
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  const extension = dot > 0 ? filename.slice(dot) : "";

  while (true) {
    const token = crypto.randomUUID().replace(/-/g, "").slice(0, 6);
    const candidate = `${base}-${token}${extension}`;
    if (!(await Bun.file(mediaFilePath(candidate)).exists())) {
      return candidate;
    }
  }
}

/**
 * Writes an image under `mediaDir` and records its metadata. The returned URL
 * is under `/api` because the platform proxy only routes `/api` here.
 */
export async function uploadMedia(
  file: MediaUploadInput,
): Promise<MediaUpload> {
  if (!ALLOWED_MIME.has(file.mime)) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Unsupported image type",
    });
  }
  if (file.bytes.byteLength > MAX_BYTES) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Image exceeds 8 MB",
    });
  }

  let filename = sanitizeFilename(file.filename);
  if (await Bun.file(mediaFilePath(filename)).exists()) {
    filename = await uniqueFilename(filename);
  }
  // `Bun.write` creates the file and any missing parent directories.
  await Bun.write(mediaFilePath(filename), file.bytes);

  const [row] = await db
    .insert(mediaTable)
    .values({ bytes: file.bytes.byteLength, filename, mime: file.mime })
    .returning();
  if (row === undefined) {
    throw new Error("media_insert_failed");
  }

  return {
    bytes: row.bytes,
    filename: row.filename,
    id: row.id,
    mime: row.mime,
    url: `/api/media/${row.filename}`,
  };
}
