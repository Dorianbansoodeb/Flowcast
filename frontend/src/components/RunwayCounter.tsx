interface Props {
  days: number;
  variant?: "safe" | "warning" | "critical";
}

export function RunwayCounter({ days, variant = "safe" }: Props) {
  const capped = Math.min(days, 999);
  const label =
    capped >= 999
      ? "Runway looks healthy at current burn"
      : capped === 1
        ? "You have 1 day of runway left at current burn rate."
        : `You have ${capped} days of runway left at current burn rate.`;

  return (
    <div className={`runway-counter runway-counter--${variant}`}>
      <p className="runway-counter-label">Cash runway</p>
      <p className="runway-counter-value">{capped >= 999 ? "999+" : capped}</p>
      <p className="runway-counter-unit">{capped >= 999 ? "days" : capped === 1 ? "day" : "days"}</p>
      <p className="runway-counter-message">{label}</p>
    </div>
  );
}
