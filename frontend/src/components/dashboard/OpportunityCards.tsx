import { useId, useState } from "react";

import type { Opportunity } from "../../types";
import { formatSignedPct } from "../../lib/format";
import { LABEL_COLOR, LABEL_HINT, normalizeLabel } from "../../lib/opportunity";

function OpportunityCard({ opportunity }: { opportunity: Opportunity }) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const label = normalizeLabel(opportunity.label, opportunity.score);
  const score = Math.max(0, Math.min(100, Math.round(opportunity.score)));
  const reasons = opportunity.reasons ?? [];
  const caveats = opportunity.caveats ?? [];

  return (
    <li className="opportunity-card">
      <div className="opportunity-head">
        <h4>{opportunity.keyword}</h4>
        <span className="label-badge" title={LABEL_HINT[label]}>
          <span className="label-dot" style={{ background: LABEL_COLOR[label] }} aria-hidden="true" />
          {label}
        </span>
      </div>
      <div className="score-row">
        <span className="score-value"><strong>{score}</strong><span className="muted-ink">/100</span></span>
        <span className="score-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score} aria-label={`Opportunity score for ${opportunity.keyword}`}>
          <span className="score-fill" style={{ width: `${score}%`, background: LABEL_COLOR[label] }} />
        </span>
      </div>
      <dl className="opportunity-facts">
        <div><dt>Demand</dt><dd>{formatSignedPct(opportunity.demand_growth)}</dd></div>
        <div><dt>Supply</dt><dd>{formatSignedPct(opportunity.supply_growth)}</dd></div>
      </dl>
      <button type="button" className="disclosure" aria-expanded={open} aria-controls={detailsId} onClick={() => setOpen((value) => !value)}>
        <span aria-hidden="true" className="disclosure-icon">{open ? "−" : "+"}</span>
        Why this score{caveats.length > 0 ? ` · ${caveats.length} caveat${caveats.length === 1 ? "" : "s"}` : ""}
      </button>
      <div id={detailsId} hidden={!open} className="opportunity-details">
        {reasons.length > 0 ? (
          <ul className="bullet-list">{reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul>
        ) : (
          <p className="muted-ink">No reasons were recorded for this score.</p>
        )}
        {caveats.length > 0 && (
          <>
            <p className="caveat-title">Caveats</p>
            <ul className="bullet-list caveat-list">{caveats.map((caveat, index) => <li key={index}>{caveat}</li>)}</ul>
          </>
        )}
      </div>
    </li>
  );
}

export function OpportunityCards({ opportunities }: { opportunities: Opportunity[] }) {
  const sorted = [...opportunities].sort((a, b) => b.score - a.score);
  return (
    <ul className="opportunity-list">
      {sorted.map((opportunity) => <OpportunityCard key={opportunity.keyword} opportunity={opportunity} />)}
    </ul>
  );
}
