import { notFound } from "next/navigation";
import { getStore } from "@/lib/store";
import { motivosLabels, titleCase } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RecomendacionesPage({
  params,
}: {
  params: { cliente: string };
}) {
  const { cliente } = params;
  const data = await getStore(cliente);
  if (!data) notFound();

  const { finanzas, hallazgos } = data;
  const maxMotivo = Math.max(
    1,
    ...hallazgos.cancelaciones.motivos_top.map((m) => m.cantidad)
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Recomendaciones autopilot</h2>
        <p className="text-sm text-slate-400">
          Acciones generadas automáticamente por el pipeline de análisis
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Plan de acción
          </h2>
          <div className="space-y-3">
            {finanzas.acciones.map((acc, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl border border-margen/20 bg-margen/5 p-4"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-margen/20 text-xs font-black text-margen">
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed">{acc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Productos top
          </h2>
          <ol className="space-y-1">
            {hallazgos.productos_top.map((p, i) => (
              <li
                key={p}
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-800/60"
              >
                <span className="w-5 text-right font-bold text-slate-500">{i + 1}</span>
                <span>{p}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="card">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-rose-400">
            Productos críticos
          </h2>
          <ul className="space-y-1">
            {hallazgos.productos_criticos.map((p) => (
              <li
                key={p}
                className="flex items-center gap-3 rounded-lg bg-rose-500/5 px-2 py-1.5 text-sm"
              >
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            Productos con menor ticket acumulado: evaluar promoción, baja de stock o
            quiebre de precio.
          </p>
        </div>

        <div className="card">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Motivos de cancelación
          </h2>
          <div className="space-y-3">
            {hallazgos.cancelaciones.motivos_top.map((m) => (
              <div key={m.motivo}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{motivosLabels[m.motivo] ?? titleCase(m.motivo)}</span>
                  <span className="tabular-nums text-slate-400">{m.cantidad}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-amber-400/80"
                    style={{ width: `${(m.cantidad / maxMotivo) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Top 80/20
          </h2>
          <p className="mb-4 text-xs text-slate-500">
            Categorías que concentran la mayor parte del margen. Focalizá el
            marketing acá:
          </p>
          <div className="flex flex-wrap gap-2">
            {finanzas.top_80_20.map((c) => (
              <span
                key={c}
                className="rounded-full bg-margen/15 px-3 py-1 text-sm font-semibold text-margen"
              >
                {titleCase(c)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}