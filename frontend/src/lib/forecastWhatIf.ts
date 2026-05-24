import type { ForecastPoint } from "../api/client";

export interface WhatIfScenario {
  id: string;
  label: string;
  monthlyImpact: number;
}

export function applyWhatIfScenarios(
  base: ForecastPoint[],
  scenarios: WhatIfScenario[]
): ForecastPoint[] {
  if (scenarios.length === 0) return base;
  const dailyDelta = scenarios.reduce((sum, s) => sum + s.monthlyImpact / 30, 0);

  let cumulative = 0;
  return base.map((point, i) => {
    cumulative += dailyDelta;
    const balance = Math.round((point.balance + cumulative) * 100) / 100;
    const spread = point.upper - point.balance;
    return {
      ...point,
      balance,
      lower: Math.round((balance - spread) * 100) / 100,
      upper: Math.round((balance + spread) * 100) / 100,
      net_flow: Math.round((point.net_flow + (i === 0 ? 0 : dailyDelta)) * 100) / 100,
    };
  });
}

export const WHAT_IF_PRESETS: Omit<WhatIfScenario, "id">[] = [
  { label: "Lose biggest client (−$4,500/mo)", monthlyImpact: -4500 },
  { label: "Hire one person (+$4,000/mo)", monthlyImpact: -4000 },
  { label: "New retainer (+$2,800/mo)", monthlyImpact: 2800 },
];

export const RECURRING_CATEGORIES = new Set([
  "Rent",
  "Payroll",
  "Software",
  "Utilities",
  "Insurance",
  "Client Retainer",
  "E-commerce",
]);
