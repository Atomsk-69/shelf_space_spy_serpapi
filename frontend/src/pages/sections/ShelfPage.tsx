import { useParams } from "react-router-dom";

import { useMarket, usePricing, useReplay, useShelf, useSupply } from "../../api/hooks";
import { PriceBandBars, SupplyBars } from "../../components/charts/MarketCharts";
import { ShelfHeatmap } from "../../components/ShelfHeatmap";
import { ShelfShareBars } from "../../components/dashboard/ShelfShareBars";
import { Panel } from "../../components/Panel";
import { SectionPage } from "../../components/SectionPage";
import { EmptyState, Loading, QueryBody } from "../../components/states";
import { HistoryBadge } from "../../components/ui/Badge";
import { InfoTip } from "../../components/ui/InfoTip";
import { DASH, formatDateTime, formatPct, formatPrice, formatSignedPct } from "../../lib/format";
import { parseMarketId } from "../../lib/ids";
import { buildHeatmap, previousScanId, shareChanges } from "../../lib/shelf";

function Movers({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: { brand: string; before: number; now: number; delta: number; isMine: boolean }[];
  tone: "up" | "down";
}) {
  return (
    <div>
      <h4 className="mover-title">{title}</h4>
      {rows.length === 0 ? (
        <p className="data-note">None between these two scans.</p>
      ) : (
        <ul className="mover-list">
          {rows.map((row) => (
            <li key={row.brand}>
              <span>
                {row.brand}
                {row.isMine && <span className="chip-tag">you</span>}
              </span>
              <span className={`delta-${tone}`}>
                {formatSignedPct(row.delta)}
                <span className="muted-ink">
                  {" "}
                  ({formatPct(row.before)} → {formatPct(row.now)})
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Methodology() {
  return (
    <details className="methodology">
      <summary>How these numbers are made, and what they are not</summary>
      <ul className="bullet-list">
        <li>
          <strong>Observed visibility, not market share.</strong> Each listing on a probe's Google Shopping results counts as 1 / (1 + 0.1 ×
          (position − 1)), so higher positions count more. A brand's share is its weight divided by the total across all listings sampled.
        </li>
        <li>The shelf is a sample: Google reorders and reshuffles results between requests, and it says nothing about sales.</li>
        <li>
          The Shelf tab lists the largest brands; the smallest are folded into "Other brands". Brands marked "guess" in the Scanner were
          inferred from titles and may be wrong.
        </li>
        <li>
          Shelf stability is the overlap of a probe's products between consecutive scans. A low overlap means rank and new-product signals
          on that probe are likely noise.
        </li>
        <li>Gainers and decliners compare the same brand's share in this scan and the one before it, in percentage points.</li>
      </ul>
    </details>
  );
}

export default function ShelfPage() {
  const id = parseMarketId(useParams().id);
  const country = useMarket(id).data?.country ?? "";
  const shelf = useShelf(id);
  const replay = useReplay(id);
  const previousId = previousScanId(replay.data?.scans ?? [], shelf.data?.scan?.id);
  const previous = useShelf(id, previousId);
  const supply = useSupply(id);
  const pricing = usePricing(id);
  const noScan = <EmptyState title="No scans yet" hint="Run a scan with the button in the top bar to see who holds the shelf." />;

  const changes =
    shelf.data && previous.data?.has_data && previousId !== null ? shareChanges(shelf.data.overall, previous.data.overall) : null;
  const previousScan = replay.data?.scans.find((scan) => scan.id === previousId);

  return (
    <SectionPage
      id={id}
      label="SHELF"
      title="Who holds the shelf, and how crowded it is"
      intro="Observed visibility on a sampled Google Shopping shelf. It shows presence in the results, not sales or market share."
      scan={shelf.data?.scan}
    >
      <div className="badge-row page-badges">
        {shelf.data?.has_data && shelf.data.scans_compared <= 1 && <HistoryBadge scans={shelf.data.scans_compared} />}
      </div>
      <div className="dash-grid">
        <Panel label="VISIBILITY" title="Overall observed shelf share" className="span-5">
          <QueryBody
            query={shelf}
            loading={<Loading rows={6} />}
            errorTitle="Couldn't load the shelf"
            isEmpty={(v) => !v.has_data}
            empty={noScan}
          >
            {(value) => <ShelfShareBars entries={value.overall} />}
          </QueryBody>
        </Panel>

        <Panel
          label="BRAND × PROBE"
          title={
            <>
              Visibility heatmap
              <InfoTip label="the heatmap">
                Rows are brands, columns are your search probes. Each cell is that brand's observed visibility share for that probe.
              </InfoTip>
            </>
          }
          className="span-7"
        >
          <QueryBody query={shelf} loading={<Loading rows={6} />} isEmpty={(v) => !v.has_data} empty={noScan}>
            {(value) => <ShelfHeatmap model={buildHeatmap(value.by_probe)} stability={value.stability} />}
          </QueryBody>
        </Panel>

        <Panel label="MOVEMENT" title="Gainers and decliners" className="span-12">
          {!previousId ? (
            <EmptyState
              title="Needs two scans"
              hint="Movement compares a brand's observed share with the previous scan. Run another scan to see it."
            />
          ) : (
            <QueryBody query={previous} loading={<Loading rows={3} />} errorTitle="Couldn't load the previous scan">
              {() =>
                changes ? (
                  <>
                    <p className="data-note">
                      Compared with the scan from {previousScan ? formatDateTime(previousScan.scanned_at) : "the previous scan"}. Percentage
                      points of observed visibility.
                    </p>
                    <div className="mover-grid">
                      <Movers title="Gaining visibility" rows={changes.gainers} tone="up" />
                      <Movers title="Losing visibility" rows={changes.decliners} tone="down" />
                    </div>
                    {(changes.enteredList.length > 0 || changes.leftList.length > 0) && (
                      <p className="data-note">
                        {changes.enteredList.length > 0 && <>Newly listed among the largest brands: {changes.enteredList.join(", ")}. </>}
                        {changes.leftList.length > 0 && <>No longer listed among the largest brands: {changes.leftList.join(", ")}. </>}
                        These may have moved in or out of the top list rather than appeared or disappeared.
                      </p>
                    )}
                  </>
                ) : (
                  noScan
                )
              }
            </QueryBody>
          )}
        </Panel>

        <Panel label="SUPPLY" title="Market structure per probe" className="span-12">
          <QueryBody query={supply} loading={<Loading rows={4} />} isEmpty={(v) => !v.has_data} empty={noScan}>
            {(value) => (
              <>
                <SupplyBars probes={value.probes} />
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Probe</th>
                        <th className="num">Listings</th>
                        <th className="num">Distinct products</th>
                        <th className="num">Brands</th>
                        <th className="num">Retailers</th>
                        <th className="num">Top-3 share</th>
                        <th className="num">Density</th>
                        <th className="num">Product growth</th>
                      </tr>
                    </thead>
                    <tbody>
                      {value.probes.map((probe) => (
                        <tr key={probe.keyword}>
                          <th scope="row">{probe.keyword}</th>
                          <td className="num">{probe.results}</td>
                          <td className="num">{probe.skus}</td>
                          <td className="num">{probe.brands}</td>
                          <td className="num">{probe.retailers}</td>
                          <td className="num">{formatPct(probe.top3_share * 100, 0)}</td>
                          <td className="num">{probe.density.toFixed(2)}</td>
                          <td className="num">{probe.sku_growth_pct === null ? DASH : formatSignedPct(probe.sku_growth_pct)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="data-note">
                    Density is distinct products per listing: close to 1 means every slot is a different product. Growth compares with{" "}
                    {value.compared_with ? "an earlier scan" : "no earlier scan (none yet)"}.
                  </p>
                </div>
              </>
            )}
          </QueryBody>
        </Panel>

        <Panel label="PRICING" title="Price bands and brand positioning" className="span-12">
          <QueryBody
            query={pricing}
            loading={<Loading rows={5} />}
            isEmpty={(v) => !v.has_data || !v.overall || v.overall.count === 0}
            empty={<EmptyState title="No priced listings yet" hint="Prices appear once a scan has listings with a price." />}
          >
            {(value) => {
              const overall = value.overall!;
              return (
                <>
                  <dl className="opportunity-facts">
                    <div>
                      <dt>Median</dt>
                      <dd>{formatPrice(overall.median, country)}</dd>
                    </div>
                    <div>
                      <dt>Middle half</dt>
                      <dd>
                        {formatPrice(overall.q1, country)} to {formatPrice(overall.q3, country)}
                      </dd>
                    </div>
                    <div>
                      <dt>Discounted listings</dt>
                      <dd>{formatPct(overall.discount_rate * 100, 0)}</dd>
                    </div>
                  </dl>
                  <PriceBandBars probes={value.probes} />
                  <div className="table-scroll table-view">
                    <table>
                      <thead>
                        <tr>
                          <th>Brand</th>
                          <th className="num">Median price</th>
                          <th className="num">Discounted</th>
                        </tr>
                      </thead>
                      <tbody>
                        {value.brands.map((brand) => (
                          <tr key={brand.brand} className={brand.is_mine ? "is-mine" : undefined}>
                            <th scope="row">
                              {brand.brand}
                              {brand.is_mine && <span className="chip-tag">you</span>}
                            </th>
                            <td className="num">{formatPrice(brand.median_price, country)}</td>
                            <td className="num">{brand.discount_rate_pct === null ? DASH : formatPct(brand.discount_rate_pct, 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            }}
          </QueryBody>
        </Panel>
      </div>
      <Methodology />
    </SectionPage>
  );
}
