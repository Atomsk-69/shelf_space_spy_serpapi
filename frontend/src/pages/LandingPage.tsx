import { useEffect, useState } from "react";

import { useMarkets } from "../api/hooks";
import { useAuth } from "../auth/AuthProvider";
import { About, AddMarket, Footer, Hero, MarketsSection, Offer } from "../components/landing/sections";
import { useScrollProgress } from "../components/landing/motion";
import { isVisibleLine } from "../lib/text";
import "./landing.css";

function NavBar() {
  const { user, logout } = useAuth();
  const [solid, setSolid] = useState(false);
  const progress = useScrollProgress();
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <>
      <div className="scroll-progress" style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />
      <nav className={solid ? "landing-nav is-solid" : "landing-nav"} aria-label="Page">
        <a href="#top" className="nav-brand">
          <span className="brand-mark" aria-hidden="true">
            ◫
          </span>
          <span>Shelf Space Spy</span>
        </a>
        <div className="nav-links">
          <a href="#about">About</a>
          <a href="#offer">What we offer</a>
          <a href="#markets">Your markets</a>
          <a href="#add">Add a market</a>
        </div>
        <div className="nav-actions">
          {user && isVisibleLine(user.name) && <span className="nav-user">{user.name}</span>}
          <button type="button" className="cta cta-ghost cta-small" onClick={() => logout()}>
            Log out
          </button>
        </div>
      </nav>
    </>
  );
}

/** The single home page after login: hero, about, what we offer, your markets, add a market, footer. */
export default function LandingPage() {
  const markets = useMarkets();
  useEffect(() => {
    const html = document.documentElement;
    const previous = html.style.scrollBehavior;
    html.style.scrollBehavior = "smooth";
    return () => {
      html.style.scrollBehavior = previous;
    };
  }, []);
  return (
    <div className="landing">
      <a className="skip-link" href="#markets">
        Skip to your markets
      </a>
      <NavBar />
      <main>
        <Hero markets={markets.data} />
        <About />
        <Offer />
        <MarketsSection markets={markets.data} error={markets.error} loading={markets.isPending} onRetry={() => void markets.refetch()} />
        <AddMarket />
      </main>
      <Footer />
    </div>
  );
}
