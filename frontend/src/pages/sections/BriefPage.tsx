import { Link, useParams } from "react-router-dom";

import { useEvents, useGenerateWeeklyReport, useLatestReport, useOpportunities, useReports } from "../../api/hooks";
import { errorMessage } from "../../api/errors";
import { EventsFeed } from "../../components/dashboard/EventsFeed";
import { OpportunityCards } from "../../components/dashboard/OpportunityCards";
import { Panel } from "../../components/Panel";
import { SectionPage } from "../../components/SectionPage";
import { EmptyState, ErrorState, Loading, QueryBody } from "../../components/states";
import { Badge } from "../../components/ui/Badge";
import { findSection, parseBrief, type BriefSection } from "../../lib/brief";
import { formatDateTime, formatRelativeTime } from "../../lib/format";
import { parseMarketId } from "../../lib/ids";
import { scrubText } from "../../lib/text";
import { fallbackExplanation, sourceLabel } from "../../lib/report";
import type { Report } from "../../types";

function Bullets({ section }: { section: BriefSection }) {
  return (
    <>
      {section.text.map((line, index) => (
        <p key={`t${index}`}>{line}</p>
      ))}
      {section.bullets.length > 0 && (
        <ul className="bullet-list">
          {section.bullets.map((bullet, index) => (
            <li key={index}>{bullet}</li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Provenance: who wrote this brief and, for a template, why the AI writer was not used. */
function Provenance({ report }: { report: Report }) {
  const label = sourceLabel(report);
  const why = fallbackExplanation(report);
  const rejected = report.diagnostics?.rejected_claims ?? [];
  return (
    <div className="stack">
      <div className="badge-row">
        <Badge tone={report.source === "llm" ? "info" : "neutral"} icon={report.source === "llm" ? "✦" : "▤"}>
          {label ?? "Brief"}
        </Badge>
      </div>
      <p className="data-note" title={formatDateTime(report.created_at)}>
        Written {formatRelativeTime(report.created_at)}
        {report.diagnostics?.model ? ` · ${report.diagnostics.model}` : ""}
      </p>
      {why && (
        <p className="notice notice-info" role="note">
          {why}
          {rejected.length > 0 && <> Rejected: {rejected.join(", ")}.</>}
        </p>
      )}
      <p className="data-note">Every number comes from the stored analytics. The writer is not allowed to calculate or add figures.</p>
    </div>
  );
}

function BriefBody({ report, marketId }: { report: Report; marketId: number }) {
  const brief = parseBrief(report.content);
  const act = [findSection(brief, "Opportunities"), findSection(brief, "Watch-outs")].filter((s): s is BriefSection => Boolean(s));
  const rest = brief.sections.filter((section) => !act.includes(section));
  const topOpportunities = useOpportunities(marketId);
  const events = useEvents(marketId, { types: [], includeLow: false, limit: 5, offset: 0 });
  return (
    <div className="dash-grid">
      <div className="span-8 stack">
        <Panel label="HEADLINE" title={brief.headline || "Weekly brief"} className="brief-hero">
          <Provenance report={report} />
        </Panel>
        {act.length > 0 && (
          <Panel label="WHAT TO ACT ON" title="Opportunities and watch-outs" className="brief-act">
            <div className="brief-sections">
              {act.map((section) => (
                <section key={section.title}>
                  <h4>{section.title}</h4>
                  <Bullets section={section} />
                </section>
              ))}
            </div>
            <p className="data-note">
              These are the brief's own points, taken straight from its text. Open the evidence on the right to check each one.
            </p>
          </Panel>
        )}
        {rest.length > 0 && (
          <Panel label="DETAIL" title="Full brief">
            <div className="brief-sections">
              {rest.map((section) => (
                <section key={section.title}>
                  <h4>{section.title}</h4>
                  <Bullets section={section} />
                </section>
              ))}
            </div>
          </Panel>
        )}
      </div>
      <div className="span-4 stack">
        <Panel label="EVIDENCE" title="Scores behind it">
          <QueryBody
            query={topOpportunities}
            loading={<Loading rows={4} />}
            isEmpty={(v) => v.items.length === 0}
            empty={<EmptyState title="No scores yet" />}
          >
            {(value) => <OpportunityCards opportunities={value.items} />}
          </QueryBody>
        </Panel>
        <Panel label="EVIDENCE" title="Latest trusted changes">
          <QueryBody
            query={events}
            loading={<Loading rows={4} />}
            isEmpty={(v) => v.items.length === 0}
            empty={<EmptyState title="No changes yet" />}
          >
            {(value) => (
              <>
                <EventsFeed events={value.items} country="" initialVisible={5} />
                <Link to={`/markets/${marketId}/changes`} className="link-more">
                  All changes →
                </Link>
              </>
            )}
          </QueryBody>
        </Panel>
      </div>
    </div>
  );
}

export default function BriefPage() {
  const id = parseMarketId(useParams().id);
  const latest = useLatestReport(id);
  const generate = useGenerateWeeklyReport(id);
  const reports = useReports(id);
  const report = latest.data;

  return (
    <SectionPage
      id={id}
      label="WEEKLY BRIEF"
      title="What changed, why it matters, what to do"
      intro="A short narrative written from the stored numbers only. A plain template is used whenever the AI writer is unavailable or its draft can't be verified."
    >
      <div className="page-actions">
        <button type="button" onClick={() => generate.mutate()} disabled={generate.isPending} aria-busy={generate.isPending}>
          {generate.isPending ? "Writing brief…" : report ? "Regenerate brief" : "Generate weekly brief"}
        </button>
      </div>
      {generate.isError && (
        <p className="notice error" role="alert">
          Couldn't generate the brief: {errorMessage(generate.error)}
        </p>
      )}
      {report === undefined && latest.isError ? (
        <ErrorState error={latest.error} title="Couldn't load the latest brief" onRetry={() => void latest.refetch()} />
      ) : report === undefined ? (
        <Loading label="Loading the latest brief…" rows={6} />
      ) : report === null ? (
        <EmptyState
          title="No brief yet"
          hint="Generate one to turn this market's numbers into a short explanation. It only restates numbers the analytics produced."
        />
      ) : (
        <div className={generate.isPending || latest.isFetching ? "is-refreshing" : undefined}>
          <BriefBody report={report} marketId={id} />
        </div>
      )}

      <Panel label="HISTORY" title="Earlier briefs" className="history-panel">
        <QueryBody
          query={reports}
          loading={<Loading rows={3} />}
          errorTitle="Couldn't load earlier briefs"
          isEmpty={(value) => value.items.length <= 1}
          empty={<EmptyState title="No earlier briefs" hint="Generate a brief now and again after your next scan to build a history." />}
        >
          {(value) => (
            <ul className="report-history">
              {value.items.slice(1).map((item) => (
                <li key={item.id}>
                  <details>
                    <summary>
                      {formatDateTime(item.created_at)} · {sourceLabel(item) ?? "Brief"}
                    </summary>
                    {fallbackExplanation(item) && <p className="field-hint">{fallbackExplanation(item)}</p>}
                    <pre className="report-text">{scrubText(item.content)}</pre>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </QueryBody>
      </Panel>
    </SectionPage>
  );
}
