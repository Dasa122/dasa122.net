import { describe, expect, test } from "bun:test";
import { parseCookies, serializeCookie } from "./cookies";

describe("cookies", () => {
  test("parses multiple cookies", () => {
    expect(parseCookies("a=1; b=2")).toEqual({ a: "1", b: "2" });
  });

  test("returns an empty object for a null header", () => {
    expect(parseCookies(null)).toEqual({});
  });

  test("serializes with the given attributes", () => {
    const cookie = serializeCookie("dasa_session", "abc", {
      httpOnly: true,
      maxAge: 3600,
      path: "/",
      sameSite: "Lax",
      secure: true,
    });
    expect(cookie).toContain("dasa_session=abc");
    expect(cookie).toContain("Max-Age=3600");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
  });

  test("omits attributes that were not requested", () => {
    const cookie = serializeCookie("x", "1");
    expect(cookie).toBe("x=1");
  });
});
