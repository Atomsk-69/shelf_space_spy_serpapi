import type { EvidenceItem } from "../types";
import { DASH, formatInt, formatPct, formatPrice, formatSignedPct, humanize } from "./format";

/** Short names for each recommendation type, shown as a tag on the card. */
export const KIND_LABEL: Record<string, string> = {
  investigate: "Investigate",
  collect_data: "Gather evidence",
  deprioritize: "Deprioritize",
  test_price: "Test a price",
  monitor_competitor: "Competitor price move",
  watch_entrant: "New entrant",
  check_exit: "Product left the shelf",
};

export const kindLabel = (kind: string) => KIND_LABEL[kind] ?? humanize(kind);

/** Formats one evidence figure exactly as the API describes it; nothing is recalculated here. */
export function formatEvidence(item: EvidenceItem, country: string): string {
  const { value, kind } = item;
  if (value === null || value === undefined || value === "") return DASH;
  if (kind === "text") return String(value);
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  switch (kind) {
    case "pct":
      return formatPct(number);
    case "pct_signed":
      return formatSignedPct(number);
    case "price":
      return formatPrice(number, country);
    case "score":
      return `${Math.round(number)}/100`;
    case "count":
      return formatInt(number);
    default:
      return String(value);
  }
}
