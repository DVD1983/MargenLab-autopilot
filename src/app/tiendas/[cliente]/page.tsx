import { notFound } from "next/navigation";
import { getStore } from "@/lib/store";
import { ars, motivosLabels, titleCase } from "@/lib/format";
import KpiCard from "@/components/KpiCard";
import RevenueTrend from "@/components/RevenueTrend";
import CategoryDonut from "@/components/CategoryDonut";
import MargenBars from "@/components/MargenBars";

export const dynamic = "force-dynamic";

export default async function ResumenPage({
  params,
}: {
  params: { cliente: string };
}) {
  const { cliente } = params;
  const data = await getStore(cliente);
  if (!data) notFound();

  const { finanzas, hallazgos, diario } = data;
  const maxMotivo = Math.max(
    1,
    ...hallazgos.cancelaciones.motivos_top.map((m) => m.cantidad)
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Ingresos"
          value={ars(finanzas.ingresos_total_ars)}
          sub={`${hallazgos.pagados} pedidos pagados`}
        />
        <KpiCard
          label="Churn"
          value={ars(finanzas.churn_ars)}
          sub={`${hallazgos.cancelados} pedidos cancelados`}
          tone="red"
        />
        <KpiCard
          label="Ticket promedio"
          value={ars(finanzas.ticket_promedio_ars)}
          sub="ARS por pedido pagado"
        />
        <KpiCard
          label="Tasa de cancelación"
          value={`${hallazgos.tasa_cancelacion_pct}%`}
          sub={`${hallazgos.total_pedidos} pedidos totales`}
          tone="amber"
        />
      </div>

      {finanzas.utilidad_neta_ars !== undefined ||
      finanzas.costo_total_ars !== undefined ||
      finanzas.margen_neto_pct !== undefined ||
      finanzas.envio_cobrado_total_ars !== undefined ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {finanzas.utilidad_neta_ars !== undefined ? (
            <KpiCard
              label="Utilidad neta"
              value={ars(finanzas.utilidad_neta_ars)}
              sub="ingresos − churn − costos"
              tone="green"
            />
          ) : null}
          {finanzas.margen_neto_pct !== undefined ? (
            <KpiCard
              label="Margen neto"
              value={`${finanzas.margen_neto_pct}%`}
              sub="sobre ingresos"
              tone="amber"
            />
          ) : null}
          {finanzas.costo_total_ars !== undefined ? (
            <KpiCard
              label="Costos totales"
              value={ars(finanzas.costo_total_ars)}
              sub="mercadería + envíos"
            />
          ) : null}
          {finanzas.envio_cobrado_total_ars !== undefined ? (
            <KpiCard
              label="Envío cobrado"
              value={ars(finanzas.envio_cobrado_total_ars)}
              sub="pagado por clientes"
            />
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Evolución diaria: ingresos vs churn
          </h2>
          <RevenueTrend data={diario} />
        </div>
        <div className="card">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Pedidos por categoría
          </h2>
          <CategoryDonut data={hallazgos.categorias} />
        </div>
      </div>

      <div className="card">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Margen por categoría
          </h2>
          <p className="text-xs text-slate-500">
            Barras: ingresos (azul) vs churn (rojo) en ARS
          </p>
        </div>
        <MargenBars data={finanzas.margen_por_categoria} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
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
                    className="h-full rounded-full bg-rose-400/80"
                    style={{ width: `${(m.cantidad / maxMotivo) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {finanzas.metodo_pago && finanzas.metodo_pago.length > 0 ? (
        <div className="card">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Método de pago
          </h2>
          <div className="space-y-3">
            {finanzas.metodo_pago.map((m) => (
              <div key={m.metodo}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{m.metodo}</span>
                  <span className="tabular-nums text-slate-400">
                    {m.pedidos} · {m.pct}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-margen/70"
                    style={{ width: `${m.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

        <div className="card">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
            Detalle de margen
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="py-2">Categoría</th>
                <th className="py-2 text-right">Pedidos</th>
                <th className="py-2 text-right">Ingresos</th>
                <th className="py-2 text-right">Churn</th>
                <th className="py-2 text-right">Margen</th>
              </tr>
            </thead>
            <tbody>
              {finanzas.margen_por_categoria.map((c) => (
                <tr key={c.categoria} className="border-b border-slate-800/60 last:border-0">
                  <td className="py-2 font-medium">{titleCase(c.categoria)}</td>
                  <td className="py-2 text-right tabular-nums text-slate-400">
                    {c.pedidos}
                  </td>
                  <td className="py-2 text-right tabular-nums">{ars(c.ingresos_ars)}</td>
                  <td className="py-2 text-right tabular-nums text-rose-400">
                    {ars(c.churn_ars)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-emerald-400">
                    {c.margen_estimado_pct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}