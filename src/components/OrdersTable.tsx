"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ars, n, titleCase } from "@/lib/format";
import type { Pedido } from "@/lib/store";

interface OrdersResponse {
  pedidos: Pedido[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 12;

export default function OrdersTable({
  cliente,
  categorias,
}: {
  cliente: string;
  categorias: string[];
}) {
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState("todos");
  const [categoria, setCategoria] = useState("todas");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<OrdersResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const params = useMemo(
    () =>
      new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        estado,
        categoria,
        search,
      }),
    [page, estado, categoria, search]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tiendas/${cliente}/pedidos?${params}`);
      if (!res.ok) throw new Error("error");
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [cliente, params]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="card overflow-hidden !p-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 bg-slate-950/40 px-5 py-4">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Buscar producto..."
          className="flex-1 min-w-48 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-margen"
        />
        <select
          value={estado}
          onChange={(e) => {
            setEstado(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-margen"
        >
          <option value="todos">Todos los estados</option>
          <option value="pagado">Pagados</option>
          <option value="cancelado">Cancelados</option>
        </select>
        <select
          value={categoria}
          onChange={(e) => {
            setCategoria(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-margen"
        >
          <option value="todas">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c} value={c}>
              {titleCase(c)}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="px-5 py-3">Pedido</th>
              <th className="px-5 py-3">Fecha</th>
              <th className="px-5 py-3">Producto</th>
              <th className="px-5 py-3">Categoría</th>
              <th className="px-5 py-3 text-right">Precio</th>
              <th className="px-5 py-3">Pago</th>
              <th className="px-5 py-3">Envío</th>
            </tr>
          </thead>
          <tbody>
            {loading && !data ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                  Cargando...
                </td>
              </tr>
            ) : !data || data.pedidos.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                  Sin pedidos que coincidan
                </td>
              </tr>
            ) : (
              data.pedidos.map((o) => (
                <tr
                  key={o.id_pedido}
                  className="border-b border-slate-800/60 last:border-0 hover:bg-slate-950/40"
                >
                  <td className="px-5 py-3 tabular-nums text-slate-400">#{o.id_pedido}</td>
                  <td className="px-5 py-3 text-slate-300">{o.fecha}</td>
                  <td className="px-5 py-3 font-medium">{o.producto}</td>
                  <td className="px-5 py-3 text-slate-300">{titleCase(o.categoria)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {ars(o.precio)}
                    <span className="ml-1 text-xs text-slate-500">×{o.cantidad}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                        o.estado_pago === "pagado"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-rose-500/15 text-rose-400"
                      }`}
                    >
                      {o.estado_pago}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-300">
                    {o.estado_pago === "cancelado" && o.motivo_cancelacion ? (
                      <span className="text-xs text-rose-400/80">
                        {titleCase(o.motivo_cancelacion)}
                      </span>
                    ) : (
                      titleCase(o.estado_envio)
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-slate-800 px-5 py-3 text-sm text-slate-400">
        <p>
          {data ? `${n(data.total)} pedidos` : "…"}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-xs tabular-nums">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}