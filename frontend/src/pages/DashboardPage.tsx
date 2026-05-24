import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  api,
  Forecast,
  AlertsResponse,
  SpendingBreakdown,
  CashFlowCalendarResponse,
} from "../api/client";
import { StatCard } from "../components/StatCard";
import { RiskBadge } from "../components/RiskBadge";
import { Loading } from "../components/Loading";
import { EmptyState } from "../components/EmptyState";
import { RunwayCounter } from "../components/RunwayCounter";
import { ForecastChart } from "../charts/ForecastChart";
import { SpendingBreakdownChart } from "../charts/SpendingBreakdownChart";
import { CashFlowCalendar } from "../charts/CashFlowCalendar";
import { useToast } from "../components/Toast";
import { downloadCsv } from "../lib/exportCsv";
import { getAlertThreshold } from "../lib/userSettings";
import { isDemoMode } from "../lib/userSettings";

export function DashboardPage() {
  const location = useLocation();
  const { showToast } = useToast();
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [alerts, setAlerts] = useState<AlertsResponse | null>(null);
  const [spending, setSpending] = useState<SpendingBreakdown | null>(null);
  const [calendar, setCalendar] = useState<CashFlowCalendarResponse | null>(null);
  const [apiCost, setApiCost] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1);

  const threshold = getAlertThreshold();

  useEffect(() => {
    const state = location.state as { setupComplete?: boolean; demo?: boolean } | null;
    if (state?.setupComplete) {
      showToast("Setup complete — welcome to your dashboard!", "success");
      window.history.replaceState({}, document.title);
    }
  }, [location.state, showToast]);

  const loadCalendar = (year: number, month: number) => {
    api.getCashFlowCalendar(undefined, year, month).then(setCalendar);
  };

  useEffect(() => {
    const t = getAlertThreshold();
    Promise.all([
      api.getForecast(),
      api.getAlerts(undefined, t),
      api.getSpendingBreakdown(),
      api.getCashFlowCalendar(undefined, calYear, calMonth),
      api.getApiCostSummary(),
    ])
      .then(([f, a, s, c, cost]) => {
        setForecast(f);
        setAlerts(a);
        setSpending(s);
        setCalendar(c);
        setApiCost(cost.total_cost_usd);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [calYear, calMonth]);

  const handleCalendarMonth = (year: number, month: number) => {
    setCalYear(year);
    setCalMonth(month);
    loadCalendar(year, month);
  };

  const exportForecast = () => {
    if (!forecast) return;
    downloadCsv(
      "flowcast-forecast.csv",
      ["date", "balance", "lower", "upper", "net_flow"],
      forecast.forecast.map((p) => [p.date, p.balance, p.lower, p.upper, p.net_flow])
    );
  };

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

  const runwayVariant =
    forecast.projected_runway_days < 14
      ? "critical"
      : forecast.projected_runway_days < 30
        ? "warning"
        : "safe";

  const riskVariant =
    alerts.overall_risk === "critical"
      ? "critical"
      : alerts.overall_risk === "warning"
        ? "warning"
        : "safe";

  return (
    <>
      {isDemoMode() && (
        <p className="demo-banner">
          Demo mode — sample data only.{" "}
          <Link to="/onboarding" state={{ fresh: true }}>
            Connect a real bank →
          </Link>
        </p>
      )}

      <header className="page-header page-header--with-actions">
        <div>
          <h1>Dashboard</h1>
          <p>Your financial pulse — balance, runway, and risk at a glance.</p>
        </div>
        <button type="button" className="btn" onClick={exportForecast}>
          Export CSV
        </button>
      </header>

      <RunwayCounter days={forecast.projected_runway_days} variant={runwayVariant} />

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
          sub={`Threshold $${threshold.toLocaleString()}`}
        />
      </div>

      <div className="card-grid cols-2" style={{ marginBottom: "1.5rem" }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Spending breakdown (30d)</h3>
          {spending && spending.categories.length > 0 ? (
            <>
              <SpendingBreakdownChart categories={spending.categories} />
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 0 }}>
                Total expenses: ${spending.total_expenses.toLocaleString()}
              </p>
            </>
          ) : (
            <p style={{ color: "var(--text-muted)" }}>No expense categories yet.</p>
          )}
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Cash flow calendar</h3>
          {calendar ? (
            <CashFlowCalendar
              year={calendar.year}
              month={calendar.month}
              days={calendar.days.map((d) => ({
                ...d,
                mood: d.mood as "inflow" | "outflow" | "heavy" | "neutral",
              }))}
              onMonthChange={handleCalendarMonth}
            />
          ) : (
            <p style={{ color: "var(--text-muted)" }}>Loading calendar…</p>
          )}
        </div>
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h3 style={{ margin: "0 0 0.25rem" }}>Banking API spend (30d)</h3>
            <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.9rem" }}>
              Mock Plaid-style sandbox tracking
            </p>
          </div>
          <StatCard label="" value={`$${(apiCost ?? 0).toFixed(2)}`} sub="total API cost" />
        </div>
        <Link to="/api-costs" className="btn btn-primary" style={{ marginTop: "1rem" }}>
          Optimize API costs →
        </Link>
      </div>
    </>
  );
}
