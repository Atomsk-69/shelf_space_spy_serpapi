import { useState } from "react";

import type { MarketEvent } from "../../types";
import { EVENT_TYPES, type ValueKind } from "../../lib/events";
import { formatDateTime, formatPrice, formatRelativeTime, formatSignedPct, humanize } from "../../lib/format";

const SEVERITY: Record<string, { label: string; className: string; icon: string }> = {
  high: { label: "High", className: "sev-high", icon: "!" },
  critical: { label: "High", className: "sev-high", icon: "!" },
  medium: { label: "Medium", className: "sev-medium", icon: "•" },
  warning: { label: "Medium", className: "sev-medium", icon: "•" },
  low: { label: "Low", className: "sev-low", icon: "·" },
  info: { label: "Low", className: "sev-low", icon: "·" },
};

const INITIAL_VISIBLE = 6;

function formatValue(value: number | null | undefined, kind: ValueKind, country: string): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || kind === "none") return null;
  if (kind === "price") return formatPrice(value, country);
  return `#${Math.round(value)}`;
}

function EventItem({ event, country }: { event: MarketEvent; country: string }) {
  // Unknown event types: trust the backend summary rather than guessing what the values mean.
  const meta = EVENT_TYPES[event.type] ?? { label: humanize(event.type), kind: "none" as const };
  const severity = SEVERITY[event.severity?.toLowerCase()] ?? {
    label: humanize(event.severity || "info"),
    className: "sev-low",
    icon: "·",
  };
  const previous = formatValue(event.previous_value, meta.kind, country);
  const current = formatValue(event.current_value, meta.kind, country);
  const changePct = typeof event.change_pct === "number" && Number.isFinite(event.change_pct) ? event.change_pct : null;
  const hasValues = Boolean(previous || current || changePct !== null);
  // Price and rank moves already show their numbers; the caveat matters most when confidence is not high.
  const showCaveat = Boolean(event.caveat) && event.confidence?.toLowerCase() !== "high";
  return (
    <li className="event">
      <div className="event-head">
        <span className={`severity ${severity.className}`}>
          <span className="severity-icon" aria-hidden="true">
            {severity.icon}
          </span>
          <span className="visually-hidden">Severity: </span>
          {severity.label}
        </span>
        <span className="event-type">{meta.label}</span>
        {event.is_demo && (
          <span className="chip-tag" title="Measured against demo historical data">
            demo
          </span>
        )}
        <time className="event-time" dateTime={event.detected_at} title={formatDateTime(event.detected_at)}>
          {formatRelativeTime(event.detected_at)}
        </time>
      </div>
      <p className="event-subject">
        {event.brand && <strong>{event.brand}</strong>}
        {event.brand && event.product && <span aria-hidden="true"> · </span>}
        {event.product && <span className="event-product">{event.product}</span>}
      </p>
      {hasValues ? (
        <p className="event-values" title={event.summary || undefined}>
          {previous && <span className="event-prev">{previous}</span>}
          {previous && current && (
            <>
              <span aria-hidden="true"> → </span>
              <span className="visually-hidden"> changed to </span>
            </>
          )}
          {current && <span className="event-current">{current}</span>}
          {changePct !== null && <span className="event-change">({formatSignedPct(changePct)})</span>}
        </p>
      ) : (
        event.summary && <p className="event-summary">{event.summary}</p>
      )}
      {showCaveat && (
        <p className="event-caveat">
          {humanize(event.confidence)} confidence. {event.caveat}
        </p>
      )}
    </li>
  );
}

export function EventsFeed({
  events,
  country,
  initialVisible = INITIAL_VISIBLE,
}: {
  events: MarketEvent[];
  country: string;
  /** The dashboard teaser shows a few; the Changes page passes its page size to show them all. */
  initialVisible?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const sorted = [...events].sort((a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime());
  const visible = showAll ? sorted : sorted.slice(0, initialVisible);
  return (
    <>
      <ul className="event-list">
        {visible.map((event) => (
          <EventItem key={event.id} event={event} country={country} />
        ))}
      </ul>
      {sorted.length > initialVisible && (
        <button type="button" className="text-button" aria-expanded={showAll} onClick={() => setShowAll((value) => !value)}>
          {showAll ? "Show fewer" : `Show all ${sorted.length} changes`}
        </button>
      )}
    </>
  );
}
