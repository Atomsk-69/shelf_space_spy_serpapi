import { useState } from "react";
import { Link } from "react-router-dom";

import type { Market } from "../../types";
import { countryLabel } from "../../lib/format";
import { NewMarketForm } from "../NewMarketForm";
import { EmptyState, ErrorState } from "../states";
import { CountUp, Reveal, WordReveal } from "./motion";

/** Abstract, decorative shelf-and-trend art. It shows no data and carries no numbers. */
function HeroArt() {
  const bars = [46, 72, 38, 88, 60, 98, 52, 80, 66];
  return (
    <div className="hero-art" aria-hidden="true">
      <div className="art-glass">
        <svg viewBox="0 0 360 220" className="art-svg" role="presentation">
          <defs>
            <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c8f59f" />
              <stop offset="100%" stopColor="#3f8a2c" />
            </linearGradient>
            <linearGradient id="lineFill" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#7fd1ff" />
              <stop offset="100%" stopColor="#f6e27a" />
            </linearGradient>
          </defs>
          {[40, 90, 140, 190].map((y) => (
            <line key={y} x1="10" x2="350" y1={y} y2={y} className="art-grid" />
          ))}
          {bars.map((height, index) => (
            <rect
              key={index}
              x={20 + index * 36}
              y={200 - height * 1.7}
              width="22"
              height={height * 1.7}
              rx="5"
              fill="url(#barFill)"
              className="art-bar"
              style={{ animationDelay: `${0.5 + index * 0.1}s` }}
            />
          ))}
          <path
            d="M16 150 C 70 120, 100 170, 150 110 S 240 60, 300 70 S 340 40, 350 30"
            fill="none"
            stroke="url(#lineFill)"
            strokeWidth="3.5"
            strokeLinecap="round"
            className="art-line"
          />
          <circle r="6" fill="#f6e27a" className="art-dot">
            <animateMotion dur="5s" repeatCount="indefinite" path="M16 150 C 70 120, 100 170, 150 110 S 240 60, 300 70 S 340 40, 350 30" />
          </circle>
        </svg>
      </div>
      <span className="orb orb-a" />
      <span className="orb orb-b" />
    </div>
  );
}

export function Hero({ markets }: { markets: Market[] | undefined }) {
  const probes = markets?.reduce((sum, market) => sum + market.keywords.length, 0);
  const competitors = markets?.reduce((sum, market) => sum + market.competitors.length, 0);
  return (
    <header className="hero" id="top">
      <div className="aurora" aria-hidden="true">
        <span className="blob blob-1" />
        <span className="blob blob-2" />
        <span className="blob blob-3" />
        <span className="hero-grid" />
        <span className="grain" />
      </div>
      <div className="hero-inner">
        <div className="hero-copy">
          <p className="hero-kicker rise" style={{ "--i": 0 } as React.CSSProperties}>
            <span className="pulse-dot" /> MARKET INTELLIGENCE FOR SMALL BRANDS
          </p>
          <h1 className="hero-title">
            <WordReveal text="See the shelf" start={1} />
            <br />
            <WordReveal text="before your competitors do." className="grad" start={4} />
          </h1>
          <p className="hero-lede rise" style={{ "--i": 8 } as React.CSSProperties}>
            Shelf Space Spy watches Google Shopping and Google Trends, remembers every change, and shows where search demand is outrunning
            the shelf.
          </p>
          <div className="hero-cta rise" style={{ "--i": 10 } as React.CSSProperties}>
            <a href="#markets" className="cta cta-primary">
              Open your markets
            </a>
            <a href="#add" className="cta cta-ghost">
              Add a market
            </a>
          </div>
          <dl className="hero-stats rise" style={{ "--i": 12 } as React.CSSProperties}>
            <div>
              <dt>Markets watched</dt>
              <dd>{markets ? <CountUp value={markets.length} /> : "—"}</dd>
            </div>
            <div>
              <dt>Search probes</dt>
              <dd>{probes !== undefined ? <CountUp value={probes} /> : "—"}</dd>
            </div>
            <div>
              <dt>Competitors tracked</dt>
              <dd>{competitors !== undefined ? <CountUp value={competitors} /> : "—"}</dd>
            </div>
          </dl>
        </div>
        <HeroArt />
      </div>
      <a href="#about" className="scroll-cue" aria-label="Scroll to learn more">
        <span className="mouse">
          <span className="wheel" />
        </span>
      </a>
    </header>
  );
}

const LOOP = [
  {
    step: "Observe",
    text: "Each scan samples what Google Shopping shows for your search phrases, and what shoppers are searching for on Google Trends.",
  },
  { step: "Remember", text: "Every scan is stored, so the shelf has a history instead of a single snapshot." },
  {
    step: "Detect",
    text: "New products, price moves, discounts, rank changes and products leaving the shelf, each with its own confidence.",
  },
  {
    step: "Understand",
    text: "Demand, shelf visibility, supply and pricing are scored per search phrase to show where demand outruns the shelf.",
  },
  { step: "Advise", text: "Recommended actions and a short weekly brief, always tied to the numbers behind them." },
  { step: "Act", text: "Alerts on the changes that matter, and a replay of any past scan." },
];

export function About() {
  return (
    <section className="section about" id="about">
      <div className="section-inner about-grid">
        <Reveal className="about-copy">
          <p className="section-kicker">ABOUT</p>
          <h2 className="section-title">A market is more than a snapshot.</h2>
          <p>
            Small brands rarely have time to watch a crowded marketplace. Pick a category and a country, add a few search phrases and the
            competitors you care about, and Shelf Space Spy keeps an eye on the shelf for you.
          </p>
          <p>
            It is built on a simple rule: the data is collected and calculated by code, the results are explained with their evidence, and
            the writer that summarizes them is never allowed to make up a number.
          </p>
          <p className="fine-print">
            Google Shopping and Trends show what is visible and searched, not sales or profit. Everything here is a signal to investigate,
            not a guarantee.
          </p>
        </Reveal>
        <ol className="loop">
          {LOOP.map((item, index) => (
            <Reveal key={item.step} as="li" delay={index} className="loop-step">
              <span className="loop-num">{index + 1}</span>
              <div>
                <h3>{item.step}</h3>
                <p>{item.text}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

const OFFER = [
  { icon: "◫", title: "Overview", text: "One glance at demand, supply, the strongest signals and the latest changes." },
  { icon: "↯", title: "Changes", text: "A timeline of price, rank, new-product and removal events, each with evidence and confidence." },
  { icon: "▦", title: "Scanner", text: "Every listing from the latest scan, searchable, with each product's history." },
  { icon: "∿", title: "Demand", text: "Google Trends per search phrase, comparing the last four complete weeks with the eight before." },
  { icon: "▤", title: "Shelf", text: "Who holds the visible shelf, brand by search phrase, plus supply and price bands." },
  { icon: "✦", title: "Opportunities", text: "Where demand outruns the shelf, scored 0-100 with confidence kept separate." },
  { icon: "➜", title: "Recommended actions", text: "What to investigate next, with the evidence, limits and a suggested action for each." },
  { icon: "✎", title: "Weekly brief", text: "A short narrative written only from the stored numbers, checked before it is shown." },
  { icon: "◔", title: "Alerts", text: "Notified when a trusted change matches a rule you control." },
  { icon: "↺", title: "Replay", text: "Step back through stored scans to see how the shelf looked at any point." },
];

export function Offer() {
  return (
    <section className="section offer" id="offer">
      <div className="section-inner">
        <Reveal className="section-head">
          <p className="section-kicker">WHAT WE OFFER</p>
          <h2 className="section-title">Everything you need to read a market.</h2>
        </Reveal>
        <ul className="offer-grid">
          {OFFER.map((item, index) => (
            <Reveal key={item.title} as="li" delay={index % 5} className="offer-card">
              <span className="offer-icon" aria-hidden="true">
                {item.icon}
              </span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function MarketsSection({
  markets,
  error,
  loading,
  onRetry,
}: {
  markets: Market[] | undefined;
  error: unknown;
  loading: boolean;
  onRetry: () => void;
}) {
  return (
    <section className="section markets" id="markets">
      <div className="section-inner">
        <Reveal className="section-head">
          <p className="section-kicker">YOUR MARKETS</p>
          <h2 className="section-title">Pick a shelf to watch.</h2>
          <p className="section-sub">Open a market to see its dashboard.</p>
        </Reveal>
        {error != null && markets === undefined && <ErrorState error={error} title="Couldn't load your markets" onRetry={onRetry} />}
        {loading && (
          <ul className="market-cards" aria-label="Loading markets">
            {[0, 1, 2].map((key) => (
              <li key={key} className="market-tile skeleton-tile">
                <div className="skeleton skeleton-line" style={{ width: "40%" }} />
                <div className="skeleton skeleton-line skeleton-tall" style={{ width: "70%" }} />
              </li>
            ))}
          </ul>
        )}
        {markets?.length === 0 && (
          <EmptyState
            title="No markets yet"
            hint="Add your first market below. It only takes a category and a country."
            action={
              <a href="#add" className="cta cta-primary">
                Add a market
              </a>
            }
          />
        )}
        {markets && markets.length > 0 && (
          <ul className="market-cards">
            {markets.map((market, index) => (
              <Reveal key={market.id} as="li" delay={index % 4}>
                <Link to={`/markets/${market.id}`} className="market-tile market-card">
                  <p className="tile-kicker">
                    {market.category} · {countryLabel(market.country)}
                  </p>
                  <h3>{market.name}</h3>
                  <dl className="tile-facts">
                    <div>
                      <dt>Your brand</dt>
                      <dd>{market.brand_name || "Research only"}</dd>
                    </div>
                    <div>
                      <dt>Probes</dt>
                      <dd>{market.keywords.length}</dd>
                    </div>
                    <div>
                      <dt>Competitors</dt>
                      <dd>{market.competitors.length}</dd>
                    </div>
                  </dl>
                  <span className="tile-cta">
                    Open dashboard <span aria-hidden="true">→</span>
                  </span>
                </Link>
              </Reveal>
            ))}
            <Reveal as="li" delay={markets.length % 4}>
              <a href="#add" className="market-tile tile-add">
                <span className="plus" aria-hidden="true">
                  +
                </span>
                <span>Add a market</span>
              </a>
            </Reveal>
          </ul>
        )}
      </div>
    </section>
  );
}

export function AddMarket() {
  const [open, setOpen] = useState(false);
  return (
    <section className="section add" id="add">
      <div className="section-inner add-inner">
        <Reveal className="section-head">
          <p className="section-kicker">ADD A MARKET</p>
          <h2 className="section-title">Start watching a new shelf.</h2>
          <p className="section-sub">
            Type any category and a country. We propose search phrases and competitor brands from live shopping data, and you decide what to
            keep.
          </p>
        </Reveal>
        <Reveal delay={1}>
          {!open ? (
            <button type="button" className="cta cta-primary cta-wide" onClick={() => setOpen(true)} aria-expanded={false}>
              Start a new market
            </button>
          ) : (
            <div className="add-form" role="region" aria-label="Add a new market">
              <NewMarketForm />
            </div>
          )}
        </Reveal>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="landing-footer">
      <div className="section-inner footer-grid">
        <div>
          <p className="footer-brand">
            <span className="brand-mark" aria-hidden="true">
              ◫
            </span>{" "}
            Shelf Space Spy
          </p>
          <p className="footer-text">See the shelf before your competitors do.</p>
        </div>
        <nav aria-label="Footer" className="footer-links">
          <a href="#about">About</a>
          <a href="#offer">What we offer</a>
          <a href="#markets">Your markets</a>
          <a href="#add">Add a market</a>
        </nav>
        <p className="footer-text small">
          Built on Google Shopping and Google Trends results. They show what is visible and searched, not sales. Treat every finding as
          something to investigate.
        </p>
      </div>
      <p className="footer-copy">© {new Date().getFullYear()} Shelf Space Spy</p>
    </footer>
  );
}
