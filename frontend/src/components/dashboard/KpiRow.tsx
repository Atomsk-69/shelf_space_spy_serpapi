import type { DashboardKpis } from "../../types";
import { DASH, formatInt, formatSignedPct } from "../../lib/format";

function DemandDelta({ value }: { value: number | null }) {
  if (value == null || !Number.isFinite(value)) return <strong className="kpi-value">{DASH}</strong>;
  const direction = value > 0 ? "up" : value < 0 ? "down" : "flat";
  const icon = direction === "up" ? "▲" : direction === "down" ? "▼" : "■";
  return (
    <strong className={`kpi-value delta-${direction}`}>
      <span aria-hidden="true" className="delta-icon">
        {icon}
      </span>{" "}
      {formatSignedPct(value)}
    </strong>
  );
}

export function KpiRow({ kpis }: { kpis: DashboardKpis }) {
  const top = kpis.top_opportunity;
  return (
    <dl className="metrics kpi-row">
      <div className="kpi">
        <dt>OBSERVED SKUS</dt>
        <dd>
          <strong className="kpi-value">{formatInt(kpis.observed_skus)}</strong>
          <span className="kpi-sub">on the sampled shelf</span>
        </dd>
      </div>
      <div className="kpi">
        <dt>NEW PRODUCTS</dt>
        <dd>
          <strong className="kpi-value">{formatInt(kpis.new_products)}</strong>
          <span className="kpi-sub">since the previous scan</span>
        </dd>
      </div>
      <div className="kpi">
        <dt>DEMAND CHANGE</dt>
        <dd>
          <DemandDelta value={kpis.demand_change_pct} />
          <span className="kpi-sub">{kpis.demand_change_pct == null ? "No Trends data yet" : "last 4 weeks vs prior 8"}</span>
        </dd>
      </div>
      <div className="kpi">
        <dt>TOP OPPORTUNITY</dt>
        <dd>
          <strong className="kpi-value kpi-text" title={top?.keyword}>
            {top ? top.keyword : DASH}
          </strong>
          <span className="kpi-sub">{top ? `Score ${Math.round(top.score)}/100` : "Nothing scored yet"}</span>
        </dd>
      </div>
    </dl>
  );
}

export function KpiRowSkeleton() {
  return (
    <div className="metrics kpi-row" role="status" aria-label="Loading key numbers">
      {[0, 1, 2, 3].map((key) => (
        <div key={key} className="kpi" aria-hidden="true">
          <div className="skeleton skeleton-line" style={{ width: "55%" }} />
          <div className="skeleton skeleton-line skeleton-tall" style={{ width: "70%" }} />
        </div>
      ))}
    </div>
  );
}
