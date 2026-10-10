import type { MarketEvent, Opportunity, PriceStats, SupplySection } from "../../types";
import { EVENT_TYPES } from "../../lib/events";
import { formatInt, humanize } from "../../lib/format";
import { LABEL_COLOR, LABEL_HINT, normalizeLabel } from "../../lib/opportunity";
import { EmptyState } from "../states";
import { ColumnChart, HBarChart, SeriesBars, type BarDatum } from "./Bars";

/** Score per probe, coloured by its label (Golden, Attractive, Monitor, Crowded). */
export function OpportunityScoreBars({ opportunities }: { opportunities: Opportunity[] }) {
  if (opportunities.length === 0) return <EmptyState title="No scores yet" />;
  const data: BarDatum[] = [...opportunities]
    .sort((a, b) => b.score - a.score)
    .map((item) => {
      const label = normalizeLabel(item.label, item.score);
      return { name: item.keyword, value: Math.round(item.score), color: LABEL_COLOR[label], note: `${label}: ${LABEL_HINT[label]}` };
    });
  return (
    <ColumnChart
      data={data}
      format={(value) => String(Math.round(value))}
      unit="out of 100"
      domain={[0, 100]}
      valueHeader="Score (0-100)"
      label="Opportunity score per probe"
      caption="Higher is better. Colour shows the label: Golden 75+, Attractive 55-74, Monitor 35-54, Crowded below 35. Confidence is shown separately."
    />
  );
}

/** How many of the recent changes were of each type. A plain count of the events the API returned. */
export function ChangeTypeBars({ events }: { events: MarketEvent[] }) {
  const counts = new Map<string, number>();
  for (const event of events) counts.set(event.type, (counts.get(event.type) ?? 0) + 1);
  const data: BarDatum[] = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, value]) => ({ name: EVENT_TYPES[type]?.label ?? humanize(type), value }));
  if (data.length === 0) return <EmptyState title="No changes to count yet" hint="Change events need at least two scans to compare." />;
  return (
    <HBarChart
      data={data}
      format={(value) => formatInt(value)}
      unit="changes"
      valueHeader="Changes"
      label="Recent changes by type"
      caption="Counts of the changes in the recent feed. Low-confidence changes are not included."
    />
  );
}

/** Listings per price band for each probe: below the lower quartile, inside the middle half, above the upper quartile. */
export function PriceBandBars({ probes }: { probes: (PriceStats & { keyword: string })[] }) {
  const usable = probes.filter((probe) => probe.count > 0);
  if (usable.length === 0) return <EmptyState title="No priced listings yet" hint="Prices appear once a scan has listings with a price." />;
  return (
    <SeriesBars
      stacked
      horizontal
      data={usable.map((probe) => ({
        name: probe.keyword,
        budget: probe.bands.budget,
        core: probe.bands.mid,
        premium: probe.bands.premium,
      }))}
      series={[
        { key: "budget", label: "Budget (below lower quartile)", color: "var(--viz-ord-1)" },
        { key: "core", label: "Core (middle half)", color: "var(--viz-ord-2)" },
        { key: "premium", label: "Premium (above upper quartile)", color: "var(--viz-ord-4)" },
      ]}
      label="Listings per price band for each probe"
      caption="Bands are set by each probe's own price quartiles, so they compare listings within a probe, not prices between probes."
    />
  );
}

/** Distinct products, brands and retailers on each probe's sampled shelf. */
export function SupplyBars({ probes }: { probes: SupplySection["probes"] }) {
  if (probes.length === 0) return <EmptyState title="No supply data yet" />;
  return (
    <SeriesBars
      data={probes.map((probe) => ({ name: probe.keyword, products: probe.skus, brands: probe.brands, retailers: probe.retailers }))}
      series={[
        { key: "products", label: "Distinct products", color: "var(--viz-ord-3)" },
        { key: "brands", label: "Brands", color: "var(--viz-ord-2)" },
        { key: "retailers", label: "Retailers", color: "var(--viz-other)" },
      ]}
      label="Distinct products, brands and retailers per probe"
      caption="How crowded each probe's sampled shelf looks."
    />
  );
}
