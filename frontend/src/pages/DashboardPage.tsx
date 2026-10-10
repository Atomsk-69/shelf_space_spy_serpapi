import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { useDashboard, useMarket, useScanMarket } from "../api/hooks";
import { errorMessage, isNotFound } from "../api/errors";
import { CompetitorTable } from "../components/dashboard/CompetitorTable";
import { EventsFeed } from "../components/dashboard/EventsFeed";
import { KpiRow, KpiRowSkeleton } from "../components/dashboard/KpiRow";
import { OpportunityCards } from "../components/dashboard/OpportunityCards";
import { OpportunityScatter } from "../components/dashboard/OpportunityScatter";
import { ScanButton } from "../components/dashboard/ScanButton";
import { ShelfShareBars } from "../components/dashboard/ShelfShareBars";
import { WeeklyBrief } from "../components/dashboard/WeeklyBrief";
import { Panel } from "../components/Panel";
import { EmptyState, ErrorState, Loading, QueryBody, Skeleton } from "../components/states";
import { countryLabel, formatInt } from "../lib/format";
import type { ScanResult } from "../types";

function NotFound() {
  return (
    <EmptyState
      title="Market not found"
      hint="It may have been deleted, or it belongs to another account."
      action={<Link to="/markets" className="button-link">Back to your markets</Link>}
    />
  );
}

function DemoBadge() {
  return (
    <span className="badge badge-demo" title="Earlier scans in this window were generated from the latest real scan to demonstrate history. Treat trends as illustrative.">
      <span aria-hidden="true">◷</span> Demo historical data
    </span>
  );
}

const plural = (count: number, one: string, many = `${one}s`) => `${formatInt(count)} ${count === 1 ? one : many}`;

/**
 * A dry run stores nothing (scan_id is null), so only its message and cost estimate are shown.
 * A guarded scan comes back as a 409 error and is shown by the error notice instead.
 */
function ScanSummary({ result }: { result: ScanResult }) {
  if (result.dry_run || result.scan_id === null) {
    return <><strong>Dry run.</strong> {result.message}</>;
  }
  const counts = [
    `${plural(result.products_observed ?? 0, "product")} observed`,
    `${plural(result.events ?? 0, "change")} detected`,
    `${plural(result.opportunities ?? 0, "opportunity", "opportunities")} scored`,
  ];
  return (
    <>
      <strong>Scan complete.</strong> {result.message} {counts.join(", ")}.
      {result.warnings?.length > 0 && <> {result.warnings.join(" ")}</>}
    </>
  );
}

/** Keyed by id so per-market UI state (scan notices, expanded cards) resets when switching markets. */
export default function DashboardPage() {
  const params = useParams();
  const id = /^\d+$/.test(params.id ?? "") ? Number(params.id) : NaN;
  return <MarketDashboard key={params.id} id={id} />;
}

function MarketDashboard({ id }: { id: number }) {
  const market = useMarket(id);
  const dashboard = useDashboard(id);
  const scan = useScanMarket(id);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  if (!Number.isInteger(id) || id <= 0 || isNotFound(market.error) || isNotFound(dashboard.error)) return <NotFound />;

  const info = market.data;
  const country = info?.country ?? "";
  const data = dashboard.data;
  const noScansYet = data !== undefined && data.kpis.observed_skus === 0 && data.shelf_share.length === 0 && data.opportunities.length === 0;

  function runScan() {
    setScanResult(null);
    scan.mutate(undefined, { onSuccess: setScanResult });
  }

  return (
    <>
      <section className="page-intro dashboard-intro">
        <div>
          {info ? (
            <>
              <p className="card-label">{info.category.toUpperCase()} · {countryLabel(info.country)}</p>
              <h1 className="page-title">{info.name}</h1>
              <p className="lede">
                {info.brand_name ? <>Tracking <strong>{info.brand_name}</strong> against</> : "Research mode, watching"} {info.competitors.length} competitor{info.competitors.length === 1 ? "" : "s"} across {info.keywords.length} search probe{info.keywords.length === 1 ? "" : "s"}.
              </p>
            </>
          ) : market.error ? (
            <ErrorState error={market.error} title="Couldn't load this market" onRetry={() => void market.refetch()} />
          ) : (
            <Loading label="Loading market…" rows={3} />
          )}
          {data?.has_demo_history && <DemoBadge />}
        </div>
        <ScanButton market={info} pending={scan.isPending} onConfirm={runScan} />
      </section>

      {scan.isError && (
        <p className="notice error" role="alert">
          <strong>Scan failed.</strong> {errorMessage(scan.error)}
          <button type="button" className="text-button" onClick={() => scan.reset()}>Dismiss</button>
        </p>
      )}
      {scanResult && (
        <p className={scanResult.dry_run ? "notice notice-info" : "notice success"} role="status">
          <ScanSummary result={scanResult} />
          <button type="button" className="text-button" onClick={() => setScanResult(null)}>Dismiss</button>
        </p>
      )}
      {noScansYet && !scan.isPending && (
        <p className="notice notice-info" role="status">
          No scans yet. Run your first live scan to fill this dashboard; change events appear from the second scan on.
        </p>
      )}

      <QueryBody query={dashboard} loading={<KpiRowSkeleton />} errorTitle="Couldn't load key numbers">
        {(value) => <KpiRow kpis={value.kpis} />}
      </QueryBody>

      <div className="dash-grid">
        <Panel id="what-changed" label="WHAT CHANGED" title="Moves on the shelf" className="span-7">
          <QueryBody
            query={dashboard}
            loading={<Loading rows={6} />}
            isEmpty={(value) => value.events.length === 0}
            empty={<EmptyState title="No changes detected yet" hint="Price, rank and new-product events need at least two scans to compare." />}
          >
            {(value) => <EventsFeed events={value.events} country={country} />}
          </QueryBody>
        </Panel>

        <Panel id="shelf-share" label="SHELF SHARE" title="Who owns the shelf" className="span-5">
          <QueryBody
            query={dashboard}
            loading={<Loading rows={6} />}
            isEmpty={(value) => value.shelf_share.length === 0}
            empty={<EmptyState title="No shelf data yet" hint="Run a scan to see which brands hold the visible positions." />}
          >
            {(value) => <ShelfShareBars entries={value.shelf_share} />}
          </QueryBody>
        </Panel>

        <Panel id="demand-supply" label="DEMAND × SUPPLY" title="Where demand outruns supply" className="span-7">
          <QueryBody
            query={dashboard}
            loading={<Skeleton height={340} />}
            isEmpty={(value) => value.opportunities.length === 0}
            empty={<EmptyState title="Nothing to plot yet" hint="Opportunity scores appear after a scan collects shelf and Google Trends data." />}
          >
            {(value) => <OpportunityScatter opportunities={value.opportunities} />}
          </QueryBody>
        </Panel>

        <Panel id="opportunities" label="OPPORTUNITIES" title="Ranked probes" className="span-5">
          <QueryBody
            query={dashboard}
            loading={<Loading rows={8} />}
            isEmpty={(value) => value.opportunities.length === 0}
            empty={<EmptyState title="No opportunities scored yet" hint="Each probe gets a 0-100 score with its reasons and caveats once data is in." />}
          >
            {(value) => <OpportunityCards opportunities={value.opportunities} />}
          </QueryBody>
        </Panel>

        <Panel id="competitors" label="COMPETITORS" title="Competitive shelf" className="span-12">
          <QueryBody
            query={dashboard}
            loading={<Loading rows={5} />}
            isEmpty={(value) => value.competitors.length === 0}
            empty={<EmptyState title="No competitor data yet" hint="Add competitor brands to this market or run a scan to discover them." />}
          >
            {(value) => <CompetitorTable rows={value.competitors} country={country} ownBrand={info?.brand_name ?? null} />}
          </QueryBody>
        </Panel>

        <WeeklyBrief marketId={id} fallback={data?.report} />
      </div>
    </>
  );
}
