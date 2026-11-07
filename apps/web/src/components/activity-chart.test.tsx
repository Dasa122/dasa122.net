import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ActivityChart } from "./activity-chart";

describe("ActivityChart", () => {
  test("renders one bar per day", () => {
    const activity = [
      { count: 3, date: "2026-11-05" },
      { count: 7, date: "2026-11-06" },
    ];
    const html = renderToStaticMarkup(<ActivityChart activity={activity} />);
    expect(html).toContain("2026-11-05");
    expect(html).toContain("2026-11-06");
    expect(html).toContain("7");
  });

  test("renders an empty state when there is no activity", () => {
    const html = renderToStaticMarkup(<ActivityChart activity={[]} />);
    expect(html).toContain("No activity yet");
  });
});
