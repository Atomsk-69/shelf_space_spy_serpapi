/** Parses a market id from a route param. Anything that is not a positive whole number is NaN. */
export function parseMarketId(raw: string | undefined): number {
  return /^\d+$/.test(raw ?? "") && Number(raw) > 0 ? Number(raw) : NaN;
}
