import { Link } from "react-router-dom";

import type { Signal } from "../../lib/signals";
import { formatSignedPct } from "../../lib/format";
import { normalizeLabel } from "../../lib/opportunity";
import { ConfidenceBadge, SeverityBadge } from "../ui/Badge";
import { InfoTip } from "../ui/InfoTip";

export function SignalList({ signals, marketId }: { signals: Signal[]; marketId: number }) {
  return (
    <ul className="signal-list">
      {signals.map((signal) =>
        signal.kind === "opportunity" ? (
          <li key={signal.key} className="signal">
            <div className="badge-row">
              <span className="signal-kind">Opportunity</span>
              <span className="ui-badge tone-good">{normalizeLabel(signal.opportunity.label, signal.opportunity.score)}</span>
              <ConfidenceBadge level={String(signal.opportunity.confidence?.level ?? "")} />
            </div>
            <p className="signal-title">
              <strong>{signal.opportunity.keyword}</strong> scores {Math.round(signal.opportunity.score)}/100
            </p>
            <p className="signal-detail">
              Demand {formatSignedPct(signal.opportunity.demand_growth)} · supply {formatSignedPct(signal.opportunity.supply_growth)}
              {" · "}
              <Link to={`/markets/${marketId}/opportunities`}>Evidence</Link>
            </p>
          </li>
        ) : (
          <li key={signal.key} className="signal">
            <div className="badge-row">
              <span className="signal-kind">Change</span>
              <SeverityBadge level={signal.event.severity} />
              <ConfidenceBadge level={signal.event.confidence} />
            </div>
            <p className="signal-title">{signal.event.summary}</p>
            <p className="signal-detail">
              <Link to={`/markets/${marketId}/changes`}>All changes</Link>
            </p>
          </li>
        ),
      )}
    </ul>
  );
}

export function SignalsHelp() {
  return (
    <InfoTip label="market signals">
      Up to two opportunities scored Attractive or better, then recent changes ordered by severity. Low-confidence changes are left out.
      Nothing here is calculated in the browser.
    </InfoTip>
  );
}
