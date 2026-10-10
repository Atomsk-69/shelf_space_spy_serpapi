import type { ShelfShareEntry } from "../../types";
import { formatPct } from "../../lib/format";
import { HBarChart, type BarDatum } from "../charts/Bars";

/**
 * The backend keeps the 10 most visible brands (plus yours) and already folds the tail into one
 * "Other brands" row; listings without a detected brand arrive as "Unbranded". Those aggregate rows
 * are never folded again here. Only an unexpectedly long list of named brands is trimmed.
 */
const MAX_BRAND_ROWS = 12;
const OTHER_BRANDS = "Other brands";
const UNBRANDED = "Unbranded";

const isAggregate = (row: ShelfShareEntry) => !row.is_mine && (row.brand === OTHER_BRANDS || row.brand === UNBRANDED);
const round1 = (value: number) => Math.round(value * 10) / 10;

/** Named brands by share (yours always kept), then the aggregate rows, so no row is folded twice. */
function foldRows(entries: ShelfShareEntry[]): ShelfShareEntry[] {
  const brands = entries.filter((row) => !isAggregate(row)).sort((a, b) => b.share_pct - a.share_pct);
  const other = entries.find((row) => !row.is_mine && row.brand === OTHER_BRANDS);
  const unbranded = entries.find((row) => !row.is_mine && row.brand === UNBRANDED);
  let kept = brands;
  let folded: ShelfShareEntry[] = [];
  if (brands.length > MAX_BRAND_ROWS) {
    kept = brands.slice(0, MAX_BRAND_ROWS);
    folded = brands.slice(MAX_BRAND_ROWS).filter((row) => !row.is_mine);
    kept.push(...brands.slice(MAX_BRAND_ROWS).filter((row) => row.is_mine));
  }
  const tail: ShelfShareEntry[] = [];
  if (other || folded.length > 0) {
    // Merge anything trimmed here into the backend's own "Other brands" row instead of adding a second one.
    tail.push({
      brand: OTHER_BRANDS,
      share_pct: round1((other?.share_pct ?? 0) + folded.reduce((sum, row) => sum + row.share_pct, 0)),
      is_mine: false,
      listings: (other?.listings ?? 0) + folded.reduce((sum, row) => sum + (row.listings ?? 0), 0),
    });
  }
  if (unbranded) tail.push(unbranded);
  return [...kept, ...tail];
}

/**
 * Bar chart of observed visibility share: your brand in the accent, everyone else in a recessive gray.
 * "Other brands" and "Unbranded" are drawn lighter and last. A table view repeats every number.
 */
export function ShelfShareBars({ entries }: { entries: ShelfShareEntry[] }) {
  const rows = foldRows(entries);
  const data: BarDatum[] = rows.map((row) => ({
    name: row.is_mine ? `${row.brand} (you)` : row.brand,
    value: row.share_pct,
    highlight: row.is_mine,
    color: !row.is_mine && (row.brand === OTHER_BRANDS || row.brand === UNBRANDED) ? "var(--viz-track)" : undefined,
    note: row.listings ? `${row.listings} listing${row.listings === 1 ? "" : "s"}` : undefined,
  }));
  return (
    <HBarChart
      data={data}
      format={(value) => formatPct(value)}
      unit="of the visible shelf"
      valueHeader="Share of visible shelf"
      label="Observed visibility share by brand"
      domainMax={Math.max(...rows.map((row) => row.share_pct), 1) * 1.05}
      caption="Position-weighted visibility across your probes on the sampled Google Shopping shelf. This is shelf presence, not sales share."
    />
  );
}
