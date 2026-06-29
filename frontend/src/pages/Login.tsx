import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/client";
import { Brand } from "../components/Brand";

const DEMO = [
  { label: "Applicant", email: "applicant@demo.test" },
  { label: "Reviewer", email: "reviewer@demo.test" },
];

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("applicant@demo.test");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      {/* Left: brand + form */}
      <div className="login-panel">
        <header className="login-top">
          <Brand size={40} />
          <span className="login-locale">EN عربي</span>
        </header>

        <div className="login-body">
          <div className="login-card">
            <p className="eyebrow">Grants &amp; Community Funding</p>
            <h1>Welcome back</h1>
            <p className="login-sub">
              Sign in to apply for funding and follow every step of your application.
            </p>

            <form onSubmit={onSubmit} className="login-form">
              <label>
                Email address
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="you@example.org"
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                Password
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </label>
              {error && <p className="error">{error}</p>}
              <button type="submit" className="btn-primary btn-block" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <div className="login-demo">
              <span className="login-demo-label">Demo accounts · password “password123”</span>
              <div className="chips">
                {DEMO.map((d) => (
                  <button key={d.email} type="button" className="chip" onClick={() => setEmail(d.email)}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="login-partners">
              <span className="login-partners-label">Trusted by a growing community of changemakers</span>
              <div className="partner-logos">
                <div className="partner-logo">
                  <img src="/img/partners/soul-diamonds.jpg" alt="Soul Diamonds" />
                </div>
                <div className="partner-logo">
                  <img src="/img/partners/charity.jpg" alt="Charity partner" />
                </div>
                <div className="partner-logo">
                  <img src="/img/partners/crest.jpg" alt="Partner foundation" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="login-foot">
          © {new Date().getFullYear()} The Demo Foundation · Empowering communities through funding
        </footer>
      </div>

      {/* Right: inset hero with floating proof cards */}
      <aside className="login-visual">
        <div className="login-visual-img" role="img" aria-label="A child smiling in a community project">
          <div className="login-visual-overlay" />
          <span className="login-cap">Grants open · 2026</span>
          <div className="login-visual-cap">
            <h2>Every great change begins with a single grant.</h2>
          </div>
        </div>

        <figure className="float float-quote">
          <img src="/img/child-portrait.jpg" alt="" />
          <figcaption>
            <p>“This grant rebuilt our community library.”</p>
            <cite>Naledi — Project Lead</cite>
          </figcaption>
        </figure>

        <div className="float float-stat">
          <strong>1,200+</strong>
          <span>projects funded across 38 communities</span>
        </div>
      </aside>
    </div>
  );
}
