"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import { titleCase } from "@/lib/format";
import type { CategoriaH } from "@/lib/store";

const PALETTE = ["#0ea5e9", "#f59e0b", "#10b981", "#f43f5e", "#8b5cf6", "#06b6d4"];

export default function CategoryDonut({
  data,
}: {
  data: CategoriaH[];
}) {
  const total = data.reduce((sum, c) => sum + c.pedidos, 0) || 1;
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="pedidos"
            nameKey="nombre"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((d, i) => (
              <Cell key={d.nombre} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [
              `${value} pedidos (${((Number(value) / total) * 100).toFixed(1)}%)`,
              titleCase(String(name)),
            ]}
            contentStyle={{
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: 12,
              fontSize: 12,
            }}
          />
          <Legend
            formatter={(v) => (
              <span className="text-xs text-slate-300">{titleCase(v)}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}