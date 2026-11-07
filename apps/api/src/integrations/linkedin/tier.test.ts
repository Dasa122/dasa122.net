import { describe, expect, test } from "bun:test";
import { resolveLinkedInTier } from "./tier";

describe("resolveLinkedInTier", () => {
  test("is unconfigured without client credentials", () => {
    expect(
      resolveLinkedInTier(
        { accessToken: null, clientId: "", clientSecret: "" },
        null,
      ),
    ).toBe("unconfigured");
  });

  test("is manual with client credentials but no access token", () => {
    expect(
      resolveLinkedInTier(
        { accessToken: null, clientId: "id", clientSecret: "secret" },
        null,
      ),
    ).toBe("manual");
  });

  test("is active when the token carries r_member_social", () => {
    expect(
      resolveLinkedInTier(
        { accessToken: "tok", clientId: "id", clientSecret: "secret" },
        ["r_member_social"],
      ),
    ).toBe("active");
  });

  test("is insufficient_scope when the token lacks r_member_social", () => {
    expect(
      resolveLinkedInTier(
        { accessToken: "tok", clientId: "id", clientSecret: "secret" },
        ["r_liteprofile"],
      ),
    ).toBe("insufficient_scope");
  });

  test("is manual when the granted scopes are unknown", () => {
    expect(
      resolveLinkedInTier(
        { accessToken: "tok", clientId: "id", clientSecret: "secret" },
        null,
      ),
    ).toBe("manual");
  });
});
