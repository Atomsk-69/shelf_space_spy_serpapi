import type { OpportunityLabel } from "../types";

export const LABEL_ORDER: OpportunityLabel[] = ["Golden", "Attractive", "Monitor", "Crowded"];

export const LABEL_COLOR: Record<OpportunityLabel, string> = {
  Golden: "var(--sev-medium)",
  Attractive: "var(--viz-ord-3)",
  Monitor: "var(--viz-other)",
  Crowded: "var(--sev-high)",
};

export const LABEL_HINT: Record<OpportunityLabel, string> = {
  Golden: "Score 75+: strong demand growth with little new supply",
  Attractive: "Score 55-74: demand is outpacing supply",
  Monitor: "Score 35-54: mixed signals, keep watching",
  Crowded: "Score below 35: supply is catching up with demand",
};

export function labelForScore(score: number): OpportunityLabel {
  if (score >= 75) return "Golden";
  if (score >= 55) return "Attractive";
  if (score >= 35) return "Monitor";
  return "Crowded";
}

/** Trust a known backend label; otherwise derive it from the 0-100 score. */
export function normalizeLabel(label: string | null | undefined, score: number): OpportunityLabel {
  const match = LABEL_ORDER.find((known) => known.toLowerCase() === label?.trim().toLowerCase());
  return match ?? labelForScore(Number.isFinite(score) ? score : 0);
}
