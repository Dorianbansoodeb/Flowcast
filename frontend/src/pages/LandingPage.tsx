import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { tryDemo } from "../lib/tryDemo";

export function LandingPage() {
  const navigate = useNavigate();
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTryDemo = async () => {
    setLoadingDemo(true);
    setError(null);
    try {
      await tryDemo();
      navigate("/dashboard", { replace: true, state: { demo: true, setupComplete: true } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start demo");
      setLoadingDemo(false);
    }
  };

  return (
    <div className="landing">
      <nav className="landing-nav landing-nav--logo-only">
        <Link to="/" className="brand-name" style={{ fontSize: "1.5rem" }}>
          Flowcast
        </Link>
      </nav>
      <section className="landing-hero">
        <h1>See your cash runway before it runs out</h1>
        <p>
          Flowcast helps micro-businesses forecast 90-day cash flow, catch dangerous
          balance dips early, and cut unnecessary banking API spend.
        </p>
        <div className="landing-hero-cta">
          <Link to="/onboarding" state={{ fresh: true }} className="btn btn-primary">
            Get started
          </Link>
          <button
            type="button"
            className="btn btn-demo"
            onClick={handleTryDemo}
            disabled={loadingDemo}
          >
            {loadingDemo ? "Loading demo…" : "Try demo"}
          </button>
        </div>
        <p className="landing-demo-hint">
          Try demo loads sample data instantly — no signup, no bank connection.
        </p>
        {error && (
          <p className="landing-error" role="alert">
            {error}
          </p>
        )}
      </section>
      <section className="landing-features">
        <div className="card">
          <h3>Cash Flow Forecaster</h3>
          <p style={{ color: "var(--text-muted)" }}>
            90-day projections with confidence bands, runway metrics, and threshold alerts.
          </p>
        </div>
        <div className="card">
          <h3>API Cost Optimizer</h3>
          <p style={{ color: "var(--text-muted)" }}>
            Track Plaid-style API usage, spot expensive patterns, and estimate savings.
          </p>
        </div>
        <div className="card">
          <h3>Built for micro-business</h3>
          <p style={{ color: "var(--text-muted)" }}>
            Sandbox data today — ready for Plaid, Prophet, and email/SMS alerts tomorrow.
          </p>
        </div>
      </section>
    </div>
  );
}
