import type { ReactNode } from "react";

import { useGenerateWeeklyReport, useLatestReport } from "../../api/hooks";
import { errorMessage } from "../../api/errors";
import type { Report } from "../../types";
import { formatDateTime, formatRelativeTime } from "../../lib/format";
import { Panel } from "../Panel";
import { EmptyState, ErrorState, Loading } from "../states";

/** Inline **bold** only; everything else stays plain text (no HTML injection). */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : part,
  );
}

/** Minimal Markdown-ish renderer for the brief: #/## headings, - or * bullets, paragraphs. */
function BriefContent({ content }: { content: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push(<ul key={`l${blocks.length}`} className="bullet-list">{list.map((item, index) => <li key={index}>{inline(item)}</li>)}</ul>);
      list = [];
    }
    if (paragraph.length) {
      blocks.push(<p key={`p${blocks.length}`}>{inline(paragraph.join(" "))}</p>);
      paragraph = [];
    }
  };
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    if (!line) flush();
    else if (heading) {
      flush();
      blocks.push(heading[1].length === 1
        ? <h4 key={`h${blocks.length}`} className="brief-title">{inline(heading[2])}</h4>
        : <h5 key={`h${blocks.length}`}>{inline(heading[2])}</h5>);
    } else if (bullet) {
      if (paragraph.length) flush();
      list.push(bullet[1]);
    } else {
      if (list.length) flush();
      paragraph.push(line);
    }
  }
  flush();
  return <div className="brief-content">{blocks}</div>;
}

function sourceLabel(report: Report): string | null {
  if (report.source === "llm") return "AI narrated from computed numbers";
  if (report.source === "template") return "Template brief (no AI)";
  return null;
}

export function WeeklyBrief({ marketId, fallback }: { marketId: number; fallback: Report | null | undefined }) {
  const latest = useLatestReport(marketId);
  const generate = useGenerateWeeklyReport(marketId);
  // If the latest-report endpoint fails, the dashboard payload's copy is still worth showing.
  const report = latest.data ?? (latest.isError ? fallback ?? null : latest.data);
  const hasReport = Boolean(report?.content);

  const actions = (
    <button type="button" onClick={() => generate.mutate()} disabled={generate.isPending} aria-busy={generate.isPending}>
      {generate.isPending ? "Writing brief…" : hasReport ? "Regenerate brief" : "Generate weekly brief"}
    </button>
  );

  let body: ReactNode;
  if (report === undefined) {
    body = <Loading label="Loading the latest brief…" rows={5} />;
  } else if (!report || !report.content) {
    body = latest.isError
      ? <ErrorState error={latest.error} title="Couldn't load the latest brief" onRetry={() => void latest.refetch()} />
      : <EmptyState title="No brief yet" hint="Generate one to turn this week's computed numbers into a short narrative. The writer only restates numbers the analytics produced." />;
  } else {
    const source = sourceLabel(report);
    body = (
      <div className={generate.isPending || latest.isFetching ? "is-refreshing" : undefined}>
        <p className="brief-meta">
          <time dateTime={report.created_at} title={formatDateTime(report.created_at)}>Written {formatRelativeTime(report.created_at)}</time>
          {source && <span className="chip-tag">{source}</span>}
        </p>
        <BriefContent content={report.content} />
      </div>
    );
  }

  return (
    <Panel id="weekly-brief" label="WEEKLY BRIEF" title="What to tell the team" actions={actions} className="span-12">
      {generate.isError && <p className="notice error" role="alert">Couldn't generate the brief: {errorMessage(generate.error)}</p>}
      {body}
    </Panel>
  );
}
