export const DASH = "—";

const isNum = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value);

export function formatInt(value: number | null | undefined): string {
  return isNum(value) ? Math.round(value).toLocaleString("en-US") : DASH;
}

export function formatDecimal(value: number | null | undefined, digits = 1): string {
  return isNum(value) ? value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }) : DASH;
}

export function formatPct(value: number | null | undefined, digits = 1): string {
  return isNum(value) ? `${formatDecimal(value, digits)}%` : DASH;
}

export function formatSignedPct(value: number | null | undefined, digits = 1): string {
  if (!isNum(value)) return DASH;
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatDecimal(Math.abs(value), digits)}%`;
}

const CURRENCY: Record<string, string> = {
  us: "USD",
  ca: "CAD",
  gb: "GBP",
  uk: "GBP",
  au: "AUD",
  in: "INR",
  jp: "JPY",
  de: "EUR",
  fr: "EUR",
  it: "EUR",
  es: "EUR",
  nl: "EUR",
};

export function formatPrice(value: number | null | undefined, country = "us"): string {
  if (!isNum(value)) return DASH;
  const currency = CURRENCY[country.toLowerCase()] ?? "USD";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

export function countryLabel(code: string | null | undefined): string {
  if (!code) return DASH;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

/** "price_drop" -> "Price drop", "FUTURE_EVENT" -> "Future event". */
export function humanize(text: string | null | undefined): string {
  const spaced = (text ?? "").replace(/[_-]+/g, " ").trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase() : "";
}

function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(iso: string | null | undefined): string {
  const date = toDate(iso);
  return date ? date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : DASH;
}

export function formatRelativeTime(iso: string | null | undefined): string {
  const date = toDate(iso);
  if (!date) return DASH;
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "just now";
}
