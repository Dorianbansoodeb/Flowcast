import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from "recharts";

const COLORS = ["#5b8def", "#f87171", "#fbbf24", "#34d399", "#a78bfa"];

export interface SpendingCategory {
  name: string;
  amount: number;
}

interface Props {
  categories: SpendingCategory[];
}

export function SpendingBreakdownChart({ categories }: Props) {
  if (categories.length === 0) {
    return <p style={{ color: "var(--text-muted)" }}>No expense data for this period.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={categories}
          dataKey="amount"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={95}
          paddingAngle={2}
        >
          {categories.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "#1c2030",
            border: "1px solid #2a3042",
            borderRadius: 8,
          }}
          formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
