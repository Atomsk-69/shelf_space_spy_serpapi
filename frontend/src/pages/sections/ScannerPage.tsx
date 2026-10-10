import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { useMarket, useObservations } from "../../api/hooks";
import { Panel } from "../../components/Panel";
import { ProductDrawer } from "../../components/ProductDrawer";
import { InferredBadge } from "../../components/ui/Badge";
import { Pager, SectionPage } from "../../components/SectionPage";
import { parseMarketId } from "../../lib/ids";
import { EmptyState, Loading, QueryBody } from "../../components/states";
import { DASH, formatInt, formatPrice } from "../../lib/format";
import type { ObservationRow, ObservationsQuery } from "../../types";

const PAGE_SIZE = 25;
const SORTS = [
  ["position", "Shelf position"],
  ["price", "Price: low to high"],
  ["price_desc", "Price: high to low"],
  ["rating", "Rating"],
  ["reviews", "Reviews"],
  ["title", "Title"],
] as const;

/** Column header that sorts through the API. Price toggles low-to-high and high-to-low. */
function SortHeader({
  label,
  sorts,
  current,
  onSort,
  num,
}: {
  label: string;
  sorts: string[];
  current: string;
  onSort: (sort: string) => void;
  num?: boolean;
}) {
  const active = sorts.includes(current);
  const next = sorts.length === 2 && current === sorts[0] ? sorts[1] : sorts[0];
  const direction = !active ? "none" : current === "price_desc" ? "descending" : "ascending";
  return (
    <th scope="col" className={num ? "num" : undefined} aria-sort={direction}>
      <button type="button" className="sort-button" onClick={() => onSort(next)}>
        {label}
        <span aria-hidden="true" className="sort-mark">
          {!active ? "↕" : current === "price_desc" ? "↓" : "↑"}
        </span>
      </button>
    </th>
  );
}

export default function ScannerPage() {
  const id = parseMarketId(useParams().id);
  const market = useMarket(id);
  const [filters, setFilters] = useState<Omit<ObservationsQuery, "limit" | "offset">>({ keyword: "", brand: "", q: "", sort: "position" });
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<ObservationRow | null>(null);
  const observations = useObservations(id, { ...filters, limit: PAGE_SIZE, offset });
  const country = market.data?.country ?? "";

  // Debounce the free-text search so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOffset(0);
      setFilters((current) => (current.q === search ? current : { ...current, q: search }));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const update = (patch: Partial<typeof filters>) => {
    setOffset(0);
    setFilters((current) => ({ ...current, ...patch }));
  };
  const data = observations.data;

  return (
    <SectionPage
      id={id}
      label="SCANNER"
      title="Every listing from the latest scan"
      intro="The raw sampled Google Shopping results, one row per listing. Open a product to see how its position and price moved across scans."
      scan={data?.scan}
    >
      <Panel label="LISTINGS" title={data?.has_data ? `${formatInt(data.total)} listing${data.total === 1 ? "" : "s"}` : "Listings"}>
        <div className="toolbar">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, brand or retailer"
            aria-label="Search listings"
          />
          <select value={filters.keyword} onChange={(event) => update({ keyword: event.target.value })} aria-label="Probe">
            <option value="">All probes</option>
            {data?.keywords.map((keyword) => (
              <option key={keyword} value={keyword}>
                {keyword}
              </option>
            ))}
          </select>
          <select value={filters.brand} onChange={(event) => update({ brand: event.target.value })} aria-label="Brand">
            <option value="">All brands</option>
            {data?.brands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>
          <select value={filters.sort} onChange={(event) => update({ sort: event.target.value })} aria-label="Sort by">
            {SORTS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <QueryBody
          query={observations}
          loading={<Loading rows={8} />}
          errorTitle="Couldn't load listings"
          isEmpty={(value) => value.items.length === 0}
          empty={
            <EmptyState
              title={data?.has_data ? "No listings match these filters" : "No scans yet"}
              hint={
                data?.has_data ? "Try clearing the search or filters." : "Run a scan from the Overview page to collect the first shelf."
              }
            />
          }
        >
          {(value) => (
            <>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <SortHeader label="#" sorts={["position"]} current={filters.sort} onSort={(sort) => update({ sort })} num />
                      <SortHeader label="Product" sorts={["title"]} current={filters.sort} onSort={(sort) => update({ sort })} />
                      <th scope="col">Brand</th>
                      <th scope="col">Retailer</th>
                      <SortHeader
                        label="Price"
                        sorts={["price", "price_desc"]}
                        current={filters.sort}
                        onSort={(sort) => update({ sort })}
                        num
                      />
                      <SortHeader label="Rating" sorts={["rating"]} current={filters.sort} onSort={(sort) => update({ sort })} num />
                      <th scope="col">Probe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {value.items.map((row) => (
                      <tr key={row.id}>
                        <td className="num">{row.position ?? DASH}</td>
                        <td className="cell-wrap">
                          {row.product_row_id !== null ? (
                            <button type="button" className="text-button link-cell" onClick={() => setSelected(row)}>
                              {row.title}
                            </button>
                          ) : (
                            row.title
                          )}
                        </td>
                        <td>
                          {row.brand ?? DASH} {row.brand_inferred && <InferredBadge />}
                        </td>
                        <td>{row.source ?? DASH}</td>
                        <td className="num">
                          {row.price === null ? DASH : formatPrice(row.price, country)}
                          {row.old_price !== null && row.price !== null && row.old_price > row.price && (
                            <span className="strike"> {formatPrice(row.old_price, country)}</span>
                          )}
                        </td>
                        <td className="num">
                          {row.rating ?? DASH}
                          {row.reviews ? ` (${formatInt(row.reviews)})` : ""}
                        </td>
                        <td>{row.keyword}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager total={value.total} limit={value.limit} offset={value.offset} onChange={setOffset} />
            </>
          )}
        </QueryBody>
      </Panel>
      <ProductDrawer marketId={id} row={selected} country={country} onClose={() => setSelected(null)} />
    </SectionPage>
  );
}
