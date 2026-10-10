import { Link, useParams } from "react-router-dom";

import { useDashboard, useLatestReport, useMarket } from "../api/hooks";
import { isNotFound } from "../api/errors";
import { CompetitorTable } from "../components/dashboard/CompetitorTable";
import { EventsFeed } from "../components/dashboard/EventsFeed";
import { KpiRow, KpiRowSkeleton } from "../components/dashboard/KpiRow";
import { OpportunityScatter } from "../components/dashboard/OpportunityScatter";
import { SignalList, SignalsHelp } from "../components/dashboard/SignalList";
import { Panel } from "../components/Panel";
import { EmptyState, ErrorState, Loading, QueryBody, Skeleton } from "../components/states";
import { Badge, DemoBadge, HistoryBadge } from "../components/ui/Badge";
import { countryLabel, formatRelativeTime } from "../lib/format";
import { parseMarketId } from "../lib/ids";
import { findSection, parseBrief } from "../lib/brief";
import { buildSignals } from "../lib/signals";
import type { Report } from "../types";

function NotFound() {
  return (
    <EmptyState
      title="Market not found"
      hint="It may have been deleted, or it belongs to another account."
      action={
        <Link to="/markets" className="button-link">
          Back to your markets
        </Link>
      }
    />
  );
}

/** Short version of the latest brief: headline plus the points most worth acting on. */
function BriefSummary({ report, marketId }: { report: Report | null | undefined; marketId: number }) {
  if (!report) {
    return (
      <EmptyState
        title="No brief yet"
        hint="The Weekly Brief turns this page's numbers into a short explanation."
        action={
          <Link to={`/markets/${marketId}/brief`} className="button-link">
            Open Weekly Brief
          </Link>
        }
      />
    );
  }
  const brief = parseBrief(report.content);
  const points = [...(findSection(brief, "Opportunities")?.bullets ?? []), ...(findSection(brief, "Watch-outs")?.bullets ?? [])].slice(
    0,
    3,
  );
  return (
    <div className="stack">
      <div className="badge-row">
        <Badge tone={report.source === "llm" ? "info" : "neutral"} icon={report.source === "llm" ? "✦" : "▤"}>
          {report.source === "llm" ? "AI narrated" : "Template"}
        </Badge>
        {report.diagnostics?.data_includes_demo && <DemoBadge label="Includes demo data" />}
        <span className="muted-ink">Written {formatRelativeTime(report.created_at)}</span>
      </div>
      <p className="brief-headline">{brief.headline}</p>
      {points.length > 0 && (
        <ul className="bullet-list brief-summary-points">
          {points.map((point, index) => (
            <li key={index}>{point}</li>
          ))}
        </ul>
      )}
      <Link to={`/markets/${marketId}/brief`} className="link-more">
        Read the full brief →
      </Link>
    </div>
  );
}

/** Keyed by id so per-market UI state resets when switching markets. */
export default function DashboardPage() {
  const params = useParams();
  return <MarketDashboard key={params.id} id={parseMarketId(params.id)} />;
}

function MarketDashboard({ id }: { id: number }) {
  const market = useMarket(id);
  const dashboard = useDashboard(id);
  const latestReport = useLatestReport(id);

  if (!Number.isInteger(id) || id <= 0 || isNotFound(market.error) || isNotFound(dashboard.error)) return <NotFound />;

  const info = market.data;
  const country = info?.country ?? "";
  const data = dashboard.data;
  const noScansYet = data !== undefined && data.scan_count === 0;
  const signals = data ? buildSignals(data) : [];

  return (
    <>
      <section className="page-intro">
        <div>
          {info ? (
            <>
              <p className="card-label">
                {info.category} · {countryLabel(info.country)}
              </p>
              <h1 className="page-title">{info.name}</h1>
              <p className="lede">
                {info.brand_name ? (
                  <>
                    Tracking <strong>{info.brand_name}</strong> against
                  </>
                ) : (
                  "Research mode, watching"
                )}{" "}
                {info.competitors.length} competitor{info.competitors.length === 1 ? "" : "s"} across {info.keywords.length} search probe
                {info.keywords.length === 1 ? "" : "s"}.
              </p>
            </>
          ) : market.error ? (
            <ErrorState error={market.error} title="Couldn't load this market" onRetry={() => void market.refetch()} />
          ) : (
            <Loading label="Loading market…" rows={3} />
          )}
          <div className="badge-row page-badges">
            {data?.has_demo_history && <DemoBadge label="Demo historical data" />}
            {data && data.scan_count > 0 && data.scan_count < 3 && <HistoryBadge scans={data.scan_count} />}
          </div>
        </div>
      </section>

      {noScansYet && (
        <p className="notice notice-info" role="status">
          No scans yet. Use <strong>Run live scan</strong> in the top bar to fill this page; change events appear from the second scan on.
        </p>
      )}

      <QueryBody query={dashboard} loading={<KpiRowSkeleton />} errorTitle="Couldn't load key numbers">
        {(value) => <KpiRow kpis={value.kpis} />}
      </QueryBody>

      <div className="dash-grid">
        <Panel
          id="demand-supply"
          label="DEMAND × SUPPLY"
          title="Where demand outruns supply"
          className="span-7"
          actions={
            <Link to={`/markets/${id}/opportunities`} className="link-more">
              Details
            </Link>
          }
        >
          <QueryBody
            query={dashboard}
            loading={<Skeleton height={340} />}
            isEmpty={(value) => value.opportunities.length === 0}
            empty={
              <EmptyState
                title="Nothing to plot yet"
                hint="Opportunity scores appear after a scan collects shelf and Google Trends data."
              />
            }
          >
            {(value) => <OpportunityScatter opportunities={value.opportunities} />}
          </QueryBody>
        </Panel>

        <Panel
          id="signals"
          label="PRIORITIES"
          title={
            <>
              Market signals
              <SignalsHelp />
            </>
          }
          className="span-5"
        >
          <QueryBody
            query={dashboard}
            loading={<Loading rows={6} />}
            isEmpty={() => signals.length === 0}
            empty={
              <EmptyState
                title="No signals yet"
                hint="Signals combine strong opportunities with trusted changes. Both need scan history."
              />
            }
          >
            {() => <SignalList signals={signals} marketId={id} />}
          </QueryBody>
        </Panel>

        <Panel
          id="what-changed"
          label="WHAT CHANGED"
          title="Recent changes"
          className="span-7"
          actions={
            <Link to={`/markets/${id}/changes`} className="link-more">
              View all
            </Link>
          }
        >
          <QueryBody
            query={dashboard}
            loading={<Loading rows={6} />}
            isEmpty={(value) => value.events.length === 0}
            empty={
              <EmptyState title="No changes detected yet" hint="Price, rank and new-product events need at least two scans to compare." />
            }
          >
            {(value) => <EventsFeed events={value.events} country={country} initialVisible={5} />}
          </QueryBody>
        </Panel>

        <Panel id="brief" label="WEEKLY BRIEF" title="This week in short" className="span-5">
          <QueryBody query={latestReport} loading={<Loading rows={5} />} errorTitle="Couldn't load the brief">
            {(report) => <BriefSummary report={report ?? data?.report} marketId={id} />}
          </QueryBody>
        </Panel>

        <Panel id="competitors" label="COMPETITORS" title="Competitive shelf" className="span-12">
          <QueryBody
            query={dashboard}
            loading={<Loading rows={5} />}
            isEmpty={(value) => value.competitors.length === 0}
            empty={
              <EmptyState title="No competitor data yet" hint="Add competitor brands to this market or run a scan to discover them." />
            }
          >
            {(value) => <CompetitorTable rows={value.competitors} country={country} ownBrand={info?.brand_name ?? null} />}
          </QueryBody>
        </Panel>
      </div>
    </>
  );
}
