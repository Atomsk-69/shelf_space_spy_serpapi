import type { Dashboard, MarketEvent, Opportunity } from "../types";
import { normalizeLabel } from "./opportunity";

export type Signal = { kind: "opportunity"; key: string; opportunity: Opportunity } | { kind: "event"; key: string; event: MarketEvent };

const SEVERITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
const MAX_SIGNALS = 5;
const MAX_OPPORTUNITIES = 2;

/**
 * Prioritized "what deserves attention" list, built only from fields the API already returns:
 * up to two opportunities scored Attractive or better (highest score first), then the dashboard's
 * events (which already exclude low confidence) ordered by severity, then recency.
 */
export function buildSignals(dashboard: Pick<Dashboard, "opportunities" | "events">): Signal[] {
  const opportunities = [...dashboard.opportunities]
    .filter((item) => ["Golden", "Attractive"].includes(normalizeLabel(item.label, item.score)))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_OPPORTUNITIES)
    .map((opportunity): Signal => ({ kind: "opportunity", key: `opp-${opportunity.keyword}`, opportunity }));

  const events = [...dashboard.events]
    .sort(
      (a, b) =>
        (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3) ||
        new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime(),
    )
    .map((event): Signal => ({ kind: "event", key: `event-${event.id}`, event }));

  return [...opportunities, ...events].slice(0, MAX_SIGNALS);
}
