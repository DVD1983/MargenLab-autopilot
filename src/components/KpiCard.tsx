export default function KpiCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "red" | "green" | "amber";
}) {
  const tones: Record<string, string> = {
    default: "text-white",
    green: "text-emerald-400",
    red: "text-rose-400",
    amber: "text-amber-300",
  };
  return (
    <div className="card">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className={`kpi-value mt-2 ${tones[tone]}`}>{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-400">{sub}</p> : null}
    </div>
  );
}