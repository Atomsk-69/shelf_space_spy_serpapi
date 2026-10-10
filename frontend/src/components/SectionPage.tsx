import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { useMarket } from "../api/hooks";
import { isNotFound } from "../api/errors";
import { formatRelativeTime } from "../lib/format";
import type { ScanRef } from "../types";
import { EmptyState } from "./states";

/** Shared frame for the section pages: market context, what the data is based on, one not-found state. */
export function SectionPage({
  id,
  label,
  title,
  intro,
  scan,
  children,
}: {
  id: number;
  label: string;
  title: string;
  intro: ReactNode;
  scan?: ScanRef | null;
  children: ReactNode;
}) {
  const market = useMarket(id);
  if (!Number.isInteger(id) || id <= 0 || isNotFound(market.error)) {
    return (
      <EmptyState
        title="Market not found"
        hint="It may have been deleted, or it belongs to another account."
        action={
          <Link to="/markets" className="button-link">
            Back to your markets
          </Link>
        }
      />
    );
  }
  return (
    <>
      <section className="page-intro section-intro">
        <div>
          <p className="card-label">
            {label}
            {market.data ? ` · ${market.data.name}` : ""}
          </p>
          <h1 className="page-title">{title}</h1>
          <p className="lede">{intro}</p>
          {scan && (
            <p className="section-meta">
              Based on the scan from {formatRelativeTime(scan.scanned_at)}
              {scan.is_demo && (
                <span className="badge badge-demo" title="This scan was generated from a real one to demonstrate history.">
                  Demo data
                </span>
              )}
            </p>
          )}
        </div>
      </section>
      {children}
    </>
  );
}

export function Pager({
  total,
  limit,
  offset,
  onChange,
}: {
  total: number;
  limit: number;
  offset: number;
  onChange: (offset: number) => void;
}) {
  if (total <= limit) return null;
  const from = offset + 1;
  const to = Math.min(offset + limit, total);
  return (
    <nav className="pager" aria-label="Pages">
      <button
        type="button"
        className="button-secondary button-small"
        disabled={offset === 0}
        onClick={() => onChange(Math.max(0, offset - limit))}
      >
        Previous
      </button>
      <span>
        {from}–{to} of {total}
      </span>
      <button
        type="button"
        className="button-secondary button-small"
        disabled={offset + limit >= total}
        onClick={() => onChange(offset + limit)}
      >
        Next
      </button>
    </nav>
  );
}
