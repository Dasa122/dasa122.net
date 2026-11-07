import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SourceBadge } from "./source-badge";

describe("SourceBadge", () => {
  test("renders the note label for an own post", () => {
    expect(renderToStaticMarkup(<SourceBadge source="own" />)).toContain(
      "NOTE",
    );
  });

  test("renders the github label", () => {
    expect(renderToStaticMarkup(<SourceBadge source="github" />)).toContain(
      "GITHUB",
    );
  });

  test("renders the linkedin label", () => {
    expect(renderToStaticMarkup(<SourceBadge source="linkedin" />)).toContain(
      "LINKEDIN",
    );
  });

  test("uses the accessible note source token, not the non-text ember token", () => {
    const html = renderToStaticMarkup(<SourceBadge source="own" />);
    expect(html).toContain("text-source-note");
    expect(html).not.toMatch(/text-ember\b(?!-)/);
  });

  test("colours an imported source with its own token", () => {
    expect(renderToStaticMarkup(<SourceBadge source="github" />)).toContain(
      "text-source-github",
    );
    expect(renderToStaticMarkup(<SourceBadge source="linkedin" />)).toContain(
      "text-source-linkedin",
    );
  });
});
