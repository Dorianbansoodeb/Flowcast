import { useEffect, useState } from "react";
import { api, Forecast, AlertsResponse } from "../api/client";
import { StatCard } from "../components/StatCard";
import { RiskBadge } from "../components/RiskBadge";
import { Loading } from "../components/Loading";
import { EmptyState } from "../components/EmptyState";
import { ForecastChart } from "../charts/ForecastChart";

export function ForecastPage() {
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [alerts, setAlerts] = useState<AlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getForecast(), api.getAlerts()])
      .then(([f, a]) => {
        setForecast(f);
        setAlerts(a);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading message="Generating forecast…" />;
  if (!forecast || !alerts)
    return (
      <EmptyState
        title="No forecast data"
        description="Load mock transactions to generate a 90-day projection."
        action={
          <button
            className="btn btn-primary"
            onClick={() => api.mockLoad().then(() => window.location.reload())}
          >
            Load mock data
          </button>
        }
      />
    );

  const minPoint = forecast.forecast.reduce(
    (min, p) => (p.balance < min.balance ? p : min),
    forecast.forecast[0]
  );

  return (
    <>
      <header className="page-header">
        <h1>Cash Flow Forecast</h1>
        <p>90-day projected balance with upper and lower confidence bands.</p>
      </header>

      <div className="card-grid cols-4" style={{ marginBottom: "1.5rem" }}>
        <StatCard label="Today" value={`$${forecast.current_balance.toLocaleString()}`} />
        <StatCard
          label="Projected minimum"
          value={`$${minPoint.balance.toLocaleString()}`}
          sub={new Date(minPoint.date + "T12:00:00").toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
          })}
          variant={minPoint.balance < alerts.threshold ? "warning" : "safe"}
        />
        <StatCard label="Runway" value={`${forecast.projected_runway_days} days`} />
        <StatCard
          label="Risk level"
          value={<RiskBadge level={alerts.overall_risk} />}
          variant={
            alerts.overall_risk === "critical"
              ? "critical"
              : alerts.overall_risk === "warning"
                ? "warning"
                : "safe"
          }
        />
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <ForecastChart data={forecast.forecast} threshold={alerts.threshold} />
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Threshold alerts</h3>
        <p style={{ color: "var(--text-muted)" }}>
          Alert when balance drops below ${alerts.threshold.toLocaleString()}.
          {/* SENDGRID/TWILIO: Email/SMS notifications on alert trigger */}
        </p>
        {alerts.alerts.length === 0 ? (
          <p className="risk-safe">No threshold breaches predicted in the next 90 days.</p>
        ) : (
          <ul style={{ padding: 0, listStyle: "none" }}>
            {alerts.alerts.map((a, i) => (
              <li
                key={i}
                className={`insight-card ${a.risk_level === "critical" ? "critical" : ""}`}
                style={{ marginBottom: "1rem" }}
              >
                <RiskBadge level={a.risk_level} />
                <p style={{ margin: "0.5rem 0 0" }}>{a.message}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
