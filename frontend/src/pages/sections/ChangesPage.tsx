import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { useEvents, useMarket } from "../../api/hooks";
import { EventDrawer } from "../../components/EventDrawer";
import { EventTimeline } from "../../components/EventTimeline";
import { Panel } from "../../components/Panel";
import { SectionPage } from "../../components/SectionPage";
import { EmptyState, Loading, QueryBody } from "../../components/states";
import { EVENT_TYPES, NO_FILTERS, filterEvents, type EventFilters } from "../../lib/events";
import { formatInt } from "../../lib/format";
import { parseMarketId } from "../../lib/ids";
import type { MarketEvent } from "../../types";

/** The API returns at most this many events per request; filtering below works on that newest slice. */
const FETCH_LIMIT = 200;

export default function ChangesPage() {
  const id = parseMarketId(useParams().id);
  const market = useMarket(id);
  const [types, setTypes] = useState<string[]>([]);
  const [includeLow, setIncludeLow] = useState(false);
  const [filters, setFilters] = useState<EventFilters>(NO_FILTERS);
  const [selected, setSelected] = useState<MarketEvent | null>(null);
  const events = useEvents(id, { types, includeLow, limit: FETCH_LIMIT, offset: 0 });
  const data = events.data;
  const visible = useMemo(() => (data ? filterEvents(data.items, filters) : []), [data, filters]);
  const filtered = Object.values(filters).some(Boolean) || types.length > 0;
  const hidden = data?.hidden_low_confidence ?? 0;

  const toggleType = (type: string) =>
    setTypes((current) => (current.includes(type) ? current.filter((item) => item !== type) : [...current, type]));
  const setFilter = (patch: Partial<EventFilters>) => setFilters((current) => ({ ...current, ...patch }));

  return (
    <SectionPage
      id={id}
      label="CHANGES"
      title="What changed on the shelf"
      intro="Price, rank, new-product and removal events found by comparing scans. Severity is how big a change is; confidence is how much to trust it."
    >
      <Panel label="TIMELINE" title="Detected changes">
        <ul className="filter-chips" aria-label="Event types">
          {Object.entries(EVENT_TYPES).map(([type, meta]) => (
            <li key={type}>
              <button
                type="button"
                className={types.includes(type) ? "filter-chip is-on" : "filter-chip"}
                aria-pressed={types.includes(type)}
                onClick={() => toggleType(type)}
              >
                {meta.label}
              </button>
            </li>
          ))}
        </ul>
        <div className="filter-bar">
          <label>
            Severity
            <select value={filters.severity} onChange={(event) => setFilter({ severity: event.target.value })}>
              <option value="">Any</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label>
            Confidence
            <select value={filters.confidence} onChange={(event) => setFilter({ confidence: event.target.value })}>
              <option value="">Any</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label>
            From
            <input
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(event) => setFilter({ from: event.target.value })}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(event) => setFilter({ to: event.target.value })}
            />
          </label>
          <label className="check-inline filter-check">
            <input type="checkbox" checked={includeLow} onChange={(event) => setIncludeLow(event.target.checked)} />
            Include low confidence{!includeLow && hidden > 0 ? ` (${hidden} hidden)` : ""}
          </label>
          {filtered && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setTypes([]);
                setFilters(NO_FILTERS);
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        <QueryBody
          query={events}
          loading={<Loading rows={6} />}
          errorTitle="Couldn't load changes"
          isEmpty={() => visible.length === 0}
          empty={
            <EmptyState
              title={filtered ? "No events match these filters" : "No changes detected yet"}
              hint={
                filtered
                  ? "Try clearing a filter."
                  : hidden > 0
                    ? `${hidden} low-confidence event${hidden === 1 ? " is" : "s are"} hidden. Turn on "Include low confidence" to see them.`
                    : "Change events need at least two scans to compare; removals need five."
              }
            />
          }
        >
          {(value) => (
            <>
              <EventTimeline events={visible} country={market.data?.country ?? ""} onSelect={setSelected} />
              <p className="data-note">
                Showing {formatInt(visible.length)} of {formatInt(value.total)} event{value.total === 1 ? "" : "s"}
                {value.total > FETCH_LIMIT ? ` (the newest ${FETCH_LIMIT} are loaded; filters apply to those)` : ""}.
              </p>
            </>
          )}
        </QueryBody>
      </Panel>
      <EventDrawer event={selected} country={market.data?.country ?? ""} onClose={() => setSelected(null)} />
    </SectionPage>
  );
}
