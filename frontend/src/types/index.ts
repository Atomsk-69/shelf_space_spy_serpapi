// Shared API contract types. These mirror the backend responses; keep them in
// sync with backend/app/schemas.py when the contract changes.

export type User = { id: number; email: string; name: string };

export type LoginResponse = { access_token: string; token_type?: string; user: User };

export type Market = {
  id: number;
  name: string;
  country: string;
  category: string;
  /** Optional: a user may research a market without owning a brand in it. */
  brand_name: string | null;
  keywords: string[];
  competitors: string[];
};

export type MarketCreate = {
  name: string;
  country: string;
  category: string;
  brand_name?: string;
  keywords: string[];
  competitors: string[];
};

export type SuggestRequest = { category: string; country: string };

export type BrandSuggestion = { name: string; count: number; inferred: boolean };

export type SuggestResponse = { keywords: string[]; brands: BrandSuggestion[]; credits_used?: number };

export type TopOpportunity = { keyword: string; score: number; label: string };

export type DashboardKpis = {
  observed_skus: number;
  new_products: number;
  /** Percent points, e.g. 12.5 means +12.5%. Null when there is no Trends data yet. */
  demand_change_pct: number | null;
  top_opportunity: TopOpportunity | null;
};

export type MarketEvent = {
  id: number;
  /** NEW_PRODUCT, PRICE_DECREASE, PRICE_INCREASE, DISCOUNT_STARTED, RANK_GAIN, RANK_LOSS, NEW_COMPETITOR, REMOVED_PRODUCT, ... */
  type: string;
  /** Usually low | medium | high. Unknown values render as neutral. */
  severity: string;
  /** low | medium | high: how much to trust the event, separate from severity. */
  confidence: string;
  brand: string | null;
  product: string | null;
  keyword: string | null;
  previous_value: number | null;
  current_value: number | null;
  /** Percent points from previous_value to current_value; price and discount events only. */
  change_pct: number | null;
  detected_at: string;
  is_demo: boolean;
  /** One-sentence, human-readable description built by the backend. */
  summary: string;
  caveat: string | null;
  /** Raw detector evidence (change_pct, discount_pct, positions_moved, listings, ...). */
  evidence: Record<string, unknown>;
};

/** The backend already folds the long tail into "Other brands" and reports "Unbranded" separately. */
export type ShelfShareEntry = { brand: string; share_pct: number; is_mine: boolean; listings: number };

export type CompetitorRow = {
  brand: string;
  is_mine: boolean;
  is_tracked: boolean;
  listings: number;
  share_pct: number;
  best_position: number | null;
  /** Average shelf position; lower is better. */
  avg_position: number | null;
  median_price: number | null;
  /** Percent points of the brand's priced listings that show a strike-through discount. */
  discount_rate_pct: number | null;
  avg_rating: number | null;
  total_reviews: number | null;
  /** NEW_PRODUCT events in the last 7 days. */
  new_products: number;
  price_moves: number;
};

/** Golden >= 75, Attractive 55-74, Monitor 35-54, Crowded < 35. */
export type OpportunityLabel = "Golden" | "Attractive" | "Monitor" | "Crowded";

export type Opportunity = {
  keyword: string;
  /** 0-100. */
  score: number;
  label: string;
  /** Percent points (recent vs prior Trends average). */
  demand_growth: number | null;
  /** Percent points (change in observed shelf supply). */
  supply_growth: number | null;
  reasons: string[];
  caveats: string[];
  components?: Record<string, number>;
  confidence?: Record<string, unknown>;
};

/** How a brief was made; never the stored evidence payload. */
export type ReportDiagnostics = {
  /** Present for template briefs: why the AI narration was not used. */
  fallback_reason?: "no_api_key" | "sdk_not_installed" | "llm_error" | "unsupported_claims" | string;
  llm_attempts?: number;
  model?: string;
  llm_error_summary?: string;
  /** Numbers, dates or claims the model produced that the data does not contain. */
  rejected_claims?: string[];
  data_includes_demo?: boolean;
};

export type Report = {
  id: number;
  market_id: number;
  content: string;
  created_at: string;
  source: string;
  diagnostics?: ReportDiagnostics;
};

export type Dashboard = {
  kpis: DashboardKpis;
  events: MarketEvent[];
  shelf_share: ShelfShareEntry[];
  competitors: CompetitorRow[];
  opportunities: Opportunity[];
  has_demo_history: boolean;
  report: Report | null;
  latest_scan_at: string | null;
  scan_count: number;
};

/** POST /markets/{id}/scan. A guarded scan (too soon after the last one) is a 409 error, not this shape. */
export type ScanResult = {
  market_id: number;
  /** Null for a dry run: nothing was stored. */
  scan_id: number | null;
  scanned_at: string | null;
  keyword_count: number;
  products_observed: number;
  products: number;
  trend_points: number;
  /** Change events detected by this scan. */
  events: number;
  /** Probes scored by this scan. */
  opportunities: number;
  credits_used: number;
  cached_calls: number;
  estimated_credits: number;
  shopping_calls: number;
  trends_calls: number;
  dry_run: boolean;
  guard_active: boolean;
  minutes_since_last_scan: number | null;
  warnings: string[];
  message: string;
  alerts_created?: number;
  daily_budget?: number;
  credits_used_today?: number;
  budget_remaining?: number | null;
};

// ---------------------------------------------------------------- section endpoints
// Read-only payloads for /markets/{id}/<section>; mirror backend/app/schemas.py.
// `has_data: false` means nothing is stored yet (an empty state), not an error.

export type ScanRef = { id: number; scanned_at: string; is_demo: boolean };

export type EventsPage = {
  items: MarketEvent[];
  total: number;
  limit: number;
  offset: number;
  /** Low-confidence events matching the filters that are stored but hidden. */
  hidden_low_confidence: number;
  include_low_confidence: boolean;
};

export type EventsQuery = { types: string[]; includeLow: boolean; limit: number; offset: number; scanId?: number | null };

export type ObservationRow = {
  id: number;
  keyword: string;
  title: string;
  brand: string | null;
  brand_inferred: boolean;
  source: string | null;
  price: number | null;
  old_price: number | null;
  position: number | null;
  rating: number | null;
  reviews: number | null;
  product_link: string | null;
  thumbnail: string | null;
  canonical_key: string | null;
  product_row_id: number | null;
};

export type ObservationsPage = {
  has_data: boolean;
  scan: ScanRef | null;
  items: ObservationRow[];
  total: number;
  limit: number;
  offset: number;
  keywords: string[];
  brands: string[];
};

export type ObservationsQuery = {
  keyword: string;
  brand: string;
  q: string;
  sort: string;
  limit: number;
  offset: number;
  scanId?: number | null;
};

export type ProductHistory = {
  product: { id: number; canonical_key: string; brand: string | null; title: string; first_seen_at: string; last_seen_at: string };
  history: {
    scan_id: number;
    scanned_at: string;
    is_demo: boolean;
    best_position: number | null;
    lowest_price: number | null;
    listings: number;
    retailers: string[];
  }[];
  listings_stored: number;
};

export type DemandSignal = {
  recent_avg?: number | null;
  prior_avg?: number | null;
  growth_pct: number | null;
  momentum?: string;
  slope_pct_per_week?: number | null;
  low_volume?: boolean;
  weeks_used?: number;
  caveats: string[];
};

export type DemandSection = {
  has_data: boolean;
  scan: ScanRef | null;
  keywords: { keyword: string; signal: DemandSignal | null; series: { week_start: string; interest: number; is_partial: boolean }[] }[];
};

export type ShelfRow = { brand: string; share_pct: number; listings: number; is_mine: boolean; is_unbranded?: boolean };

export type ShelfSection = {
  has_data: boolean;
  scan: ScanRef | null;
  overall: ShelfRow[];
  by_probe: Record<string, ShelfRow[]>;
  /** 0-1 overlap between consecutive scans per probe; null when it can't be measured. */
  stability: Record<string, number | null>;
  scans_compared: number;
  method: string;
};

export type SupplySection = {
  has_data: boolean;
  scan: ScanRef | null;
  compared_with: ScanRef | null;
  probes: {
    keyword: string;
    results: number;
    skus: number;
    brands: number;
    retailers: number;
    top3_share: number;
    density: number;
    sku_growth_pct: number | null;
  }[];
};

export type PriceStats = {
  count: number;
  median: number | null;
  q1: number | null;
  q3: number | null;
  min: number | null;
  max: number | null;
  bands: { budget: number; mid: number; premium: number };
  discount_rate: number;
};

export type PricingSection = {
  has_data: boolean;
  scan: ScanRef | null;
  overall: PriceStats | null;
  probes: (PriceStats & { keyword: string })[];
  brands: { brand: string; median_price: number; discount_rate_pct: number | null; is_mine: boolean }[];
};

export type OpportunitiesSection = { has_data: boolean; scan: ScanRef | null; trends_scan: ScanRef | null; items: Opportunity[] };

export type ReportsSection = { items: Report[] };

// ---------------------------------------------------------------- operations: budget, scan jobs, alerts, replay

export type ScanJob = {
  id: number;
  market_id: number;
  status: "queued" | "running" | "succeeded" | "failed";
  force: boolean;
  refresh: boolean;
  progress_done: number;
  progress_total: number;
  message: string | null;
  error: string | null;
  /** budget | too_soon | in_progress | not_configured | quota | rate_limited | serpapi | timeout | interrupted | internal */
  error_code: string | null;
  result: ScanResult | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export type AlertRow = {
  id: number;
  rule_id: number;
  rule_name: string;
  scan_id: number;
  event_type: string;
  severity: string;
  confidence: string;
  title: string;
  detail: string | null;
  brand: string | null;
  keyword: string | null;
  created_at: string;
  read_at: string | null;
};

export type AlertsPage = { items: AlertRow[]; total: number; unread: number; limit: number; offset: number };

export type AlertRule = {
  id: number;
  key: string;
  name: string;
  event_types: string[];
  min_severity: string;
  min_confidence: string;
  scope: "any" | "mine" | "competitors";
  enabled: boolean;
};

export type AlertRuleUpdate = { enabled?: boolean; min_severity?: string; min_confidence?: string };

export type AlertsSummary = { unread: number; by_market: Record<string, number> };

export type ReplayScan = { id: number; scanned_at: string; is_demo: boolean; products: number; events: number };

export type ReplaySection = { scans: ReplayScan[] };

// ---------------------------------------------------------------- recommended actions
// Deterministic rules over stored data (backend/app/intelligence/recommendations.py). Hypotheses, not advice.

export type EvidenceItem = {
  label: string;
  value: number | string | null;
  kind: "pct" | "pct_signed" | "price" | "score" | "count" | "text";
};

export type RecommendationKind =
  "investigate" | "collect_data" | "deprioritize" | "test_price" | "monitor_competitor" | "watch_entrant" | "check_exit";

export type Recommendation = {
  id: string;
  kind: RecommendationKind | string;
  priority: "high" | "medium" | "low";
  probe: string | null;
  title: string;
  summary: string;
  evidence: EvidenceItem[];
  action: string;
  confidence: string;
  limitations: string[];
  uses_demo_data: boolean;
  source: "opportunity" | "pricing" | "event" | "data" | string;
};

export type RecommendationsSection = { has_data: boolean; scan: ScanRef | null; items: Recommendation[]; notes: string[] };
