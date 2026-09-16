"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { ars } from "@/lib/format";
import type { DiaPoint } from "@/lib/store";

export default function RevenueTrend({ data }: { data: DiaPoint[] }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gIngresos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.45} />
              <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gChurn" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.45} />
              <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="fecha"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickFormatter={(v: string) => v.slice(8, 10) + "/" + v.slice(5, 7)}
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
            labelFormatter={(l) => `Día ${l}`}
            contentStyle={{
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: 12,
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="ingresos"
            name="Ingresos"
            stroke="#0ea5e9"
            strokeWidth={2}
            fill="url(#gIngresos)"
          />
          <Area
            type="monotone"
            dataKey="churn"
            name="Churn"
            stroke="#f43f5e"
            strokeWidth={2}
            fill="url(#gChurn)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}