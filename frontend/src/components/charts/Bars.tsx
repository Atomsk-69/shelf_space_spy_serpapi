import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const TICK = { fill: "var(--viz-muted)", fontSize: 12 };
const AXIS = { stroke: "var(--viz-baseline)" };
const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export type BarDatum = { name: string; value: number; color?: string; highlight?: boolean; note?: string };

type TipProps = {
  active?: boolean;
  payload?: readonly { value?: unknown; name?: unknown; color?: string; payload?: unknown }[];
  label?: unknown;
  format: (v: number) => string;
  unit?: string;
};

function Tip({ active, payload, label, format, unit }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="tooltip-title">{String((payload[0].payload as BarDatum | undefined)?.name ?? label ?? "")}</p>
      {payload.map((item) => (
        <p key={String(item.name)}>
          {payload.length > 1 && <span className="tip-swatch" style={{ background: item.color }} aria-hidden="true" />}
          <strong>{format(Number(item.value ?? 0))}</strong>{" "}
          <span className="muted-ink">{payload.length > 1 ? String(item.name) : unit}</span>
        </p>
      ))}
      {(payload[0].payload as BarDatum | undefined)?.note && <p className="muted-ink">{(payload[0].payload as BarDatum).note}</p>}
    </div>
  );
}

function TableView({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="table-view">
      <summary>View as table</summary>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {head.map((cell, index) => (
                <th key={cell} scope="col" className={index > 0 ? "num" : undefined}>
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row[0])}>
                {row.map((cell, index) =>
                  index === 0 ? (
                    <th key={index} scope="row">
                      {cell}
                    </th>
                  ) : (
                    <td key={index} className="num">
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** Horizontal bars, largest first as given. Emphasised bars (your brand) use the accent; others a recessive gray. */
export function HBarChart({
  data,
  format,
  unit,
  label,
  caption,
  domainMax,
  valueHeader = "Value",
}: {
  data: BarDatum[];
  format: (value: number) => string;
  unit?: string;
  label: string;
  caption?: ReactNode;
  domainMax?: number;
  valueHeader?: string;
}) {
  const height = Math.max(120, data.length * 34 + 24);
  return (
    <figure className="chart-figure">
      <div className="bar-frame" style={{ height }} role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }} barCategoryGap={6}>
            <CartesianGrid stroke="var(--viz-grid)" horizontal={false} />
            <XAxis type="number" hide domain={[0, domainMax ?? "dataMax"]} />
            <YAxis
              type="category"
              dataKey="name"
              width={118}
              tick={TICK}
              tickLine={false}
              axisLine={AXIS}
              tickFormatter={(v: string) => truncate(v, 18)}
              interval={0}
            />
            <Tooltip cursor={{ fill: "var(--surface-2)" }} content={(props) => <Tip {...props} format={format} unit={unit} />} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} isAnimationActive animationDuration={700}>
              {data.map((item) => (
                <Cell key={item.name} fill={item.color ?? (item.highlight ? "var(--viz-mine)" : "var(--viz-other)")} />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                formatter={(v: unknown) => format(Number(v))}
                fill="var(--viz-ink-2)"
                fontSize={12}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {caption && <figcaption className="chart-caption">{caption}</figcaption>}
      <TableView head={["Name", valueHeader]} rows={data.map((d) => [d.name, format(d.value)])} />
    </figure>
  );
}

/** Vertical bars with a fixed domain (e.g. a 0-100 score), each bar coloured by the data. */
export function ColumnChart({
  data,
  format,
  unit,
  label,
  caption,
  domain = [0, "auto"],
  height = 260,
  valueHeader = "Value",
}: {
  data: BarDatum[];
  format: (value: number) => string;
  unit?: string;
  label: string;
  caption?: ReactNode;
  domain?: [number, number | "auto"];
  height?: number;
  valueHeader?: string;
}) {
  return (
    <figure className="chart-figure">
      <div className="bar-frame" style={{ height }} role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 22, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={TICK}
              tickLine={false}
              axisLine={AXIS}
              tickFormatter={(v: string) => truncate(v, 14)}
              interval={0}
            />
            <YAxis tick={TICK} tickLine={false} axisLine={false} domain={domain} width={44} tickFormatter={(v: number) => format(v)} />
            <Tooltip cursor={{ fill: "var(--surface-2)" }} content={(props) => <Tip {...props} format={format} unit={unit} />} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={72} isAnimationActive animationDuration={700}>
              {data.map((item) => (
                <Cell key={item.name} fill={item.color ?? "var(--viz-mine)"} />
              ))}
              <LabelList
                dataKey="value"
                position="top"
                formatter={(v: unknown) => format(Number(v))}
                fill="var(--viz-ink-2)"
                fontSize={12}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {caption && <figcaption className="chart-caption">{caption}</figcaption>}
      <TableView head={["Name", valueHeader]} rows={data.map((d) => [d.name, format(d.value)])} />
    </figure>
  );
}

export type Series = { key: string; label: string; color: string };

/** Several series per category: stacked (parts of a whole, e.g. price bands) or side by side (grouped). */
export function SeriesBars({
  data,
  series,
  stacked,
  horizontal,
  label,
  caption,
  format = (v) => String(v),
  height,
}: {
  data: ({ name: string } & Record<string, number | string>)[];
  series: Series[];
  stacked?: boolean;
  horizontal?: boolean;
  label: string;
  caption?: ReactNode;
  format?: (value: number) => string;
  height?: number;
}) {
  const h = height ?? (horizontal ? Math.max(140, data.length * 54 + 56) : 280);
  return (
    <figure className="chart-figure">
      <div className="bar-frame" style={{ height: h }} role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout={horizontal ? "vertical" : "horizontal"}
            margin={{ top: 8, right: 16, bottom: 0, left: horizontal ? 0 : -8 }}
            barCategoryGap={horizontal ? 12 : "22%"}
          >
            <CartesianGrid stroke="var(--viz-grid)" horizontal={!horizontal} vertical={!!horizontal} />
            {horizontal ? (
              <>
                <XAxis type="number" tick={TICK} tickLine={false} axisLine={AXIS} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={118}
                  tick={TICK}
                  tickLine={false}
                  axisLine={AXIS}
                  tickFormatter={(v: string) => truncate(v, 18)}
                  interval={0}
                />
              </>
            ) : (
              <>
                <XAxis
                  dataKey="name"
                  tick={TICK}
                  tickLine={false}
                  axisLine={AXIS}
                  tickFormatter={(v: string) => truncate(v, 14)}
                  interval={0}
                />
                <YAxis tick={TICK} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
              </>
            )}
            <Tooltip cursor={{ fill: "var(--surface-2)" }} content={(props) => <Tip {...props} format={format} />} />
            <Legend wrapperStyle={{ fontSize: 12, color: "var(--viz-ink-2)" }} />
            {series.map((item, index) => (
              <Bar
                key={item.key}
                dataKey={item.key}
                name={item.label}
                fill={item.color}
                stackId={stacked ? "all" : undefined}
                radius={
                  stacked
                    ? index === series.length - 1
                      ? horizontal
                        ? [0, 6, 6, 0]
                        : [6, 6, 0, 0]
                      : 0
                    : horizontal
                      ? [0, 5, 5, 0]
                      : [5, 5, 0, 0]
                }
                isAnimationActive
                animationDuration={700}
                maxBarSize={horizontal ? 28 : 56}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {caption && <figcaption className="chart-caption">{caption}</figcaption>}
      <TableView
        head={["Name", ...series.map((s) => s.label)]}
        rows={data.map((d) => [d.name, ...series.map((s) => format(Number(d[s.key] ?? 0)))])}
      />
    </figure>
  );
}
