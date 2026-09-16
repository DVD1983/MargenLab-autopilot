import { notFound } from "next/navigation";
import { getStore, listStores } from "@/lib/store";
import Sidebar from "@/components/Sidebar";
import { titleCase } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { cliente: string };
}) {
  const { cliente } = params;
  const data = await getStore(cliente);
  if (!data) notFound();

  const stores = await listStores();

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar stores={stores} current={cliente} />
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div>
              <h1 className="text-lg font-bold">{titleCase(cliente)}</h1>
              <p className="text-xs text-slate-400">
                Datos procesados por MargenLab Autopilot
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Al día · {data.orders.length} pedidos
            </div>
          </div>
        </header>
        <div className="px-6 py-6">{children}</div>
      </main>
    </div>
  );
}