type Risk = "safe" | "warning" | "critical" | string;

export function RiskBadge({ level }: { level: Risk }) {
  const normalized = level.toLowerCase();
  const cls =
    normalized === "critical"
      ? "badge-critical"
      : normalized === "warning"
        ? "badge-warning"
        : "badge-safe";
  return <span className={`badge ${cls}`}>{level}</span>;
}
