import type { ReactElement } from "react";
import {
  CartesianGrid,
  LabelList,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  type CartesianViewBox,
  type LabelProps,
  type ScatterShapeProps,
  type TooltipContentProps,
} from "recharts";

import type { Opportunity, OpportunityLabel } from "../../types";
import { formatSignedPct } from "../../lib/format";
import { LABEL_COLOR, LABEL_HINT, LABEL_ORDER, normalizeLabel } from "../../lib/opportunity";
import { EmptyState } from "../states";

type Anchor = "start" | "middle" | "end";
type Point = {
  x: number; y: number; keyword: string; score: number; label: OpportunityLabel;
  /** Direct-label text per anchor: only one is non-empty, and only for the top-scored points. */
  tagStart: string; tagMiddle: string; tagEnd: string;
};

const LABELLED_POINTS = 3;
const CHART_HEIGHT = 300;
const TICK = { fill: "var(--viz-muted)", fontSize: 12 };

const isNum = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const truncate = (text: string, max = 22) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** Domain that always includes 0 with room on both sides, so every quadrant is visible. */
function domainFor(values: number[]): [number, number] {
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const pad = Math.max(5, (max - min) * 0.12);
  return [Math.floor((min - pad) / 5) * 5, Math.ceil((max + pad) / 5) * 5];
}

type DotRenderer = (props: ScatterShapeProps) => ReactElement | null;
const dotShapes = new Map<string, DotRenderer>();

/** 10px dot with a 2px surface ring, inside a transparent 24px hit target. Cached per color for stable identity. */
function dotShape(color: string): DotRenderer {
  let shape = dotShapes.get(color);
  if (!shape) {
    shape = ({ cx, cy }) => {
      if (!isNum(cx) || !isNum(cy)) return null;
      return (
        <g>
          <circle cx={cx} cy={cy} r={12} fill="transparent" />
          <circle cx={cx} cy={cy} r={5} fill={color} stroke="var(--viz-surface)" strokeWidth={2} />
        </g>
      );
    };
    dotShapes.set(color, shape);
  }
  return shape;
}

const pointLabels = new Map<Anchor, (props: LabelProps) => ReactElement | null>();

/**
 * Single-line label above a dot. Recharts' default label wraps text to the dot's width,
 * so render a plain <text>; points near the plot edges anchor inward so labels stay inside.
 */
function pointLabel(anchor: Anchor) {
  let render = pointLabels.get(anchor);
  if (!render) {
    render = ({ value, viewBox }) => {
      if (value === undefined || value === null || value === "" || !viewBox || !("width" in viewBox)) return null;
      const box = viewBox as CartesianViewBox;
      const centerX = (box.x ?? 0) + (box.width ?? 0) / 2;
      const x = anchor === "start" ? centerX - 6 : anchor === "end" ? centerX + 6 : centerX;
      return <text x={x} y={(box.y ?? 0) - 6} textAnchor={anchor} fill="var(--viz-ink-2)" fontSize={12}>{String(value)}</text>;
    };
    pointLabels.set(anchor, render);
  }
  return render;
}

function anchorFor(value: number, [min, max]: [number, number]): Anchor {
  const position = (value - min) / (max - min || 1);
  return position > 0.68 ? "end" : position < 0.32 ? "start" : "middle";
}

function ScatterTooltip({ active, payload }: TooltipContentProps) {
  const point = payload?.[0]?.payload as Point | undefined;
  if (!active || !point) return null;
  return (
    <div className="chart-tooltip">
      <p className="tooltip-title">{point.keyword}</p>
      <p><strong>{point.score}</strong>/100 <span className="muted-ink">score · {point.label}</span></p>
      <p><strong>{formatSignedPct(point.y)}</strong> <span className="muted-ink">demand growth</span></p>
      <p><strong>{formatSignedPct(point.x)}</strong> <span className="muted-ink">supply growth</span></p>
    </div>
  );
}

export function OpportunityScatter({ opportunities }: { opportunities: Opportunity[] }) {
  const ranked = [...opportunities].sort((a, b) => b.score - a.score);
  const plottable = ranked.filter((item) => isNum(item.demand_growth) && isNum(item.supply_growth));

  if (plottable.length === 0) {
    return <EmptyState title="No demand and supply readings yet" hint="Each probe needs Google Trends history and at least one shelf scan before it can be plotted." />;
  }

  const xDomain = domainFor(plottable.map((item) => item.supply_growth as number));
  const yDomain = domainFor(plottable.map((item) => item.demand_growth as number));
  const points: Point[] = plottable.map((item, index) => {
    const x = item.supply_growth as number;
    const tag = index < LABELLED_POINTS ? truncate(item.keyword) : "";
    const anchor = anchorFor(x, xDomain);
    return {
      x,
      y: item.demand_growth as number,
      keyword: item.keyword,
      score: Math.round(item.score),
      label: normalizeLabel(item.label, item.score),
      tagStart: anchor === "start" ? tag : "",
      tagMiddle: anchor === "middle" ? tag : "",
      tagEnd: anchor === "end" ? tag : "",
    };
  });
  const groups = LABEL_ORDER.map((label) => ({ label, points: points.filter((point) => point.label === label) })).filter((group) => group.points.length > 0);

  return (
    <figure className="chart-figure">
      <ul className="chart-legend" aria-label="Legend">
        <li><span className="legend-swatch legend-area" aria-hidden="true" />Golden quadrant: demand up, supply shrinking</li>
        {groups.map((group) => (
          <li key={group.label} title={LABEL_HINT[group.label]}>
            <span className="legend-swatch legend-dot" style={{ background: LABEL_COLOR[group.label] }} aria-hidden="true" />
            {group.label}
          </li>
        ))}
      </ul>
      <p className="axis-title axis-title-y" aria-hidden="true">↑ Demand growth (search interest)</p>
      <div className="chart-frame" style={{ height: CHART_HEIGHT }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 18, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--viz-grid)" />
            <ReferenceArea x1={xDomain[0]} x2={0} y1={0} y2={yDomain[1]} fill="var(--viz-golden-wash)" fillOpacity={1} stroke="none" ifOverflow="hidden" />
            <ReferenceLine x={0} stroke="var(--viz-baseline)" />
            <ReferenceLine y={0} stroke="var(--viz-baseline)" />
            <XAxis
              type="number"
              dataKey="x"
              name="Supply growth"
              domain={xDomain}
              tickFormatter={(value: number) => `${value}%`}
              tick={TICK}
              tickLine={false}
              axisLine={{ stroke: "var(--viz-baseline)" }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Demand growth"
              domain={yDomain}
              width={48}
              tickFormatter={(value: number) => `${value}%`}
              tick={TICK}
              tickLine={false}
              axisLine={{ stroke: "var(--viz-baseline)" }}
            />
            <Tooltip content={ScatterTooltip} cursor={false} isAnimationActive={false} />
            {groups.map((group) => (
              <Scatter key={group.label} name={group.label} data={group.points} shape={dotShape(LABEL_COLOR[group.label])} isAnimationActive={false}>
                <LabelList dataKey="tagStart" content={pointLabel("start")} />
                <LabelList dataKey="tagMiddle" content={pointLabel("middle")} />
                <LabelList dataKey="tagEnd" content={pointLabel("end")} />
              </Scatter>
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <p className="axis-title axis-title-x" aria-hidden="true">Supply growth (competing listings) →</p>
      <figcaption className="chart-caption">
        Each dot is a search probe. Up means rising search interest; left means fewer competing listings. The top {Math.min(LABELLED_POINTS, points.length)} by score are labelled.
      </figcaption>
      <details className="table-view">
        <summary>View as table</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr><th scope="col">Probe</th><th scope="col" className="num">Score</th><th scope="col">Label</th><th scope="col" className="num">Demand</th><th scope="col" className="num">Supply</th></tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.keyword}>
                  <th scope="row">{point.keyword}</th>
                  <td className="num">{point.score}</td>
                  <td>{point.label}</td>
                  <td className="num">{formatSignedPct(point.y)}</td>
                  <td className="num">{formatSignedPct(point.x)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
