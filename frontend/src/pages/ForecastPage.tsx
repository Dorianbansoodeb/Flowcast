import { useEffect, useMemo, useState } from "react";
import { api, Forecast, AlertsResponse, Transaction } from "../api/client";
import { StatCard } from "../components/StatCard";
import { RiskBadge } from "../components/RiskBadge";
import { Loading } from "../components/Loading";
import { EmptyState } from "../components/EmptyState";
import { ForecastChart } from "../charts/ForecastChart";
import { downloadCsv } from "../lib/exportCsv";
import {
  applyWhatIfScenarios,
  RECURRING_CATEGORIES,
  WHAT_IF_PRESETS,
  type WhatIfScenario,
} from "../lib/forecastWhatIf";
import { getAlertThreshold } from "../lib/userSettings";

export function ForecastPage() {
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [alerts, setAlerts] = useState<AlertsResponse | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"full" | "recurring">("full");
  const [scenarios, setScenarios] = useState<WhatIfScenario[]>([]);
  const [customLabel, setCustomLabel] = useState("");
  const [customAmount, setCustomAmount] = useState("");

  useEffect(() => {
    const threshold = getAlertThreshold();
    Promise.all([api.getForecast(), api.getAlerts(undefined, threshold), api.getTransactions()])
      .then(([f, a, txs]) => {
        setForecast(f);
        setAlerts(a);
        setTransactions(txs);
      })
      .finally(() => setLoading(false));
  }, []);

  const recurringBurn30 = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return transactions
      .filter(
        (t) =>
          !t.is_income &&
          RECURRING_CATEGORIES.has(t.category) &&
          new Date(t.date) >= cutoff
      )
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }, [transactions]);

  const fullBurn30 = forecast?.expenses_30d ?? 0;

  const displayForecast = useMemo(() => {
    if (!forecast) return [];
    let points = forecast.forecast;
    if (viewMode === "recurring" && fullBurn30 > 0) {
      const ratio = recurringBurn30 / fullBurn30;
      const dailyAdj =
        (forecast.expenses_30d - recurringBurn30) / 30;
      let cumulative = 0;
      points = forecast.forecast.map((p, i) => {
        if (i === 0) return p;
        cumulative += dailyAdj * ratio;
        const balance = Math.round((p.balance + cumulative) * 100) / 100;
        return { ...p, balance, net_flow: p.net_flow + dailyAdj * 0.3 };
      });
    }
    return applyWhatIfScenarios(points, scenarios);
  }, [forecast, viewMode, recurringBurn30, fullBurn30, scenarios]);

  const addPreset = (preset: (typeof WHAT_IF_PRESETS)[0]) => {
    setScenarios((prev) => [
      ...prev,
      { ...preset, id: `${Date.now()}-${prev.length}` },
    ]);
  };

  const addCustom = () => {
    const amount = Number(customAmount);
    if (!customLabel.trim() || !Number.isFinite(amount) || amount === 0) return;
    setScenarios((prev) => [
      ...prev,
      {
        id: `${Date.now()}`,
        label: customLabel.trim(),
        monthlyImpact: amount,
      },
    ]);
    setCustomLabel("");
    setCustomAmount("");
  };

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

  const minPoint = displayForecast.reduce(
    (min, p) => (p.balance < min.balance ? p : min),
    displayForecast[0]
  );

  const exportForecast = () => {
    downloadCsv(
      "flowcast-forecast.csv",
      ["date", "balance", "lower", "upper", "net_flow"],
      displayForecast.map((p) => [p.date, p.balance, p.lower, p.upper, p.net_flow])
    );
  };

  return (
    <>
      <header className="page-header page-header--with-actions">
        <div>
          <h1>Cash Flow Forecast</h1>
          <p>90-day projected balance with what-if scenarios and recurring cost views.</p>
        </div>
        <button type="button" className="btn" onClick={exportForecast}>
          Export CSV
        </button>
      </header>

      <div className="forecast-toggle-bar">
        <span className="forecast-toggle-label">View:</span>
        <button
          type="button"
          className={`btn btn-sm${viewMode === "full" ? " btn-primary" : ""}`}
          onClick={() => setViewMode("full")}
        >
          Full picture
        </button>
        <button
          type="button"
          className={`btn btn-sm${viewMode === "recurring" ? " btn-primary" : ""}`}
          onClick={() => setViewMode("recurring")}
        >
          Recurring only
        </button>
        {viewMode === "recurring" && (
          <span className="forecast-toggle-hint">
            Committed costs ~${recurringBurn30.toLocaleString()}/30d vs ${fullBurn30.toLocaleString()} total
          </span>
        )}
      </div>

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
        <ForecastChart data={displayForecast} threshold={alerts.threshold} />
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h3 style={{ marginTop: 0 }}>What-if scenarios</h3>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Add a hypothetical change — the forecast chart updates instantly.
        </p>
        <div className="what-if-presets">
          {WHAT_IF_PRESETS.map((p) => (
            <button key={p.label} type="button" className="btn btn-sm" onClick={() => addPreset(p)}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="what-if-custom">
          <input
            type="text"
            placeholder="Custom scenario label"
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
          />
          <input
            type="number"
            placeholder="Monthly impact (+/−)"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
          />
          <button type="button" className="btn btn-primary btn-sm" onClick={addCustom}>
            Add
          </button>
        </div>
        {scenarios.length > 0 && (
          <ul className="what-if-list">
            {scenarios.map((s) => (
              <li key={s.id}>
                <span>
                  {s.label}{" "}
                  <em>({s.monthlyImpact >= 0 ? "+" : ""}${s.monthlyImpact.toLocaleString()}/mo)</em>
                </span>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setScenarios((prev) => prev.filter((x) => x.id !== s.id))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Threshold alerts</h3>
        <p style={{ color: "var(--text-muted)" }}>
          Alert when balance drops below ${alerts.threshold.toLocaleString()}.
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
