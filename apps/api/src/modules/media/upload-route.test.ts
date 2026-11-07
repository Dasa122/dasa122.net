import { afterAll, expect, test } from "bun:test";

process.env.MEDIA_DIR = `${process.env.TMPDIR ?? "/tmp"}/dasa-upload-${crypto.randomUUID()}`;
const mediaDir = process.env.MEDIA_DIR;
const { server } = await import("../../index");

afterAll(() => {
  server.stop(true);
});

function url(path: string): string {
  return `http://localhost:${server.port}${path}`;
}

test("an upload without a session is rejected before any file is written", async () => {
  const form = new FormData();
  form.set(
    "file",
    new File([new Uint8Array([1, 2, 3])], "cover.png", { type: "image/png" }),
  );

  const response = await fetch(url("/api/admin/media"), {
    body: form,
    method: "POST",
  });

  expect(response.status).toBe(401);
  expect(await Bun.file(`${mediaDir}/cover.png`).exists()).toBe(false);
});

test("malformed media paths answer 400, never 500", async () => {
  for (const path of ["%00", "%2e", ""]) {
    const response = await fetch(url(`/api/media/${path}`));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "bad_request",
      message: "Invalid media filename",
    });
  }
});

test("encoded traversal answers 400", async () => {
  const response = await fetch(url("/api/media/..%2f..%2fetc%2fpasswd"));
  expect(response.status).toBe(400);
});
