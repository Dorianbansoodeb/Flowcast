import { useEffect, useState } from "react";
import { api, AlertsResponse, ApiInsightsResponse, WeeklyDigest } from "../api/client";
import { RiskBadge } from "../components/RiskBadge";
import { StatCard } from "../components/StatCard";
import { Loading } from "../components/Loading";
import { useToast } from "../components/Toast";
import {
  getAlertThreshold,
  getDigestEmail,
  isDigestEnabled,
  setAlertThreshold,
  setDigestEmail,
  setDigestEnabled,
} from "../lib/userSettings";

export function AlertsPage() {
  const { showToast } = useToast();
  const [alerts, setAlerts] = useState<AlertsResponse | null>(null);
  const [apiInsights, setApiInsights] = useState<ApiInsightsResponse | null>(null);
  const [digest, setDigest] = useState<WeeklyDigest | null>(null);
  const [thresholdInput, setThresholdInput] = useState(String(getAlertThreshold()));
  const [emailInput, setEmailInput] = useState(getDigestEmail());
  const [digestOn, setDigestOn] = useState(isDigestEnabled());
  const [loading, setLoading] = useState(true);

  const loadAlerts = (threshold?: number) => {
    const t = threshold ?? getAlertThreshold();
    return Promise.all([api.getAlerts(undefined, t), api.getApiInsights(), api.getDigestPreview(undefined, t)]).then(
      ([a, i, d]) => {
        setAlerts(a);
        setApiInsights(i);
        setDigest(d);
      }
    );
  };

  useEffect(() => {
    loadAlerts().finally(() => setLoading(false));
  }, []);

  const saveThreshold = () => {
    const value = Number(thresholdInput);
    if (!Number.isFinite(value) || value <= 0) return;
    setAlertThreshold(value);
    setLoading(true);
    loadAlerts(value)
      .then(() => showToast(`Alert threshold set to $${value.toLocaleString()}`, "success"))
      .finally(() => setLoading(false));
  };

  const saveDigest = () => {
    setDigestEmail(emailInput.trim());
    setDigestEnabled(digestOn);
    showToast(
      digestOn
        ? "Weekly digest scheduled for Monday mornings (preview mode)"
        : "Weekly digest disabled",
      "info"
    );
  };

  if (loading && !alerts) return <Loading message="Loading insights…" />;

  const cashAlerts = alerts?.alerts ?? [];
  const apiPatterns = apiInsights?.patterns ?? [];

  return (
    <>
      <header className="page-header">
        <h1>Alerts & Insights</h1>
        <p>Cash flow warnings, custom thresholds, and API cost optimization.</p>
      </header>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h3 style={{ marginTop: 0 }}>Custom alert threshold</h3>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Every business has a different comfort level — set when Flowcast should warn you.
        </p>
        <div className="threshold-editor">
          <label>
            Alert when balance drops below
            <div className="threshold-input-row">
              <span>$</span>
              <input
                type="number"
                min={100}
                step={100}
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
              />
              <button type="button" className="btn btn-primary btn-sm" onClick={saveThreshold}>
                Save
              </button>
            </div>
          </label>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h3 style={{ marginTop: 0 }}>Weekly email digest</h3>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Every Monday: balance, biggest expense, 30-day forecast, and risks — one email, no login.
        </p>
        <div className="digest-settings">
          <label className="digest-toggle">
            <input
              type="checkbox"
              checked={digestOn}
              onChange={(e) => setDigestOn(e.target.checked)}
            />
            Send weekly digest
          </label>
          <input
            type="email"
            placeholder="you@business.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            disabled={!digestOn}
          />
          <button type="button" className="btn btn-sm" onClick={saveDigest}>
            Save preferences
          </button>
        </div>
        {digest && (
          <pre className="digest-preview">{digest.preview_text}</pre>
        )}
        {digest && (
          <p className="digest-note">{digest.delivery_note}</p>
        )}
      </div>

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
