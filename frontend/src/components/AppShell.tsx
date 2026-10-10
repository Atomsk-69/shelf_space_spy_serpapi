import { Link, NavLink, Outlet } from "react-router-dom";

import { USE_MOCK } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { MarketSwitcher } from "./MarketSwitcher";
import { ThemeToggle } from "./ThemeToggle";

export function AppShell() {
  const { user, logout } = useAuth();
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="app-header">
        <div className="app-brand">
          <Link to="/markets" className="brand-link"><span className="eyebrow">SHELF SPACE SPY</span></Link>
          {USE_MOCK && <span className="badge badge-mock" title="VITE_USE_MOCK=1: all data comes from src/api/mock.ts">Mock data</span>}
        </div>
        <MarketSwitcher />
        <nav className="user-actions" aria-label="Account">
          <NavLink to="/markets/new" className="nav-link" end>New market</NavLink>
          <ThemeToggle />
          {user && <span className="user-name">{user.name}</span>}
          <button type="button" className="text-button" onClick={() => logout()}>Log out</button>
        </nav>
      </header>
      <main id="main" className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
