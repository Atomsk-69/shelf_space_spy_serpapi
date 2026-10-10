import { useRecommendations } from "../api/hooks";
import { visibleLines } from "../lib/text";
import { formatEvidence, kindLabel } from "../lib/recommendations";
import type { Recommendation } from "../types";
import { Panel } from "./Panel";
import { EmptyState, Loading, QueryBody } from "./states";
import { Badge, ConfidenceBadge } from "./ui/Badge";
import { InfoTip } from "./ui/InfoTip";

const PRIORITY: Record<string, { tone: "bad" | "warn" | "neutral"; icon: string; label: string }> = {
  high: { tone: "bad", icon: "▲", label: "High priority" },
  medium: { tone: "warn", icon: "◆", label: "Medium priority" },
  low: { tone: "neutral", icon: "●", label: "Low priority" },
};

function Card({ item, country }: { item: Recommendation; country: string }) {
  const priority = PRIORITY[item.priority] ?? PRIORITY.low;
  return (
    <li className="rec-card">
      <div className="badge-row">
        <span className="rec-kind">{kindLabel(item.kind)}</span>
        <Badge tone={priority.tone} icon={priority.icon}>
          {priority.label}
        </Badge>
        <ConfidenceBadge level={item.confidence} />
      </div>
      <h4 className="rec-title">{item.title}</h4>
      <p className="rec-summary">{item.summary}</p>

      <p className="rec-heading">Why (the evidence)</p>
      <dl className="rec-evidence">
        {item.evidence.map((evidence) => (
          <div key={evidence.label}>
            <dt>{evidence.label}</dt>
            <dd>{formatEvidence(evidence, country)}</dd>
          </div>
        ))}
      </dl>

      <p className="rec-heading">Suggested action</p>
      <p className="rec-action">{item.action}</p>

      {visibleLines(item.limitations).length > 0 && (
        <details className="rec-limits">
          <summary>Limitations ({visibleLines(item.limitations).length})</summary>
          <ul className="bullet-list caveat-list">
            {visibleLines(item.limitations).map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

/**
 * Recommended actions for one scan. They come from deterministic rules over the scans already stored (no new
 * SerpAPI calls) and each lists its evidence, confidence and limitations. They are hypotheses to investigate.
 */
export function RecommendedActions({ marketId, country, scanId = null }: { marketId: number; country: string; scanId?: number | null }) {
  const recommendations = useRecommendations(marketId, scanId);
  return (
    <Panel
      id="recommended-actions"
      label="RECOMMENDED ACTIONS"
      title={
        <>
          What to look at next
          <InfoTip label="recommended actions">
            Rules over the Shopping and Trends data you already have. Google does not show sales, margins or real demand, so treat each item
            as a hypothesis to check, not advice.
          </InfoTip>
        </>
      }
      className="span-12"
    >
      <QueryBody
        query={recommendations}
        loading={<Loading rows={5} />}
        errorTitle="Couldn't load recommended actions"
        isEmpty={(value) => !value.has_data || value.items.length === 0}
        empty={
          <EmptyState
            title="No recommendations yet"
            hint="They appear after a scan has opportunity scores. Each one lists the evidence behind it."
          />
        }
      >
        {(value) => (
          <>
            <ul className="rec-list">
              {value.items.map((item) => (
                <Card key={item.id} item={item} country={country} />
              ))}
            </ul>
            {visibleLines(value.notes).map((note) => (
              <p key={note} className="data-note">
                {note}
              </p>
            ))}
            <p className="data-note">
              Hypotheses, not guaranteed business advice. Confidence says how well the stored data supports each one.
            </p>
          </>
        )}
      </QueryBody>
    </Panel>
  );
}
