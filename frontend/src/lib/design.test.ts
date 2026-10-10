import { describe, expect, it } from "vitest";

import { parseBrief, findSection } from "./brief";
import { buildTrendChart } from "./demand";
import { NO_FILTERS, evidenceEntries, filterEvents, groupByDay } from "./events";
import { buildHeatmap, previousScanId, shareChanges } from "./shelf";
import { buildSignals } from "./signals";
import { event } from "../test/fixtures";
import type { Opportunity, ShelfRow } from "../types";

const opp = (keyword: string, score: number, label = "Attractive"): Opportunity => ({
  keyword,
  score,
  label,
  demand_growth: 10,
  supply_growth: -5,
  reasons: [],
  caveats: [],
});

describe("buildSignals", () => {
  it("lists strong opportunities first, then events by severity, capped at five", () => {
    const events = [
      event({ id: 1, severity: "low", detected_at: "2026-10-03T10:00:00+00:00" }),
      event({ id: 2, severity: "high", detected_at: "2026-10-01T10:00:00+00:00" }),
      event({ id: 3, severity: "high", detected_at: "2026-10-02T10:00:00+00:00" }),
      event({ id: 4, severity: "medium" }),
      event({ id: 5, severity: "medium" }),
    ];
    const signals = buildSignals({ opportunities: [opp("weak", 20, "Crowded"), opp("good", 80, "Golden"), opp("fine", 60)], events });
    expect(signals.map((s) => s.key)).toEqual(["opp-good", "opp-fine", "event-3", "event-2", "event-4"]);
  });

  it("is empty when there is nothing strong or recent", () => {
    expect(buildSignals({ opportunities: [opp("weak", 10, "Crowded")], events: [] })).toEqual([]);
  });
});

describe("parseBrief", () => {
  const text =
    "Weekly brief: Tents\n\nPeriod: a to b\n\nWhat changed\n- One\n- Two\n\n## Opportunities\n- Three\n\nWatch-outs:\n- **Four**";
  it("splits the headline and the four known sections, and keeps stray text", () => {
    const brief = parseBrief(text);
    expect(brief.headline).toBe("Weekly brief: Tents");
    expect(brief.sections.map((s) => s.title)).toEqual(["Overview", "What changed", "Opportunities", "Watch-outs"]);
    expect(findSection(brief, "What changed")?.bullets).toEqual(["One", "Two"]);
    expect(findSection(brief, "Watch-outs")?.bullets).toEqual(["Four"]);
    expect(findSection(brief, "Overview")?.text).toEqual(["Period: a to b"]);
  });
  it("handles empty and unstructured text without losing it", () => {
    expect(parseBrief("   ")).toEqual({ headline: "", sections: [] });
    expect(parseBrief("Just a sentence.\nAnother.").sections[0].text).toEqual(["Another."]);
  });
});

describe("buildTrendChart", () => {
  const weeks = (n: number, partialLast = false) =>
    Array.from({ length: n }, (_, i) => ({
      week_start: `2026-01-${String(i + 1).padStart(2, "0")}`,
      interest: 10 + i,
      is_partial: partialLast && i === n - 1,
    }));

  it("shades the last 4 complete weeks and the 8 before, and never counts a partial week", () => {
    const { windows, completeWeeks, partialWeeks, rows } = buildTrendChart(weeks(21, true));
    expect(completeWeeks).toBe(20);
    expect(partialWeeks).toBe(1);
    expect(windows.recent).toEqual(["2026-01-17", "2026-01-20"]);
    expect(windows.prior).toEqual(["2026-01-09", "2026-01-16"]);
    const last = rows.at(-1)!;
    expect(last.complete).toBeNull();
    expect(last.partial).toBe(30);
    expect(rows.at(-2)!.partial).toBe(29); // dashed segment joins the last complete week
  });

  it("handles short history and series with no partial week", () => {
    const { windows, rows } = buildTrendChart(weeks(5));
    expect(windows.recent).toEqual(["2026-01-02", "2026-01-05"]);
    expect(windows.prior).toEqual(["2026-01-01", "2026-01-01"]);
    expect(rows.every((row) => row.partial === null)).toBe(true);
    expect(buildTrendChart([]).windows).toEqual({ recent: null, prior: null });
  });
});

describe("shelf helpers", () => {
  const row = (brand: string, share: number, is_mine = false): ShelfRow => ({ brand, share_pct: share, listings: 1, is_mine });

  it("builds a brand x probe grid, marks absent cells null and puts your brand first", () => {
    const model = buildHeatmap({
      "probe a": [row("Big", 30), row("Mine", 10, true), row("Other brands", 5)],
      "probe b": [row("Big", 20), row("Small", 8)],
    });
    expect(model.probes).toEqual(["probe a", "probe b"]);
    expect(model.rows.map((r) => r.brand)).toEqual(["Mine", "Big", "Small"]);
    expect(model.rows[0].cells).toEqual([10, null]);
    expect(model.rows.find((r) => r.brand === "Other brands")).toBeUndefined();
    expect(model.max).toBe(30);
  });

  it("reports share changes only for brands listed in both scans", () => {
    const changes = shareChanges(
      [row("Up", 20), row("Down", 5), row("New", 9), row("Unbranded", 40), row("Other brands", 10)],
      [row("Up", 15), row("Down", 9), row("Gone", 7), row("Unbranded", 10)],
    );
    expect(changes.gainers).toEqual([{ brand: "Up", before: 15, now: 20, delta: 5, isMine: false }]);
    expect(changes.decliners[0]).toMatchObject({ brand: "Down", delta: -4 });
    expect(changes.enteredList).toEqual(["New"]);
    expect(changes.leftList).toEqual(["Gone"]);
  });

  it("finds the scan before the current one", () => {
    const scans = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect(previousScanId(scans, 3)).toBe(2);
    expect(previousScanId(scans, 1)).toBeNull();
    expect(previousScanId(scans, null)).toBeNull();
    expect(previousScanId(scans, 99)).toBeNull();
  });
});

describe("event filtering and grouping", () => {
  const events = [
    event({ id: 1, severity: "high", confidence: "high", detected_at: "2026-10-02T12:00:00" }),
    event({ id: 2, severity: "low", confidence: "medium", detected_at: "2026-10-02T09:00:00" }),
    event({ id: 3, severity: "medium", confidence: "low", detected_at: "2026-09-30T12:00:00" }),
  ];

  it("filters by severity, confidence and inclusive local dates", () => {
    expect(filterEvents(events, { ...NO_FILTERS, severity: "high" }).map((e) => e.id)).toEqual([1]);
    expect(filterEvents(events, { ...NO_FILTERS, confidence: "low" }).map((e) => e.id)).toEqual([3]);
    expect(filterEvents(events, { ...NO_FILTERS, from: "2026-10-02" }).map((e) => e.id)).toEqual([1, 2]);
    expect(filterEvents(events, { ...NO_FILTERS, to: "2026-09-30" }).map((e) => e.id)).toEqual([3]);
    expect(filterEvents(events, NO_FILTERS)).toHaveLength(3);
  });

  it("groups newest day first with the biggest severity first inside a day", () => {
    const groups = groupByDay(events);
    expect(groups.map((g) => g.day)).toEqual(["2026-10-02", "2026-09-30"]);
    expect(groups[0].events.map((e) => e.id)).toEqual([1, 2]);
  });

  it("lists readable evidence and hides technical keys", () => {
    const entries = evidenceEntries({
      positions_moved: 10,
      keywords: ["a", "b"],
      offer_key: "x|y",
      summary: "s",
      is_mine: true,
      empty: "",
      none: null,
    });
    expect(entries).toEqual([
      ["Positions moved", "10"],
      ["Keywords", "a, b"],
    ]);
  });
});
