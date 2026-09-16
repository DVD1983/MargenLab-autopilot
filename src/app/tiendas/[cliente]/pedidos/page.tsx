import { notFound } from "next/navigation";
import { getStore } from "@/lib/store";
import OrdersTable from "@/components/OrdersTable";

export const dynamic = "force-dynamic";

export default async function PedidosPage({
  params,
}: {
  params: { cliente: string };
}) {
  const { cliente } = params;
  const data = await getStore(cliente);
  if (!data) notFound();

  const categorias = Array.from(
    new Set(data.orders.map((o) => o.categoria))
  ).sort();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Pedidos</h2>
        <p className="text-sm text-slate-400">
          Busca, filtrá y paginá los {data.orders.length} pedidos de la tienda
        </p>
      </div>
      <OrdersTable cliente={cliente} categorias={categorias} />
    </div>
  );
}