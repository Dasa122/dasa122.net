import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "./button";

describe("Button", () => {
  test("the solid variant fills with the dedicated ember-fill token", () => {
    const html = renderToStaticMarkup(<Button variant="solid">Go</Button>);
    expect(html).toContain("bg-ember-fill");
    expect(html).not.toContain("bg-ember-text");
    expect(html).not.toMatch(/bg-ember\b(?!-)/);
  });
});
