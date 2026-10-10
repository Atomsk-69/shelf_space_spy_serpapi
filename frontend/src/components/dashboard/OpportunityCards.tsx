import { useState } from "react";

import type { Opportunity } from "../../types";
import { formatSignedPct } from "../../lib/format";
import { LABEL_COLOR, LABEL_HINT, normalizeLabel } from "../../lib/opportunity";
import { OpportunityDrawer } from "../OpportunityDrawer";
import { ConfidenceBadge } from "../ui/Badge";

/** Ranked list. The score and the confidence are shown side by side but never merged. */
export function OpportunityCards({ opportunities }: { opportunities: Opportunity[] }) {
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const sorted = [...opportunities].sort((a, b) => b.score - a.score);
  return (
    <>
      <ol className="opportunity-list ranked">
        {sorted.map((opportunity, index) => {
          const label = normalizeLabel(opportunity.label, opportunity.score);
          const score = Math.max(0, Math.min(100, Math.round(opportunity.score)));
          return (
            <li key={opportunity.keyword} className="opportunity-card">
              <div className="opportunity-head">
                <h4>
                  <span className="rank-number">{index + 1}</span> {opportunity.keyword}
                </h4>
                <span className="label-badge" title={LABEL_HINT[label]}>
                  <span className="label-dot" style={{ background: LABEL_COLOR[label] }} aria-hidden="true" />
                  {label}
                </span>
              </div>
              <div className="score-row">
                <span className="score-value">
                  <strong>{score}</strong>
                  <span className="muted-ink">/100</span>
                </span>
                <span
                  className="score-meter"
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={score}
                  aria-label={`Opportunity score for ${opportunity.keyword}`}
                >
                  <span className="score-fill" style={{ width: `${score}%`, background: LABEL_COLOR[label] }} />
                </span>
              </div>
              <div className="badge-row">
                <ConfidenceBadge level={String(opportunity.confidence?.level ?? "")} />
                <span className="muted-ink small">
                  Demand {formatSignedPct(opportunity.demand_growth)} · supply {formatSignedPct(opportunity.supply_growth)}
                </span>
              </div>
              <button type="button" className="disclosure" onClick={() => setSelected(opportunity)}>
                Evidence
                {opportunity.caveats.length > 0
                  ? ` · ${opportunity.caveats.length} caveat${opportunity.caveats.length === 1 ? "" : "s"}`
                  : ""}{" "}
                →
              </button>
            </li>
          );
        })}
      </ol>
      <OpportunityDrawer opportunity={selected} onClose={() => setSelected(null)} />
    </>
  );
}
