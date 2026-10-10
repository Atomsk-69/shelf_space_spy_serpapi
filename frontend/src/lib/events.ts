/**
 * How previous_value/current_value read for each event type. Presence events ("none") carry a
 * shelf position or listing count in current_value, so the backend summary describes them instead.
 */
export type ValueKind = "price" | "rank" | "none";

export const EVENT_TYPES: Record<string, { label: string; kind: ValueKind }> = {
  NEW_PRODUCT: { label: "New product", kind: "none" },
  PRICE_DECREASE: { label: "Price drop", kind: "price" },
  PRICE_INCREASE: { label: "Price increase", kind: "price" },
  DISCOUNT_STARTED: { label: "Discount started", kind: "price" },
  RANK_GAIN: { label: "Rank gain", kind: "rank" },
  RANK_LOSS: { label: "Rank loss", kind: "rank" },
  NEW_COMPETITOR: { label: "New competitor", kind: "none" },
  REMOVED_PRODUCT: { label: "Product removed", kind: "none" },
};

const SEVERITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
export const severityRank = (level: string) => SEVERITY_RANK[level.toLowerCase()] ?? 3;

export type EventFilters = { severity: string; confidence: string; from: string; to: string };
export const NO_FILTERS: EventFilters = { severity: "", confidence: "", from: "", to: "" };

type Filterable = { severity: string; confidence: string; detected_at: string };

/** Client-side narrowing of an already-fetched page of events. Dates are inclusive, in the viewer's local day. */
export function filterEvents<T extends Filterable>(events: T[], filters: EventFilters): T[] {
  const from = filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : null;
  const to = filters.to ? new Date(`${filters.to}T23:59:59.999`).getTime() : null;
  return events.filter((event) => {
    const time = new Date(event.detected_at).getTime();
    return (
      (!filters.severity || event.severity.toLowerCase() === filters.severity) &&
      (!filters.confidence || event.confidence.toLowerCase() === filters.confidence) &&
      (from === null || time >= from) &&
      (to === null || time <= to)
    );
  });
}

/** Newest day first; within a day, bigger severity first, then newest. Keys are local dates (YYYY-MM-DD). */
export function groupByDay<T extends Filterable>(events: T[]): { day: string; events: T[] }[] {
  const days = new Map<string, T[]>();
  for (const event of events) {
    const date = new Date(event.detected_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    days.set(key, [...(days.get(key) ?? []), event]);
  }
  return [...days.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, items]) => ({
      day,
      events: items.sort(
        (a, b) =>
          severityRank(a.severity) - severityRank(b.severity) || new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime(),
      ),
    }));
}

/** Technical fields shown in "details" rather than the evidence list. */
const HIDDEN_EVIDENCE = new Set(["summary", "caveat", "is_mine", "offer_key", "canonical_key", "compared_with_demo"]);

export function evidenceEntries(evidence: Record<string, unknown>): [string, string][] {
  return Object.entries(evidence)
    .filter(([key, value]) => !HIDDEN_EVIDENCE.has(key) && value !== null && value !== undefined && value !== "")
    .map(([key, value]): [string, string] => [
      key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()),
      Array.isArray(value) ? value.join(", ") : typeof value === "object" ? JSON.stringify(value) : String(value),
    ]);
}
