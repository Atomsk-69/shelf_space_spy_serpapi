import { Link } from "react-router-dom";

import { useDashboard, useMarket } from "../api/hooks";
import type { ScanController } from "../hooks/useScanController";
import { formatRelativeTime } from "../lib/format";
import { progressPercent } from "../lib/scanJob";
import { AlertBell } from "./AlertBell";
import { MarketSwitcher } from "./MarketSwitcher";
import { ScanButton } from "./dashboard/ScanButton";

/** Compact status of the latest scan: running progress, or how fresh the stored data is. */
function ScanStatus({ marketId, scan }: { marketId: number; scan: ScanController }) {
  const dashboard = useDashboard(marketId);
  const job = scan.job;
  if (scan.active && job) {
    const percent = progressPercent(job);
    return (
      <span className="scan-status is-active" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        Scanning{percent !== null ? ` ${percent}%` : "…"}
      </span>
    );
  }
  if (job?.status === "failed" && scan.dismissedJob !== job.id) {
    return (
      <span className="scan-status is-failed" role="status">
        Last scan failed
      </span>
    );
  }
  const latest = dashboard.data?.latest_scan_at;
  return (
    <span className="scan-status" title="When the stored data was last collected">
      {latest ? `Data from ${formatRelativeTime(latest)}` : dashboard.isPending ? "…" : "No scans yet"}
    </span>
  );
}

export function TopBar({
  marketId,
  scan,
  onMenu,
  menuOpen,
}: {
  marketId: number;
  scan: ScanController;
  onMenu: () => void;
  menuOpen: boolean;
}) {
  const hasMarket = Number.isInteger(marketId) && marketId > 0;
  const market = useMarket(marketId);
  const credits = scan.credits;
  return (
    <header className="topbar">
      <button
        type="button"
        className="menu-button button-secondary"
        aria-label="Menu"
        aria-expanded={menuOpen}
        aria-controls="app-sidebar"
        onClick={onMenu}
      >
        ☰
      </button>
      <MarketSwitcher />
      <div className="topbar-right">
        {hasMarket && <ScanStatus marketId={marketId} scan={scan} />}
        {hasMarket && credits && credits.daily_budget > 0 && (
          <span className="credit-pill" title="Live SerpAPI credits used today (UTC) of the daily budget">
            {credits.credits_used_today}/{credits.daily_budget} credits
          </span>
        )}
        <AlertBell />
        {hasMarket ? (
          <ScanButton market={market.data} pending={scan.busy} onConfirm={scan.run} budget={credits} />
        ) : (
          <Link to="/markets/new" className="button-link topbar-cta">
            New market
          </Link>
        )}
      </div>
    </header>
  );
}
