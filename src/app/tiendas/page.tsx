import StoreManager, { type StoreSummary } from "@/components/StoreManager";
import { getStore, listStores } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function TiendasPage() {
  const stores = await listStores();
  const summaries: StoreSummary[] = [];

  await Promise.all(
    stores.map(async (id) => {
      const data = await getStore(id);
      if (!data) return;
      summaries.push({
        id: data.id,
        pedidos: data.hallazgos.pagados + data.hallazgos.cancelados,
        pagados: data.hallazgos.pagados,
        cancelados: data.hallazgos.cancelados,
        ingresos: data.finanzas.ingresos_total_ars,
        churn: data.finanzas.churn_ars,
        tasa: data.hallazgos.tasa_cancelacion_pct,
        ticket: data.finanzas.ticket_promedio_ars,
      });
    })
  );

  summaries.sort((a, b) => a.id.localeCompare(b.id));

  return <StoreManager stores={summaries} />;
}