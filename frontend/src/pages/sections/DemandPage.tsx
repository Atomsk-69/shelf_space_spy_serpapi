import { useParams } from "react-router-dom";
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useDemand } from "../../api/hooks";
import { Panel } from "../../components/Panel";
import { SectionPage } from "../../components/SectionPage";
import { EmptyState, Loading, QueryBody } from "../../components/states";
import { ColumnChart } from "../../components/charts/Bars";
import { Badge, LowVolumeBadge } from "../../components/ui/Badge";
import { InfoTip } from "../../components/ui/InfoTip";
import { buildTrendChart, PRIOR_WEEKS, RECENT_WEEKS } from "../../lib/demand";
import { DASH, formatDecimal, formatSignedPct } from "../../lib/format";
import { parseMarketId } from "../../lib/ids";
import type { DemandSection } from "../../types";

const TICK = { fill: "var(--viz-muted)", fontSize: 11 };
const MOMENTUM: Record<string, { label: string; tone: "good" | "bad" | "neutral"; icon: string }> = {
  rising: { label: "Rising", tone: "good", icon: "▲" },
  falling: { label: "Falling", tone: "bad", icon: "▼" },
  flat: { label: "Flat", tone: "neutral", icon: "■" },
};
const shortWeek = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

function TrendChart({ item }: { item: DemandSection["keywords"][number] }) {
  const { rows, windows, completeWeeks, partialWeeks } = buildTrendChart(item.series);
  return (
    <figure className="chart-figure">
      <ul className="chart-legend" aria-label="Legend">
        <li>
          <span className="legend-swatch legend-line" aria-hidden="true" />
          Weekly search interest
        </li>
        {partialWeeks > 0 && (
          <li>
            <span className="legend-swatch legend-line is-dashed" aria-hidden="true" />
            Unfinished week (not used)
          </li>
        )}
        {windows.recent && (
          <li>
            <span className="legend-swatch legend-recent" aria-hidden="true" />
            Last {RECENT_WEEKS} complete weeks
          </li>
        )}
        {windows.prior && (
          <li>
            <span className="legend-swatch legend-prior" aria-hidden="true" />
            Prior {PRIOR_WEEKS} weeks
          </li>
        )}
      </ul>
      <div className="trend-chart" role="img" aria-label={`Weekly search interest for ${item.keyword}, ${completeWeeks} complete weeks`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -10 }}>
            <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
            {windows.prior && (
              <ReferenceArea x1={windows.prior[0]} x2={windows.prior[1]} fill="var(--viz-track)" fillOpacity={0.55} stroke="none" />
            )}
            {windows.recent && (
              <ReferenceArea x1={windows.recent[0]} x2={windows.recent[1]} fill="var(--viz-golden-wash)" fillOpacity={1} stroke="none" />
            )}
            <XAxis
              dataKey="week"
              tick={TICK}
              tickLine={false}
              axisLine={{ stroke: "var(--viz-baseline)" }}
              tickFormatter={shortWeek}
              minTickGap={28}
            />
            <YAxis
              tick={TICK}
              tickLine={false}
              axisLine={false}
              domain={[0, "auto"]}
              width={40}
              label={{ value: "Interest (0-100)", angle: -90, position: "insideLeft", fill: "var(--viz-muted)", fontSize: 11, dy: 40 }}
            />
            <Tooltip
              labelFormatter={(label) => `Week of ${shortWeek(String(label))}`}
              formatter={(value, name) => [String(value), name === "partial" ? "Interest (unfinished week)" : "Interest"]}
            />
            <Line
              type="monotone"
              dataKey="complete"
              stroke="var(--viz-mine)"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="partial"
              stroke="var(--viz-mine)"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={{ r: 3 }}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

function DemandCard({ item }: { item: DemandSection["keywords"][number] }) {
  const { signal } = item;
  const momentum = signal?.momentum ? MOMENTUM[signal.momentum] : undefined;
  const { completeWeeks } = buildTrendChart(item.series);
  const shortHistory = completeWeeks < RECENT_WEEKS + PRIOR_WEEKS;
  return (
    <li className="demand-card">
      <div className="opportunity-head">
        <h4>{item.keyword}</h4>
        <div className="badge-row">
          {momentum && (
            <Badge tone={momentum.tone} icon={momentum.icon} title="Direction of the last four complete weeks">
              {momentum.label}
            </Badge>
          )}
          {signal?.low_volume && <LowVolumeBadge />}
          {shortHistory && completeWeeks > 0 && (
            <Badge
              tone="info"
              icon="…"
              title={`The comparison uses ${RECENT_WEEKS} + ${PRIOR_WEEKS} complete weeks; this probe has ${completeWeeks}.`}
            >
              Short history ({completeWeeks} weeks)
            </Badge>
          )}
        </div>
      </div>
      {signal === null ? (
        <p className="field-hint">No Google Trends data for this probe.</p>
      ) : (
        <>
          <dl className="compare">
            <div>
              <dt>Last {RECENT_WEEKS} complete weeks</dt>
              <dd>{signal.recent_avg == null ? DASH : formatDecimal(signal.recent_avg)}</dd>
            </div>
            <div>
              <dt>Prior {PRIOR_WEEKS} weeks</dt>
              <dd>{signal.prior_avg == null ? DASH : formatDecimal(signal.prior_avg)}</dd>
            </div>
            <div>
              <dt>Change</dt>
              <dd className={signal.growth_pct === null ? undefined : signal.growth_pct >= 0 ? "delta-up" : "delta-down"}>
                {signal.growth_pct === null ? DASH : formatSignedPct(signal.growth_pct)}
              </dd>
            </div>
          </dl>
          {signal.recent_avg != null && signal.prior_avg != null && (
            <ColumnChart
              height={150}
              data={[
                { name: `Prior ${PRIOR_WEEKS} weeks`, value: signal.prior_avg, color: "var(--viz-other)" },
                { name: `Last ${RECENT_WEEKS} complete weeks`, value: signal.recent_avg },
              ]}
              format={(value) => formatDecimal(value)}
              unit="average interest"
              valueHeader="Average interest"
              label={`Average search interest for ${item.keyword}: prior ${PRIOR_WEEKS} weeks versus last ${RECENT_WEEKS} complete weeks`}
            />
          )}
          <TrendChart item={item} />
          {signal.caveats.length > 0 && (
            <ul className="bullet-list caveat-list">
              {signal.caveats.map((caveat) => (
                <li key={caveat}>{caveat}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </li>
  );
}

export default function DemandPage() {
  const id = parseMarketId(useParams().id);
  const demand = useDemand(id);
  return (
    <SectionPage
      id={id}
      label="DEMAND"
      title="What shoppers are searching for"
      intro="Google Trends interest per probe. Growth compares the last four complete weeks with the eight before; an unfinished week is drawn dashed and left out."
      scan={demand.data?.scan}
    >
      <Panel
        label="GOOGLE TRENDS"
        title={
          <>
            Search interest by probe
            <InfoTip label="Trends values">
              Google scales interest 0-100 within one comparison request, so compare growth rates between probes, not the absolute heights
              of two separate requests.
            </InfoTip>
          </>
        }
      >
        <QueryBody
          query={demand}
          loading={<Loading rows={6} />}
          errorTitle="Couldn't load demand"
          isEmpty={(value) => !value.has_data}
          empty={
            <EmptyState
              title="No Google Trends data yet"
              hint="Run a scan with the button in the top bar; each scan also pulls Trends for every probe."
            />
          }
        >
          {(value) => (
            <ul className="opportunity-list demand-list">
              {value.keywords.map((item) => (
                <DemandCard key={item.keyword} item={item} />
              ))}
            </ul>
          )}
        </QueryBody>
      </Panel>
      <Panel label="RELATED QUERIES" title="Related searches">
        <EmptyState
          title="Not collected yet"
          hint="The scanner currently stores only the interest-over-time series, so related queries can't be shown. They will appear here once the scanner records them."
        />
      </Panel>
    </SectionPage>
  );
}
