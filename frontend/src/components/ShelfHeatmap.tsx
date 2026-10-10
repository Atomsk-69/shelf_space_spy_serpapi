import type { HeatmapModel } from "../lib/shelf";
import { formatPct } from "../lib/format";
import { UnstableBadge } from "./ui/Badge";

/** Brand x probe grid of observed visibility. Every cell prints its number; color only adds emphasis. */
export function ShelfHeatmap({ model, stability }: { model: HeatmapModel; stability: Record<string, number | null> }) {
  return (
    <figure className="chart-figure">
      <div className="table-scroll heatmap-scroll">
        <table className="heatmap" aria-label="Observed visibility share by brand and probe">
          <thead>
            <tr>
              <th scope="col">Brand</th>
              {model.probes.map((probe) => {
                const overlap = stability[probe.toLowerCase()];
                return (
                  <th key={probe} scope="col" className="num">
                    <span className="heatmap-probe">{probe}</span>
                    {overlap !== null && overlap !== undefined && overlap < 0.3 && <UnstableBadge overlap={overlap} />}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {model.rows.map((row) => (
              <tr key={row.brand} className={row.isMine ? "is-mine" : undefined}>
                <th scope="row">
                  {row.brand}
                  {row.isMine && <span className="chip-tag">you</span>}
                </th>
                {row.cells.map((value, index) => (
                  <td
                    key={model.probes[index]}
                    className="num heat-cell"
                    style={
                      value === null
                        ? undefined
                        : { background: `color-mix(in srgb, var(--viz-mine) ${Math.round((value / model.max) * 70) + 8}%, transparent)` }
                    }
                    title={
                      value === null
                        ? `${row.brand} is not among the brands listed for "${model.probes[index]}"`
                        : `${row.brand}: ${formatPct(value)} of visible shelf for "${model.probes[index]}"`
                    }
                  >
                    {value === null ? "—" : formatPct(value)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="chart-caption">
        Darker = more of the visible positions. A dash means the brand is not among the largest brands listed for that probe, not that it
        has 0%.
        {model.truncated ? " Smaller brands are not shown." : ""}
      </figcaption>
    </figure>
  );
}
