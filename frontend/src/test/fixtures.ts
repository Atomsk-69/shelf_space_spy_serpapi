import type { MarketEvent, Report } from "../types";

export function event(overrides: Partial<MarketEvent> = {}): MarketEvent {
  return {
    id: 1,
    type: "PRICE_DECREASE",
    severity: "medium",
    confidence: "high",
    brand: "Acme",
    product: "Acme Widget 30 ml",
    keyword: "widget",
    previous_value: 100,
    current_value: 90,
    change_pct: -10,
    detected_at: "2026-10-01T12:00:00+00:00",
    is_demo: false,
    summary: "Acme Widget dropped 10%.",
    caveat: "Same product at the same retailer.",
    evidence: {},
    ...overrides,
  };
}

export function report(overrides: Partial<Report> = {}): Report {
  return {
    id: 1,
    market_id: 1,
    content: "- Something changed",
    created_at: "2026-10-02T12:00:00+00:00",
    source: "llm",
    diagnostics: {},
    ...overrides,
  };
}
