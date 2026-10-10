import type { CompetitorRow } from "../../types";
import { formatDecimal, formatInt, formatPct, formatPrice } from "../../lib/format";

export function CompetitorTable({ rows, country, ownBrand }: { rows: CompetitorRow[]; country: string; ownBrand: string | null }) {
  const own = ownBrand?.trim().toLowerCase();
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Brand</th>
            <th scope="col" className="num">
              New SKUs
            </th>
            <th scope="col" className="num">
              Median price
            </th>
            <th scope="col" className="num">
              Discount rate
            </th>
            <th scope="col" className="num" title="Average shelf position; lower is better">
              Avg rank
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isOwn = row.is_mine || (own !== undefined && own !== "" && row.brand.trim().toLowerCase() === own);
            return (
              <tr key={row.brand} className={isOwn ? "is-mine" : undefined}>
                <th scope="row">
                  {row.brand}
                  {isOwn && <span className="chip-tag">you</span>}
                </th>
                <td className="num">{formatInt(row.new_products)}</td>
                <td className="num">{formatPrice(row.median_price, country)}</td>
                <td className="num">{formatPct(row.discount_rate_pct)}</td>
                <td className="num">{row.avg_position == null ? "—" : `#${formatDecimal(row.avg_position)}`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
