import { FormEvent, useEffect, useState } from "react";

type User = { id: number; email: string; name: string };
type Market = { id: number; name: string; country: string; category: string; brand_name: string; keywords: string[]; competitors: string[] };
type ScanResponse = { scanned_at: string; keyword_count: number; products_observed: number; message: string };

const DEMO_EMAIL = "demo@shelfspacespy.com";
const DEMO_PASSWORD = "Demo@123";

async function api<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail || "Something went wrong. Please try again.");
  }
  return response.json() as Promise<T>;
}

function Login({ onAuthenticated }: { onAuthenticated: (token: string, user: User) => void }) {
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setError("");
    try {
      const result = await api<{ access_token: string; user: User }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      onAuthenticated(result.access_token, result.user);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Login failed"); }
    finally { setLoading(false); }
  }

  return <main className="auth-shell"><section className="brand-panel"><p className="eyebrow">SERPAPI HACKATHON 2026</p><h1>Shelf Space<br />Spy</h1><p>AI market intelligence for small brands that refuse to fly blind.</p></section><section className="login-panel"><div className="login-card"><p className="card-label">WELCOME BACK</p><h2>Enter your market room</h2><p className="muted">Demo credentials are already filled in.</p><form onSubmit={submit}><label>Email<input value={email} type="email" onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input value={password} type="password" onChange={(event) => setPassword(event.target.value)} /></label>{error && <p className="error">{error}</p>}<button disabled={loading}>{loading ? "Signing in…" : "Sign in to Shelf Space Spy"}</button></form><p className="hint">JWT bearer authentication · no cookies</p></div></section></main>;
}

function Dashboard({ token, user, onLogout }: { token: string; user: User; onLogout: () => void }) {
  const [market, setMarket] = useState<Market | null>(null);
  const [error, setError] = useState("");
  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => { api<Market[]>("/markets", {}, token).then((markets) => setMarket(markets[0] ?? null)).catch((requestError) => setError(requestError.message)); }, [token]);
  async function runScan() {
    if (!market) return;
    setScanning(true); setError("");
    try { setScan(await api<ScanResponse>(`/markets/${market.id}/scan`, { method: "POST" }, token)); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Scan failed"); }
    finally { setScanning(false); }
  }
  return <main className="dashboard"><header><div><p className="eyebrow">SHELF SPACE SPY</p><h2>{market?.name ?? "Loading market…"}</h2></div><div className="user-actions"><span>{user.name}</span><button className="text-button" onClick={onLogout}>Log out</button></div></header><section className="intro"><div><p className="card-label">LIVE MARKET SENSOR</p><h1>What moved in your market?</h1><p>Run a live Google Shopping scan through SerpAPI. We’ll save this snapshot to power competitive intelligence.</p></div><button className="primary-action" onClick={runScan} disabled={!market || scanning}>{scanning ? "Scanning Google Shopping…" : "Run live SerpAPI scan"}</button></section>{error && <p className="error notice">{error}</p>}{scan && <section className="success notice"><strong>Live scan complete.</strong> {scan.products_observed} products observed across {scan.keyword_count} market probes at {new Date(scan.scanned_at).toLocaleTimeString()}.</section>}<section className="metrics"><article><span>YOUR BRAND</span><strong>{market?.brand_name ?? "—"}</strong></article><article><span>MARKET PROBES</span><strong>{market?.keywords.length ?? "—"}</strong></article><article><span>COMPETITORS</span><strong>{market?.competitors.length ?? "—"}</strong></article></section><section className="grid"><article className="panel"><p className="card-label">TRACKED QUERIES</p><h3>Market probes</h3><div className="chips">{market?.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div></article><article className="panel"><p className="card-label">OBSERVED RIVALS</p><h3>Competitive shelf</h3><ul>{market?.competitors.map((competitor) => <li key={competitor}>{competitor}</li>)}</ul></article><article className="panel upcoming"><p className="card-label">NEXT SIGNAL</p><h3>Demand × supply</h3><p>Google Trends and opportunity scoring come next, using the snapshots collected here.</p></article></section></main>;
}

export default function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem("shelf-space-spy-token"));
  const [user, setUser] = useState<User | null>(() => { const saved = sessionStorage.getItem("shelf-space-spy-user"); return saved ? JSON.parse(saved) as User : null; });
  function onAuthenticated(nextToken: string, nextUser: User) { sessionStorage.setItem("shelf-space-spy-token", nextToken); sessionStorage.setItem("shelf-space-spy-user", JSON.stringify(nextUser)); setToken(nextToken); setUser(nextUser); }
  function onLogout() { sessionStorage.clear(); setToken(null); setUser(null); }
  return token && user ? <Dashboard token={token} user={user} onLogout={onLogout} /> : <Login onAuthenticated={onAuthenticated} />;
}
