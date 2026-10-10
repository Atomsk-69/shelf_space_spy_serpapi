import { describe, expect, it } from "vitest";

import { parseBrief } from "./brief";
import { scrubText, visibleLines } from "./text";

describe("hidden wording", () => {
  it("drops lines that mention demo data or credits, and keeps everything else", () => {
    expect(visibleLines(["Includes demo historical data.", "Only 1 scan of history.", "Spent 4 credits", "Shelf is a sample."])).toEqual([
      "Only 1 scan of history.",
      "Shelf is a sample.",
    ]);
    expect(scrubText("Headline\nNote: part of the history is demo data.\n- Real point")).toBe("Headline\n- Real point");
  });

  it("is applied by the brief parser, so an old stored note never reaches the page", () => {
    const brief = parseBrief(
      "Weekly brief: X\nNote: part of the history in this brief is demo data, not real observations.\n\nWatch-outs\n- Sampled shelf.",
    );
    expect(JSON.stringify(brief).toLowerCase()).not.toContain("demo");
    expect(brief.sections.map((s) => s.title)).toEqual(["Watch-outs"]);
  });
});
