import { describe, expect, it } from "vitest";

import { EVENT_TYPES } from "./events";
import { DASH, formatDecimal, formatInt, formatPct, formatPrice, formatSignedPct, humanize } from "./format";
import { parseMarketId } from "./ids";
import { labelForScore, normalizeLabel } from "./opportunity";
import { fallbackExplanation, sourceLabel } from "./report";
import { report } from "../test/fixtures";

describe("format", () => {
  it("shows a dash for missing or non-finite numbers", () => {
    for (const fn of [formatInt, formatDecimal, formatPct, formatSignedPct, formatPrice]) {
      expect(fn(null)).toBe(DASH);
      expect(fn(undefined)).toBe(DASH);
      expect(fn(Number.NaN)).toBe(DASH);
    }
  });

  it("formats numbers, signs and prices", () => {
    expect(formatInt(1234.6)).toBe("1,235");
    expect(formatDecimal(2.345, 1)).toBe("2.3");
    expect(formatPct(12.34)).toBe("12.3%");
    expect(formatSignedPct(5)).toBe("+5.0%");
    expect(formatSignedPct(-5)).toBe("−5.0%");
    expect(formatSignedPct(0)).toBe("0.0%");
    expect(formatPrice(1200, "US")).toBe("$1,200.00");
    expect(formatPrice(10, "xx")).toBe("$10.00");
  });

  it("humanizes snake_case", () => {
    expect(humanize("price_drop")).toBe("Price drop");
    expect(humanize("FUTURE_EVENT")).toBe("Future event");
    expect(humanize(null)).toBe("");
  });
});

describe("parseMarketId", () => {
  it("accepts only positive whole numbers", () => {
    expect(parseMarketId("7")).toBe(7);
    for (const bad of [undefined, "", "0", "-1", "1.5", "abc", "12x"]) expect(parseMarketId(bad)).toBeNaN();
  });
});

describe("opportunity labels", () => {
  it("derives labels from the score at the documented thresholds", () => {
    expect(labelForScore(75)).toBe("Golden");
    expect(labelForScore(74.9)).toBe("Attractive");
    expect(labelForScore(55)).toBe("Attractive");
    expect(labelForScore(35)).toBe("Monitor");
    expect(labelForScore(34.9)).toBe("Crowded");
  });

  it("trusts a known backend label and falls back to the score otherwise", () => {
    expect(normalizeLabel("golden", 10)).toBe("Golden");
    expect(normalizeLabel("mystery", 80)).toBe("Golden");
    expect(normalizeLabel(null, Number.NaN)).toBe("Crowded");
  });
});

describe("event types", () => {
  it("knows every type the backend emits, including removals", () => {
    for (const type of [
      "NEW_PRODUCT",
      "NEW_COMPETITOR",
      "REMOVED_PRODUCT",
      "PRICE_DECREASE",
      "PRICE_INCREASE",
      "DISCOUNT_STARTED",
      "RANK_GAIN",
      "RANK_LOSS",
    ]) {
      expect(EVENT_TYPES[type]).toBeDefined();
    }
  });
});

describe("brief provenance", () => {
  it("labels AI and template briefs", () => {
    expect(sourceLabel(report({ source: "llm" }))).toMatch(/AI narrated/);
    expect(sourceLabel(report({ source: "template" }))).toMatch(/Template/);
    expect(sourceLabel(report({ source: "other" }))).toBeNull();
  });

  it("explains why a template was used, and only for templates", () => {
    expect(fallbackExplanation(report({ source: "llm" }))).toBeNull();
    expect(fallbackExplanation(report({ source: "template", diagnostics: {} }))).toBeNull();
    expect(fallbackExplanation(report({ source: "template", diagnostics: { fallback_reason: "no_api_key" } }))).toMatch(/No AI key/);
    expect(fallbackExplanation(report({ source: "template", diagnostics: { fallback_reason: "unsupported_claims" } }))).toMatch(
      /not in the data/,
    );
    expect(fallbackExplanation(report({ source: "template", diagnostics: { fallback_reason: "future_reason" } }))).toMatch(/not used/);
  });
});
