import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { useEvents, useMarket, useOpportunities, usePricing, useReplay, useShelf } from "../../api/hooks";
import { EventsFeed } from "../../components/dashboard/EventsFeed";
import { OpportunityCards } from "../../components/dashboard/OpportunityCards";
import { ShelfShareBars } from "../../components/dashboard/ShelfShareBars";
import { Panel } from "../../components/Panel";
import { SectionPage } from "../../components/SectionPage";
import { EmptyState, Loading, QueryBody } from "../../components/states";
import { Badge, DemoBadge } from "../../components/ui/Badge";
import { formatDateTime, formatInt, formatPrice } from "../../lib/format";
import { parseMarketId } from "../../lib/ids";

export default function ReplayPage() {
  const id = parseMarketId(useParams().id);
  const country = useMarket(id).data?.country ?? "";
  const replay = useReplay(id);
  const scans = useMemo(() => replay.data?.scans ?? [], [replay.data]);
  const [index, setIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const current = scans.length ? scans[Math.min(index ?? scans.length - 1, scans.length - 1)] : null;
  const position = current ? scans.indexOf(current) : 0;
  const scanId = current?.id ?? null;

  useEffect(() => {
    if (!playing || scans.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((value) => {
        const next = (value ?? scans.length - 1) + 1;
        if (next >= scans.length) {
          setPlaying(false);
          return scans.length - 1;
        }
        return next;
      });
    }, 1200);
    return () => window.clearInterval(timer);
  }, [playing, scans.length]);

  const shelf = useShelf(id, scanId);
  const pricing = usePricing(id, scanId);
  const opportunities = useOpportunities(id, scanId);
  const events = useEvents(id, { types: [], includeLow: false, limit: 25, offset: 0, scanId });

  function go(next: number) {
    setPlaying(false);
    setIndex(Math.max(0, Math.min(scans.length - 1, next)));
  }

  return (
    <SectionPage
      id={id}
      label="REPLAY"
      title="Step back through the stored scans"
      intro="Move the slider to see how the shelf, prices, scores and detected changes looked at each scan. Read-only: nothing here re-runs a scan or spends credits."
      scan={shelf.data?.scan}
    >
      <QueryBody
        query={replay}
        loading={<Loading rows={3} />}
        errorTitle="Couldn't load the scan history"
        isEmpty={(value) => value.scans.length === 0}
        empty={
          <EmptyState title="No scans to replay" hint="Run a scan from the Overview page; each scan becomes a step you can revisit." />
        }
      >
        {(value) => (
          <Panel label="TIMELINE" title={current ? formatDateTime(current.scanned_at) : "Scans"} className="replay-timeline">
            <div className="replay-controls">
              <button type="button" className="button-secondary button-small" onClick={() => go(position - 1)} disabled={position === 0}>
                Previous
              </button>
              <input
                type="range"
                min={0}
                max={value.scans.length - 1}
                step={1}
                value={position}
                aria-label="Scan to replay"
                aria-valuetext={
                  current ? `Scan ${position + 1} of ${value.scans.length}, ${formatDateTime(current.scanned_at)}` : undefined
                }
                onChange={(event) => go(Number(event.target.value))}
              />
              <button
                type="button"
                className="button-secondary button-small"
                onClick={() => go(position + 1)}
                disabled={position >= value.scans.length - 1}
              >
                Next
              </button>
              <button
                type="button"
                className="button-secondary button-small"
                disabled={value.scans.length < 2}
                onClick={() => {
                  if (position >= value.scans.length - 1) setIndex(0);
                  setPlaying((on) => !on);
                }}
              >
                {playing ? "Pause" : "Play"}
              </button>
            </div>
            <ol className="scan-ticks" aria-label="Stored scans">
              {value.scans.map((scan, tick) => (
                <li key={scan.id}>
                  <button
                    type="button"
                    className={tick === position ? "scan-tick is-current" : scan.is_demo ? "scan-tick is-demo" : "scan-tick"}
                    aria-current={tick === position ? "true" : undefined}
                    onClick={() => go(tick)}
                  >
                    <span className="scan-tick-date">
                      {new Date(scan.scanned_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                    {scan.is_demo && <span className="scan-tick-demo">demo</span>}
                  </button>
                </li>
              ))}
            </ol>
            {current && (
              <div className="replay-context" role="status" aria-live="polite">
                <div className="badge-row">
                  <Badge tone="info" icon="◉" title="Replay only reads stored scans. It never runs a scan or spends credits.">
                    Read-only replay
                  </Badge>
                  <Badge tone="neutral">
                    Scan {position + 1} of {value.scans.length}
                  </Badge>
                  {current.is_demo && <DemoBadge />}
                </div>
                <p className="field-hint">
                  {formatDateTime(current.scanned_at)} · {formatInt(current.products)} listings · {formatInt(current.events)} change
                  {current.events === 1 ? "" : "s"} detected at this scan
                </p>
              </div>
            )}
          </Panel>
        )}
      </QueryBody>

      {scanId !== null && (
        <div className="dash-grid">
          <Panel label="SHELF" title="Who held the shelf" className="span-5">
            <QueryBody
              query={shelf}
              loading={<Loading rows={6} />}
              isEmpty={(v) => !v.has_data}
              empty={<EmptyState title="No shelf data for this scan" />}
            >
              {(value) => <ShelfShareBars entries={value.overall} />}
            </QueryBody>
          </Panel>
          <Panel label="CHANGES" title="Detected at this scan" className="span-7">
            <QueryBody
              query={events}
              loading={<Loading rows={5} />}
              isEmpty={(v) => v.items.length === 0}
              empty={
                <EmptyState
                  title="No changes detected at this scan"
                  hint="The first scan has nothing to compare with; later ones need enough history."
                />
              }
            >
              {(value) => (
                <>
                  <EventsFeed events={value.items} country={country} initialVisible={25} />
                  {value.hidden_low_confidence > 0 && (
                    <p className="field-hint">{value.hidden_low_confidence} low-confidence change(s) not shown.</p>
                  )}
                </>
              )}
            </QueryBody>
          </Panel>
          <Panel label="PRICES" title="Price bands" className="span-5">
            <QueryBody
              query={pricing}
              loading={<Loading rows={3} />}
              isEmpty={(v) => !v.has_data || !v.overall || v.overall.count === 0}
              empty={<EmptyState title="No priced listings in this scan" />}
            >
              {(value) => {
                const overall = value.overall!;
                return (
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
                      <dt>Listings priced</dt>
                      <dd>{overall.count}</dd>
                    </div>
                  </dl>
                );
              }}
            </QueryBody>
          </Panel>
          <Panel label="OPPORTUNITIES" title="Scores at this scan" className="span-7">
            <QueryBody
              query={opportunities}
              loading={<Loading rows={5} />}
              isEmpty={(v) => v.items.length === 0}
              empty={<EmptyState title="No scores for this scan" />}
            >
              {(value) => <OpportunityCards opportunities={value.items} />}
            </QueryBody>
          </Panel>
        </div>
      )}
    </SectionPage>
  );
}
