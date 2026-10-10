import { Link } from "react-router-dom";

import { useAlertsSummary } from "../api/hooks";
import { useAuth } from "../auth/AuthProvider";
import { USE_MOCK } from "../api/client";
import { MarketNav } from "./MarketNav";
import { ThemeToggle } from "./ThemeToggle";

/** Persistent navigation on desktop; an off-canvas drawer on small screens (opened from the top bar). */
export function Sidebar({ marketId, open, onNavigate }: { marketId: number; open: boolean; onNavigate: () => void }) {
  const { user, logout } = useAuth();
  const alerts = useAlertsSummary();
  const hasMarket = Number.isInteger(marketId) && marketId > 0;
  return (
    <aside id="app-sidebar" className={open ? "sidebar is-open" : "sidebar"} aria-label="Main">
      <div className="sidebar-brand">
        <Link to="/markets" className="brand-link" onClick={onNavigate}>
          <span className="brand-mark" aria-hidden="true">
            ◫
          </span>
          <span className="brand-name">Shelf Space Spy</span>
        </Link>
        {USE_MOCK && <span className="ui-badge tone-info">Mock data</span>}
      </div>

      <nav className="sidebar-group" aria-label="Workspace" onClick={onNavigate}>
        <Link to="/markets" className="side-link">
          All markets
        </Link>
        <Link to="/markets/new" className="side-link">
          New market
        </Link>
      </nav>

      {hasMarket && (
        <div className="sidebar-group" onClick={onNavigate}>
          <p className="sidebar-heading">This market</p>
          <MarketNav id={marketId} unreadAlerts={alerts.data?.by_market[String(marketId)] ?? 0} />
        </div>
      )}

      <div className="sidebar-foot">
        <ThemeToggle />
        {user && <p className="sidebar-user">{user.name}</p>}
        <button type="button" className="button-secondary button-small" onClick={() => logout()}>
          Log out
        </button>
      </div>
    </aside>
  );
}
