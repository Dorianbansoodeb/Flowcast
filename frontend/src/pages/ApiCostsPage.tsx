import { useEffect, useState } from "react";
import {
  api,
  ApiCostSummary,
  ApiInsightsResponse,
  CostByAccount,
} from "../api/client";
import { StatCard } from "../components/StatCard";
import { Loading } from "../components/Loading";
import { ApiCostChart } from "../charts/ApiCostChart";
import { downloadCsv } from "../lib/exportCsv";
import {
  applySaving,
  getAppliedSavings,
  totalAppliedSavingsThisMonth,
} from "../lib/userSettings";
import { useToast } from "../components/Toast";

const MOCK_ENDPOINTS = [
  "/transactions/get",
  "/transactions/sync",
  "/accounts/balance/get",
  "/identity/get",
];

export function ApiCostsPage() {
  const { showToast } = useToast();
  const [summary, setSummary] = useState<ApiCostSummary | null>(null);
  const [insights, setInsights] = useState<ApiInsightsResponse | null>(null);
  const [byAccount, setByAccount] = useState<CostByAccount | null>(null);
  const [timeline, setTimeline] = useState<
    { date: string; calls: number; cost_usd: number; failures: number }[]
  >([]);
  const [appliedSavings, setAppliedSavings] = useState(getAppliedSavings());
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.getApiCostSummary(),
      api.getApiInsights(),
      api.getApiCostTimeline(),
      api.getApiCostByAccount(),
    ])
      .then(([s, i, t, ba]) => {
        setSummary(s);
        setInsights(i);
        setTimeline(t.timeline);
        setByAccount(ba);
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

  const markApplied = (pattern: string, endpoint: string, amount: number) => {
    const id = `${pattern}-${endpoint}`;
    applySaving({
      id,
      label: pattern,
      amount,
      appliedAt: new Date().toISOString(),
    });
    setAppliedSavings(getAppliedSavings());
    showToast(`Marked "${pattern}" as applied — $${amount}/mo saved`, "success");
  };

  const exportReport = () => {
    if (!summary) return;
    downloadCsv(
      "flowcast-api-costs.csv",
      ["endpoint", "calls", "cost_usd", "failures"],
      summary.by_endpoint.map((r) => [r.endpoint, r.calls, r.cost_usd, r.failures])
    );
  };

  if (loading) return <Loading message="Loading API cost data…" />;

  const savedThisMonth = totalAppliedSavingsThisMonth();

  return (
    <>
      <header className="page-header page-header--with-actions">
        <div>
          <h1>API Cost Optimizer</h1>
          <p>Track banking API usage, detect waste, and estimate savings.</p>
        </div>
        <button type="button" className="btn" onClick={exportReport}>
          Export CSV
        </button>
      </header>

      <div className="savings-tracker card" style={{ marginBottom: "1.5rem" }}>
        <div>
          <p className="savings-tracker-label">Savings this month</p>
          <p className="savings-tracker-value">${savedThisMonth.toFixed(0)}</p>
          <p className="savings-tracker-sub">
            {appliedSavings.length > 0
              ? `${appliedSavings.length} recommendation(s) applied`
              : "Apply an optimization below to start tracking savings"}
          </p>
        </div>
        <div className="savings-tracker-potential">
          <span>Potential if all tips applied</span>
          <strong>${(insights?.total_estimated_savings_usd ?? 0).toFixed(0)}/mo</strong>
        </div>
      </div>

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

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h3 style={{ marginTop: 0 }}>Cost per connected account</h3>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Some clients cost more because of sync frequency and failed retries.
        </p>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Calls</th>
                <th>Cost</th>
                <th>Failures</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              {(byAccount?.accounts ?? []).map((row) => (
                <tr key={row.account_id}>
                  <td>{row.label}</td>
                  <td>{row.calls}</td>
                  <td>${row.cost_usd.toFixed(4)}</td>
                  <td>{row.failures}</td>
                  <td>
                    {byAccount && byAccount.total_cost_usd > 0
                      ? `${Math.round((row.cost_usd / byAccount.total_cost_usd) * 100)}%`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
            {insights?.patterns.map((p, i) => {
              const applied = appliedSavings.some(
                (s) => s.id === `${p.pattern}-${p.endpoint}`
              );
              return (
                <li
                  key={i}
                  className={`insight-card ${p.severity === "critical" ? "critical" : ""}`}
                  style={{ marginBottom: "1.25rem" }}
                >
                  <strong>{p.message}</strong>
                  <p style={{ margin: "0.35rem 0", color: "var(--text-muted)" }}>
                    → {p.suggestion}
                  </p>
                  <p style={{ margin: "0 0 0.5rem", color: "var(--safe)" }}>
                    Est. savings: ${p.estimated_savings_usd.toFixed(0)}/mo
                  </p>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={applied}
                    onClick={() => markApplied(p.pattern, p.endpoint, p.estimated_savings_usd)}
                  >
                    {applied ? "Applied ✓" : "Mark as applied"}
                  </button>
                </li>
              );
            })}
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
