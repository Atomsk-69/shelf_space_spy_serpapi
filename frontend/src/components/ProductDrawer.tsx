import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useProduct } from "../api/hooks";
import type { ObservationRow } from "../types";
import { DASH, formatDateTime, formatInt, formatPrice } from "../lib/format";
import { Loading, QueryBody } from "./states";
import { Badge, DemoBadge, InferredBadge } from "./ui/Badge";
import { Drawer } from "./ui/Drawer";

const TICK = { fill: "var(--viz-muted)", fontSize: 11 };
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

function MiniChart({
  title,
  data,
  dataKey,
  reversed,
  format,
}: {
  title: string;
  data: Record<string, unknown>[];
  dataKey: string;
  reversed?: boolean;
  format: (value: number) => string;
}) {
  return (
    <figure className="chart-figure">
      <figcaption className="chart-caption chart-title">{title}</figcaption>
      <div className="mini-chart" role="img" aria-label={`${title} across ${data.length} scans`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
            <XAxis dataKey="date" tick={TICK} tickLine={false} axisLine={{ stroke: "var(--viz-baseline)" }} minTickGap={24} />
            <YAxis
              tick={TICK}
              tickLine={false}
              axisLine={false}
              width={46}
              reversed={reversed}
              domain={["auto", "auto"]}
              tickFormatter={(v: number) => format(v)}
            />
            <Tooltip formatter={(value) => format(Number(value))} labelFormatter={(label) => String(label)} />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke="var(--viz-mine)"
              strokeWidth={2}
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

/** One canonical product across scans: position and price over time, plus every scan as a table. */
export function ProductDrawer({
  marketId,
  row,
  country,
  onClose,
}: {
  marketId: number;
  row: ObservationRow | null;
  country: string;
  onClose: () => void;
}) {
  const product = useProduct(marketId, row?.product_row_id ?? null);
  return (
    <Drawer
      open={row !== null}
      title={row?.title ?? "Product"}
      subtitle={row?.source ? `Seen at ${row.source}` : undefined}
      onClose={onClose}
    >
      {row && (
        <div className="badge-row">
          <Badge tone="neutral">{row.brand ?? "Unbranded"}</Badge>
          {row.brand_inferred && <InferredBadge />}
        </div>
      )}
      <QueryBody query={product} loading={<Loading rows={5} />} errorTitle="Couldn't load this product">
        {(value) => {
          const points = value.history.map((point) => ({ ...point, date: shortDate(point.scanned_at) }));
          return (
            <>
              <p className="drawer-text muted-ink">
                First seen {formatDateTime(value.product.first_seen_at)} · {formatInt(value.listings_stored)} stored listing
                {value.listings_stored === 1 ? "" : "s"}. Position and price are per scan: the best shelf position and the lowest price
                seen.
              </p>
              {points.length >= 2 ? (
                <>
                  <MiniChart
                    title="Best shelf position (lower is better)"
                    data={points}
                    dataKey="best_position"
                    reversed
                    format={(v) => `#${Math.round(v)}`}
                  />
                  {points.some((p) => p.lowest_price !== null) && (
                    <MiniChart title="Lowest price" data={points} dataKey="lowest_price" format={(v) => formatPrice(v, country)} />
                  )}
                </>
              ) : (
                <p className="notice notice-info">Only one scan has seen this product, so there is no history to chart yet.</p>
              )}
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Scan</th>
                      <th className="num">Position</th>
                      <th className="num">Price</th>
                      <th>Retailers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {value.history.map((point) => (
                      <tr key={point.scan_id}>
                        <td>
                          {formatDateTime(point.scanned_at)} {point.is_demo && <DemoBadge label="Demo" />}
                        </td>
                        <td className="num">{point.best_position ?? DASH}</td>
                        <td className="num">{point.lowest_price === null ? DASH : formatPrice(point.lowest_price, country)}</td>
                        <td>{point.retailers.join(", ") || DASH}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          );
        }}
      </QueryBody>
    </Drawer>
  );
}
