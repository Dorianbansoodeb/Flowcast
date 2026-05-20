import { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  sub?: string;
  variant?: "default" | "safe" | "warning" | "critical";
}

export function StatCard({ label, value, sub, variant = "default" }: StatCardProps) {
  const cls =
    variant === "safe"
      ? "risk-safe"
      : variant === "warning"
        ? "risk-warning"
        : variant === "critical"
          ? "risk-critical"
          : "";

  return (
    <div className="card stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${cls}`}>{value}</div>
      {sub && <p style={{ margin: "0.35rem 0 0", fontSize: "0.85rem", color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  );
}
