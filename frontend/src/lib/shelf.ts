import type { ShelfRow } from "../types";

export const OTHER_BRANDS = "Other brands";
export const UNBRANDED = "Unbranded";
const isAggregate = (row: ShelfRow) => row.brand === OTHER_BRANDS;

export type HeatmapModel = {
  probes: string[];
  rows: { brand: string; isMine: boolean; cells: (number | null)[]; peak: number }[];
  max: number;
  truncated: boolean;
};

/**
 * Brand x probe grid straight from the API's per-probe shares. A cell is null when the brand is not among
 * the probe's listed brands (the API folds the smallest into "Other brands"), which is not the same as 0%.
 */
export function buildHeatmap(byProbe: Record<string, ShelfRow[]>, maxRows = 14): HeatmapModel {
  const probes = Object.keys(byProbe);
  const brands = new Map<string, { isMine: boolean; cells: Map<string, number> }>();
  for (const probe of probes) {
    for (const row of byProbe[probe]) {
      if (isAggregate(row)) continue;
      const entry = brands.get(row.brand) ?? { isMine: row.is_mine, cells: new Map() };
      entry.isMine ||= row.is_mine;
      entry.cells.set(probe, row.share_pct);
      brands.set(row.brand, entry);
    }
  }
  const all = [...brands.entries()]
    .map(([brand, entry]) => {
      const cells = probes.map((probe) => entry.cells.get(probe) ?? null);
      return { brand, isMine: entry.isMine, cells, peak: Math.max(...cells.map((value) => value ?? 0)) };
    })
    .sort((a, b) => Number(b.isMine) - Number(a.isMine) || b.peak - a.peak || a.brand.localeCompare(b.brand));
  const rows = all.slice(0, maxRows);
  return { probes, rows, max: Math.max(1, ...rows.map((row) => row.peak)), truncated: all.length > rows.length };
}

export type ShareChange = { brand: string; before: number; now: number; delta: number; isMine: boolean };

/**
 * Change in observed visibility share (percentage points) between two scans, for brands listed in both.
 * Brands listed in only one scan may simply have moved in or out of the top list, so they are returned
 * separately instead of being reported as a gain or loss.
 */
export function shareChanges(now: ShelfRow[], before: ShelfRow[]) {
  const named = (rows: ShelfRow[]) => rows.filter((row) => !isAggregate(row) && row.brand !== UNBRANDED);
  const previous = new Map(named(before).map((row) => [row.brand, row]));
  const current = new Map(named(now).map((row) => [row.brand, row]));
  const both: ShareChange[] = [];
  for (const [brand, row] of current) {
    const earlier = previous.get(brand);
    if (earlier) {
      both.push({
        brand,
        before: earlier.share_pct,
        now: row.share_pct,
        delta: Math.round((row.share_pct - earlier.share_pct) * 10) / 10,
        isMine: row.is_mine,
      });
    }
  }
  const byDelta = [...both].sort((a, b) => b.delta - a.delta);
  return {
    gainers: byDelta.filter((c) => c.delta > 0).slice(0, 5),
    decliners: [...byDelta]
      .reverse()
      .filter((c) => c.delta < 0)
      .slice(0, 5),
    enteredList: [...current.keys()].filter((brand) => !previous.has(brand)),
    leftList: [...previous.keys()].filter((brand) => !current.has(brand)),
  };
}

/** Index of the scan just before ``scanId`` in an oldest-first list, or null for the first scan. */
export function previousScanId(scans: { id: number }[], scanId: number | null | undefined): number | null {
  if (scanId == null) return null;
  const index = scans.findIndex((scan) => scan.id === scanId);
  return index > 0 ? scans[index - 1].id : null;
}
