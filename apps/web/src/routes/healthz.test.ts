import { describe, expect, test } from "bun:test";
import { healthzHandler } from "./healthz";

describe("/healthz", () => {
  test("responds ok without touching the database", async () => {
    const response = await healthzHandler();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });
});
