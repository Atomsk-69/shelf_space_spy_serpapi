export type TrendPoint = { week_start: string; interest: number; is_partial: boolean };

export type ChartRow = { week: string; complete: number | null; partial: number | null };
export type TrendWindows = { recent: [string, string] | null; prior: [string, string] | null };

/** Windows used by the backend's growth figure: the last 4 complete weeks against the 8 before them. */
export const RECENT_WEEKS = 4;
export const PRIOR_WEEKS = 8;

/**
 * Chart rows plus the two comparison windows to shade. Complete weeks are one solid line; a partial
 * (unfinished) week is a separate dashed segment joined to the last complete week, so it is visible
 * but never mistaken for a finished week. Windows only mark where the backend's comparison looks.
 */
export function buildTrendChart(series: TrendPoint[]): {
  rows: ChartRow[];
  windows: TrendWindows;
  completeWeeks: number;
  partialWeeks: number;
} {
  const sorted = [...series].sort((a, b) => a.week_start.localeCompare(b.week_start));
  const complete = sorted.filter((point) => !point.is_partial);
  const lastComplete = complete.at(-1)?.week_start;
  const rows: ChartRow[] = sorted.map((point) => ({
    week: point.week_start,
    complete: point.is_partial ? null : point.interest,
    partial: point.is_partial || point.week_start === lastComplete ? point.interest : null,
  }));
  const recent = complete.slice(-RECENT_WEEKS);
  const prior = complete.slice(-(RECENT_WEEKS + PRIOR_WEEKS), -RECENT_WEEKS);
  return {
    rows: rows.length && sorted.some((p) => p.is_partial) ? rows : rows.map((row) => ({ ...row, partial: null })),
    windows: {
      recent: recent.length ? [recent[0].week_start, recent.at(-1)!.week_start] : null,
      prior: prior.length ? [prior[0].week_start, prior.at(-1)!.week_start] : null,
    },
    completeWeeks: complete.length,
    partialWeeks: sorted.length - complete.length,
  };
}
