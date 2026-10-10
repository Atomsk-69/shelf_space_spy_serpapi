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
  /** NEW_PRODUCT, PRICE_DECREASE, PRICE_INCREASE, DISCOUNT_STARTED, RANK_GAIN, RANK_LOSS, NEW_COMPETITOR, ... */
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

export type Report = { id: number; market_id: number; content: string; created_at: string; source: string };

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
};
