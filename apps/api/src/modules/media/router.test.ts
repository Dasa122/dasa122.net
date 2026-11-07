import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { createTestDb, migrateTestDb, resetTables } from "../../test/helpers";
import { uploadMedia } from "./repository";

const testDb = createTestDb();

beforeAll(async () => {
  await migrateTestDb(testDb);
  process.env.MEDIA_DIR = `${process.env.TMPDIR ?? "/tmp"}/dasa-media-${crypto.randomUUID()}`;
});
afterAll(async () => {
  await testDb.$client.end();
});
beforeEach(async () => {
  await resetTables(testDb);
});

describe("uploadMedia", () => {
  test("stores a row and returns a public url", async () => {
    const result = await uploadMedia({
      bytes: new Uint8Array([1, 2, 3]),
      filename: "cover.png",
      mime: "image/png",
    });
    expect(result.url).toBe("/api/media/cover.png");
    expect(result.bytes).toBe(3);
  });

  test("rejects a mime type that is not an image", async () => {
    await expect(
      uploadMedia({
        bytes: new Uint8Array([1]),
        filename: "x.txt",
        mime: "text/plain",
      }),
    ).rejects.toThrow();
  });

  test("a re-upload gets a new name so its immutable url keeps its bytes", async () => {
    const first = await uploadMedia({
      bytes: new Uint8Array([1]),
      filename: "reupload.png",
      mime: "image/png",
    });
    const second = await uploadMedia({
      bytes: new Uint8Array([2, 3]),
      filename: "reupload.png",
      mime: "image/png",
    });

    expect(first.filename).toBe("reupload.png");
    expect(second.filename).toMatch(/^reupload-[0-9a-f]{6}\.png$/);
    expect(second.url).toBe(`/api/media/${second.filename}`);
  });
});
