import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { USE_MOCK } from "../api/client";
import { login as loginRequest } from "../api/endpoints";
import { errorMessage } from "../api/errors";
import { useAuth } from "../auth/AuthProvider";

const DEMO_EMAIL = "demo@shelfspacespy.com";
const DEMO_PASSWORD = "Demo@123";

function redirectTarget(state: unknown): string {
  const from = (state as { from?: unknown } | null)?.from;
  return typeof from === "string" && from.startsWith("/") && from !== "/login" ? from : "/markets";
}

export default function LoginPage() {
  const { token, login, notice } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (token) return <Navigate to={redirectTarget(location.state)} replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await loginRequest(email, password);
      // The token change re-renders this page into <Navigate> to the original target.
      login(result.access_token, result.user);
    } catch (requestError) {
      setError(errorMessage(requestError, "Login failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="brand-panel">
        <p className="eyebrow">SERPAPI HACKATHON 2026</p>
        <h1>
          Shelf Space
          <br />
          Spy
        </h1>
        <p>AI market intelligence for small brands that refuse to fly blind.</p>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <p className="card-label">WELCOME BACK</p>
          <h2>Enter your market room</h2>
          <p className="muted">Demo credentials are already filled in.</p>
          {notice && (
            <p className="notice notice-info" role="status">
              {notice}
            </p>
          )}
          <form onSubmit={submit}>
            <label>
              Email
              <input value={email} type="email" autoComplete="username" required onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label>
              Password
              <input
                value={password}
                type="password"
                autoComplete="current-password"
                required
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button disabled={loading} aria-busy={loading}>
              {loading ? "Signing in…" : "Sign in to Shelf Space Spy"}
            </button>
          </form>
          <p className="hint">JWT bearer authentication · no cookies{USE_MOCK ? " · mock API (VITE_USE_MOCK=1)" : ""}</p>
        </div>
      </section>
    </main>
  );
}
