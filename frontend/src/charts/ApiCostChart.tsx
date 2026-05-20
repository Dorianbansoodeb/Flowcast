import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface TimelinePoint {
  date: string;
  calls: number;
  cost_usd: number;
  failures: number;
}

export function ApiCostChart({ data }: { data: TimelinePoint[] }) {
  const chartData = data.map((d) => ({
    ...d,
    label: new Date(d.date + "T12:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={chartData}>
        <CartesianGrid stroke="#2a3042" strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={{ fill: "#8b95ad", fontSize: 11 }} />
        <YAxis
          yAxisId="cost"
          tick={{ fill: "#8b95ad", fontSize: 11 }}
          tickFormatter={(v) => `$${v}`}
        />
        <YAxis yAxisId="calls" orientation="right" tick={{ fill: "#8b95ad", fontSize: 11 }} />
        <Tooltip
          contentStyle={{
            background: "#1c2030",
            border: "1px solid #2a3042",
            borderRadius: 8,
          }}
        />
        <Legend />
        <Bar yAxisId="cost" dataKey="cost_usd" fill="#5b8def" name="Cost (USD)" radius={[4, 4, 0, 0]} />
        <Line
          yAxisId="calls"
          type="monotone"
          dataKey="calls"
          stroke="#34d399"
          strokeWidth={2}
          dot={false}
          name="API calls"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
