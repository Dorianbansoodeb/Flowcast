import { Link } from "react-router-dom";

export function LandingPage() {
  return (
    <div className="landing">
      <nav className="landing-nav">
        <Link to="/" className="brand-name" style={{ fontSize: "1.5rem" }}>
          Flowcast
        </Link>
        <Link to="/dashboard" className="btn btn-primary">
          Open dashboard
        </Link>
      </nav>
      <section className="landing-hero">
        <h1>See your cash runway before it runs out</h1>
        <p>
          Flowcast helps micro-businesses forecast 90-day cash flow, catch dangerous
          balance dips early, and cut unnecessary banking API spend.
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/dashboard" className="btn btn-primary">
            Get started
          </Link>
          <Link to="/forecast" className="btn">
            View forecast demo
          </Link>
        </div>
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
