import { useEffect, useState } from "react";
import {
  api,
  ApiCostSummary,
  ApiInsightsResponse,
} from "../api/client";
import { StatCard } from "../components/StatCard";
import { Loading } from "../components/Loading";
import { ApiCostChart } from "../charts/ApiCostChart";

const MOCK_ENDPOINTS = [
  "/transactions/get",
  "/transactions/sync",
  "/accounts/balance/get",
  "/identity/get",
];

export function ApiCostsPage() {
  const [summary, setSummary] = useState<ApiCostSummary | null>(null);
  const [insights, setInsights] = useState<ApiInsightsResponse | null>(null);
  const [timeline, setTimeline] = useState<
    { date: string; calls: number; cost_usd: number; failures: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.getApiCostSummary(),
      api.getApiInsights(),
      api.getApiCostTimeline(),
    ])
      .then(([s, i, t]) => {
        setSummary(s);
        setInsights(i);
        setTimeline(t.timeline);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const simulateCall = async (endpoint: string) => {
    setSimulating(true);
    try {
      await api.mockApiCall(endpoint);
      load();
    } finally {
      setSimulating(false);
    }
  };

  if (loading) return <Loading message="Loading API cost data…" />;

  return (
    <>
      <header className="page-header">
        <h1>API Cost Optimizer</h1>
        <p>Track banking API usage, detect waste, and estimate savings.</p>
      </header>

      <div className="card-grid cols-4" style={{ marginBottom: "1.5rem" }}>
        <StatCard
          label="Total cost (30d)"
          value={`$${(summary?.total_cost_usd ?? 0).toFixed(2)}`}
        />
        <StatCard label="Total calls" value={summary?.total_calls ?? 0} />
        <StatCard
          label="Failed calls"
          value={summary?.failed_calls ?? 0}
          variant={(summary?.failed_calls ?? 0) > 5 ? "critical" : "safe"}
        />
        <StatCard
          label="Est. savings"
          value={`$${(insights?.total_estimated_savings_usd ?? 0).toFixed(0)}`}
          variant="safe"
          sub="if optimizations applied"
        />
      </div>

      <div className="card-grid cols-2" style={{ marginBottom: "1.5rem" }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Usage over time</h3>
          {timeline.length > 0 ? (
            <ApiCostChart data={timeline} />
          ) : (
            <p style={{ color: "var(--text-muted)" }}>No timeline data yet.</p>
          )}
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Most expensive endpoints</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Endpoint</th>
                  <th>Calls</th>
                  <th>Cost</th>
                  <th>Failures</th>
                </tr>
              </thead>
              <tbody>
                {(summary?.most_expensive ?? []).map((row) => (
                  <tr key={row.endpoint}>
                    <td><code>{row.endpoint}</code></td>
                    <td>{row.calls}</td>
                    <td>${row.cost_usd.toFixed(4)}</td>
                    <td>{row.failures}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h3 style={{ marginTop: 0 }}>Optimization suggestions</h3>
        {(insights?.patterns ?? []).length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>No expensive patterns detected.</p>
        ) : (
          <ul style={{ padding: 0, listStyle: "none" }}>
            {insights?.patterns.map((p, i) => (
              <li
                key={i}
                className={`insight-card ${p.severity === "critical" ? "critical" : ""}`}
                style={{ marginBottom: "1.25rem" }}
              >
                <strong>{p.message}</strong>
                <p style={{ margin: "0.35rem 0", color: "var(--text-muted)" }}>
                  → {p.suggestion}
                </p>
                <p style={{ margin: 0, color: "var(--safe)" }}>
                  Est. savings: ${p.estimated_savings_usd.toFixed(0)}/mo
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Simulate API call</h3>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Log a mock banking API request to see cost tracking update live.
        </p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "1rem" }}>
          {MOCK_ENDPOINTS.map((ep) => (
            <button
              key={ep}
              className="btn"
              disabled={simulating}
              onClick={() => simulateCall(ep)}
            >
              Call {ep}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
