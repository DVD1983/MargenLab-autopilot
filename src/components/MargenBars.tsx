"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import { ars, titleCase } from "@/lib/format";
import type { MargenCategoria } from "@/lib/store";

const COLORS: Record<string, string> = {
  ingresos: "#0ea5e9",
  churn: "#f43f5e",
};

export default function MargenBars({
  data,
}: {
  data: MargenCategoria[];
}) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="categoria"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickFormatter={titleCase}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip
            formatter={(value, name) => [ars(Number(value)), name]}
            contentStyle={{
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: 12,
              fontSize: 12,
            }}
          />
          <Bar
            dataKey="ingresos_ars"
            name="Ingresos"
            radius={[4, 4, 0, 0]}
            fill={COLORS.ingresos}
          />
          <Bar
            dataKey="churn_ars"
            name="Churn"
            radius={[4, 4, 0, 0]}
            fill={COLORS.churn}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}