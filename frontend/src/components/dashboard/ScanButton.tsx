import { useState } from "react";

import { USE_MOCK } from "../../api/client";
import type { Market } from "../../types";
import { ConfirmDialog } from "../ConfirmDialog";

// Google Trends takes up to 5 keywords per request.
const TRENDS_BATCH = 5;

export function ScanButton({ market, pending, onConfirm }: { market: Market | undefined; pending: boolean; onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  const probes = market?.keywords.length ?? 0;
  const trends = Math.ceil(probes / TRENDS_BATCH);
  return (
    <>
      <button
        type="button"
        className="primary-action"
        onClick={() => setOpen(true)}
        disabled={!market || pending || probes === 0}
        aria-busy={pending}
      >
        {pending ? "Scan in progress…" : "Run live scan"}
      </button>
      <ConfirmDialog
        open={open}
        title="Run a live scan?"
        confirmLabel="Scan now"
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
            {probes} Shopping search{probes === 1 ? "" : "es"} (one per probe)
          </li>
          <li>
            {trends} Trends request{trends === 1 ? "" : "s"} (up to {TRENDS_BATCH} probes each)
          </li>
        </ul>
        <p className="muted-ink">
          Recently cached results may be reused, and the server may refuse a scan that runs too soon after the last one.
        </p>
        {USE_MOCK && <p className="notice notice-info">Mock mode (VITE_USE_MOCK=1): no live data requests are made.</p>}
      </ConfirmDialog>
    </>
  );
}
