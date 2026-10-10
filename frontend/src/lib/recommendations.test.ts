import { describe, expect, it } from "vitest";

import { formatEvidence, kindLabel } from "./recommendations";

describe("formatEvidence", () => {
  it("formats each evidence kind as the API describes it", () => {
    expect(formatEvidence({ label: "x", value: 71.4, kind: "score" }, "US")).toBe("71/100");
    expect(formatEvidence({ label: "x", value: 16.2, kind: "pct_signed" }, "US")).toBe("+16.2%");
    expect(formatEvidence({ label: "x", value: -4, kind: "pct_signed" }, "US")).toBe("−4.0%");
    expect(formatEvidence({ label: "x", value: 35, kind: "pct" }, "US")).toBe("35.0%");
    expect(formatEvidence({ label: "x", value: 42.75, kind: "price" }, "US")).toBe("$42.75");
    expect(formatEvidence({ label: "x", value: 1200, kind: "count" }, "US")).toBe("1,200");
    expect(formatEvidence({ label: "x", value: "Rival cut the price.", kind: "text" }, "US")).toBe("Rival cut the price.");
  });

  it("shows a dash for missing values and never invents a number", () => {
    expect(formatEvidence({ label: "x", value: null, kind: "pct_signed" }, "US")).toBe("—");
    expect(formatEvidence({ label: "x", value: "", kind: "price" }, "US")).toBe("—");
    expect(formatEvidence({ label: "x", value: "n/a", kind: "score" }, "US")).toBe("n/a");
  });
});

describe("kindLabel", () => {
  it("names known kinds and falls back gracefully for new ones", () => {
    expect(kindLabel("investigate")).toBe("Investigate");
    expect(kindLabel("test_price")).toBe("Test a price");
    expect(kindLabel("future_kind")).toBe("Future kind");
  });
});
