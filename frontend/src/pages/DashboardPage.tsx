import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, Forecast, AlertsResponse } from "../api/client";
import { StatCard } from "../components/StatCard";
import { RiskBadge } from "../components/RiskBadge";
import { Loading } from "../components/Loading";
import { EmptyState } from "../components/EmptyState";
import { ForecastChart } from "../charts/ForecastChart";

export function DashboardPage() {
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [alerts, setAlerts] = useState<AlertsResponse | null>(null);
  const [apiCost, setApiCost] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getForecast(), api.getAlerts(), api.getApiCostSummary()])
      .then(([f, a, s]) => {
        setForecast(f);
        setAlerts(a);
        setApiCost(s.total_cost_usd);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading message="Loading dashboard…" />;
  if (error || !forecast || !alerts)
    return (
      <EmptyState
        title="Could not load dashboard"
        description={error ?? "Unknown error"}
        action={
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Retry
          </button>
        }
      />
    );

  const riskVariant =
    alerts.overall_risk === "critical"
      ? "critical"
      : alerts.overall_risk === "warning"
        ? "warning"
        : "safe";

  return (
    <>
      <header className="page-header">
        <h1>Dashboard</h1>
        <p>Your financial pulse — balance, runway, and risk at a glance.</p>
      </header>

      <div className="card-grid cols-4" style={{ marginBottom: "1.5rem" }}>
        <StatCard
          label="Current balance"
          value={`$${forecast.current_balance.toLocaleString()}`}
        />
        <StatCard
          label="Income (30d)"
          value={`$${forecast.income_30d.toLocaleString()}`}
          variant="safe"
        />
        <StatCard
          label="Expenses (30d)"
          value={`$${forecast.expenses_30d.toLocaleString()}`}
          variant="critical"
        />
        <StatCard
          label="Cash flow risk"
          value={<RiskBadge level={alerts.overall_risk} />}
          variant={riskVariant}
          sub={`${forecast.projected_runway_days}+ day runway`}
        />
      </div>

      <div className="card-grid cols-2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>90-day balance forecast</h3>
          <ForecastChart data={forecast.forecast} threshold={alerts.threshold} />
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 0 }}>
            Model: {forecast.model} ·{" "}
            <Link to="/forecast" style={{ color: "var(--accent)" }}>
              Full forecast →
            </Link>
          </p>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Active alerts</h3>
          {alerts.alerts.length === 0 ? (
            <p className="risk-safe">No warnings — cash flow looks safe.</p>
          ) : (
            <ul style={{ paddingLeft: "1.2rem", margin: 0 }}>
              {alerts.alerts.slice(0, 4).map((a, i) => (
                <li key={i} style={{ marginBottom: "0.75rem" }}>
                  <RiskBadge level={a.risk_level} />{" "}
                  <span style={{ marginLeft: "0.5rem" }}>{a.message}</span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/alerts" className="btn" style={{ marginTop: "1rem" }}>
            All insights →
          </Link>
        </div>
      </div>

      <div className="card" style={{ marginTop: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: "0 0 0.25rem" }}>Banking API spend (30d)</h3>
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.9rem" }}>
              Mock Plaid-style sandbox tracking
            </p>
          </div>
          <StatCard
            label=""
            value={`$${(apiCost ?? 0).toFixed(2)}`}
            sub="total API cost"
          />
        </div>
        <Link to="/api-costs" className="btn btn-primary" style={{ marginTop: "1rem" }}>
          Optimize API costs →
        </Link>
      </div>
    </>
  );
}
