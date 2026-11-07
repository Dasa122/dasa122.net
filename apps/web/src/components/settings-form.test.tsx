import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SettingsForm } from "./settings-form";

describe("SettingsForm", () => {
  test("renders the tagline field", () => {
    const html = renderToStaticMarkup(
      <SettingsForm
        initial={{
          accent: "",
          description: "",
          enabledSources: ["own", "github", "linkedin"],
          githubUsername: "Dasa122",
          name: "Dasa122",
          ogImage: "",
          socials: {},
          tagline: "",
        }}
        isPending={false}
        onSave={() => {}}
      />,
    );
    expect(html).toContain("Tagline");
  });
});
