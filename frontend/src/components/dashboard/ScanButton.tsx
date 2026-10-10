import { useState } from "react";

import { USE_MOCK } from "../../api/client";
import type { BudgetStatus, Market } from "../../types";
import { ConfirmDialog } from "../ConfirmDialog";

// Google Trends takes up to 5 keywords per request.
const TRENDS_BATCH = 5;

/** Rough SerpAPI credit estimate: one Shopping search per probe plus one Trends call per batch of 5. */
export function estimateScanCredits(keywordCount: number) {
  const shopping = keywordCount;
  const trends = Math.ceil(keywordCount / TRENDS_BATCH);
  return { shopping, trends, total: shopping + trends };
}

export function ScanButton({
  market,
  pending,
  onConfirm,
  budget,
}: {
  market: Market | undefined;
  pending: boolean;
  onConfirm: () => void;
  budget?: BudgetStatus;
}) {
  const [open, setOpen] = useState(false);
  const estimate = estimateScanCredits(market?.keywords.length ?? 0);
  return (
    <>
      <button
        type="button"
        className="primary-action"
        onClick={() => setOpen(true)}
        disabled={!market || pending || market.keywords.length === 0}
        aria-busy={pending}
      >
        {pending ? "Scan in progress…" : "Run live scan"}
      </button>
      <ConfirmDialog
        open={open}
        title="Run a live SerpAPI scan?"
        confirmLabel={`Scan now (~${estimate.total} credits)`}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          onConfirm();
        }}
      >
        <p>
          This scans <strong>{market?.name}</strong> on Google Shopping and Google Trends and saves a new snapshot.
        </p>
        <ul className="bullet-list">
          <li>
            {estimate.shopping} Shopping search{estimate.shopping === 1 ? "" : "es"} (one per probe)
          </li>
          <li>
            {estimate.trends} Trends request{estimate.trends === 1 ? "" : "s"} (up to {TRENDS_BATCH} probes each)
          </li>
        </ul>
        <p className="muted-ink">
          Estimated cost: about {estimate.total} SerpAPI credits. Cached responses cost less; the server may refuse a scan that runs too
          soon after the last one.
        </p>
        {budget && budget.daily_budget > 0 && (
          <p className={budget.budget_remaining !== null && estimate.total > budget.budget_remaining ? "notice error" : "muted-ink"}>
            Daily budget: {budget.credits_used_today} of {budget.daily_budget} credits used today
            {budget.budget_remaining !== null && estimate.total > budget.budget_remaining
              ? ". This scan may be refused unless cached responses cover it. The budget resets at midnight UTC."
              : "."}
          </p>
        )}
        {USE_MOCK && <p className="notice notice-info">Mock mode (VITE_USE_MOCK=1): no SerpAPI calls are made and no credits are used.</p>}
      </ConfirmDialog>
    </>
  );
}
