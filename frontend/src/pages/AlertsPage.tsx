import { useEffect, useState } from "react";
import { api, AlertsResponse, ApiInsightsResponse } from "../api/client";
import { RiskBadge } from "../components/RiskBadge";
import { StatCard } from "../components/StatCard";
import { Loading } from "../components/Loading";

export function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertsResponse | null>(null);
  const [apiInsights, setApiInsights] = useState<ApiInsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getAlerts(), api.getApiInsights()])
      .then(([a, i]) => {
        setAlerts(a);
        setApiInsights(i);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading message="Loading insights…" />;

  const cashAlerts = alerts?.alerts ?? [];
  const apiPatterns = apiInsights?.patterns ?? [];

  return (
    <>
      <header className="page-header">
        <h1>Alerts & Insights</h1>
        <p>Cash flow warnings and API cost optimization in one place.</p>
      </header>

      <div className="card-grid cols-3" style={{ marginBottom: "1.5rem" }}>
        <StatCard
          label="Cash flow status"
          value={<RiskBadge level={alerts?.overall_risk ?? "safe"} />}
          variant={
            alerts?.overall_risk === "critical"
              ? "critical"
              : alerts?.overall_risk === "warning"
                ? "warning"
                : "safe"
          }
        />
        <StatCard label="Active cash alerts" value={cashAlerts.length} />
        <StatCard
          label="API optimization tips"
          value={apiPatterns.length}
          sub={`$${(apiInsights?.total_estimated_savings_usd ?? 0).toFixed(0)} potential savings`}
        />
      </div>

      <div className="card-grid cols-2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Cash flow alerts</h3>
          {cashAlerts.length === 0 ? (
            <p className="risk-safe">All clear — no balance warnings for the next 90 days.</p>
          ) : (
            <ul style={{ padding: 0, listStyle: "none" }}>
              {cashAlerts.map((a, i) => (
                <li
                  key={i}
                  className={`insight-card ${a.risk_level === "critical" ? "critical" : ""}`}
                  style={{ marginBottom: "1rem" }}
                >
                  <RiskBadge level={a.risk_level} />
                  <p style={{ margin: "0.5rem 0 0" }}>{a.message}</p>
                  {a.predicted_balance != null && (
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>
                      Projected: ${a.predicted_balance.toLocaleString()}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>API cost insights</h3>
          {apiPatterns.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>No API patterns flagged.</p>
          ) : (
            <ul style={{ padding: 0, listStyle: "none" }}>
              {apiPatterns.map((p, i) => (
                <li key={i} className="insight-card" style={{ marginBottom: "1rem" }}>
                  <span className={`badge badge-${p.severity === "critical" ? "critical" : "warning"}`}>
                    {p.pattern}
                  </span>
                  <p style={{ margin: "0.5rem 0 0" }}>{p.suggestion}</p>
                  <p style={{ margin: 0, color: "var(--safe)", fontSize: "0.85rem" }}>
                    Save ~${p.estimated_savings_usd}/mo
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
