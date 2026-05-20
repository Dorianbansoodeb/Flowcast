import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ForecastPoint } from "../api/client";

function formatDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface Props {
  data: ForecastPoint[];
  threshold?: number;
}

export function ForecastChart({ data, threshold = 2000 }: Props) {
  const chartData = data.map((p) => ({
    ...p,
    label: formatDate(p.date),
    threshold,
  }));

  return (
    <ResponsiveContainer width="100%" height={340}>
      <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5b8def" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#5b8def" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#2a3042" strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tick={{ fill: "#8b95ad", fontSize: 11 }}
          interval={Math.floor(chartData.length / 8)}
        />
        <YAxis
          tick={{ fill: "#8b95ad", fontSize: 11 }}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          contentStyle={{
            background: "#1c2030",
            border: "1px solid #2a3042",
            borderRadius: 8,
          }}
          formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
        />
        <Legend />
        <Area
          type="monotone"
          dataKey="upper"
          stroke="none"
          fill="#34d399"
          fillOpacity={0.08}
          name="Upper bound"
        />
        <Area
          type="monotone"
          dataKey="lower"
          stroke="none"
          fill="#f87171"
          fillOpacity={0.08}
          name="Lower bound"
        />
        <Line
          type="monotone"
          dataKey="balance"
          stroke="#5b8def"
          strokeWidth={2}
          dot={false}
          name="Predicted balance"
        />
        <Line
          type="monotone"
          dataKey="threshold"
          stroke="#fbbf24"
          strokeDasharray="6 4"
          dot={false}
          name={`Threshold ($${threshold.toLocaleString()})`}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
