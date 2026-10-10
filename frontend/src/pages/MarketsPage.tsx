import { Link } from "react-router-dom";

import { useMarkets } from "../api/hooks";
import { EmptyState, ErrorState, Skeleton } from "../components/states";
import { countryLabel } from "../lib/format";

export default function MarketsPage() {
  const markets = useMarkets();

  return (
    <>
      <section className="page-intro">
        <div>
          <p className="card-label">YOUR MARKETS</p>
          <h1 className="page-title">Pick a shelf to watch</h1>
          <p className="lede">Each market is a category in a country, a few search probes and the brands you compete with.</p>
        </div>
        <Link to="/markets/new" className="button-link">New market</Link>
      </section>

      {markets.data === undefined && markets.error != null && (
        <ErrorState error={markets.error} title="Couldn't load your markets" onRetry={() => void markets.refetch()} />
      )}

      {markets.data === undefined && markets.error == null && (
        <div className="market-grid" role="status" aria-label="Loading markets">
          {[0, 1, 2].map((key) => <div key={key} className="panel"><Skeleton rows={4} /></div>)}
        </div>
      )}

      {markets.data?.length === 0 && (
        <EmptyState
          title="No markets yet"
          hint="Type a category and a country, and we'll propose search probes and competitor brands from live shopping data."
          action={<Link to="/markets/new" className="button-link">Set up your first market</Link>}
        />
      )}

      {markets.data && markets.data.length > 0 && (
        <ul className={markets.isFetching ? "market-grid is-refreshing" : "market-grid"}>
          {markets.data.map((market) => (
            <li key={market.id}>
              <Link to={`/markets/${market.id}`} className="panel market-card">
                <p className="card-label">{market.category.toUpperCase()} · {countryLabel(market.country)}</p>
                <h3>{market.name}</h3>
                <dl className="market-facts">
                  <div><dt>Your brand</dt><dd>{market.brand_name || "None (research only)"}</dd></div>
                  <div><dt>Probes</dt><dd>{market.keywords.length}</dd></div>
                  <div><dt>Competitors</dt><dd>{market.competitors.length}</dd></div>
                </dl>
                <span className="card-cta" aria-hidden="true">Open dashboard →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
