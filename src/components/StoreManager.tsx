"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ars, n, titleCase } from "@/lib/format";

export interface StoreSummary {
  id: string;
  pedidos: number;
  pagados: number;
  cancelados: number;
  ingresos: number;
  churn: number;
  tasa: number;
  ticket: number;
}

type Revalidacion =
  | { estado: "ok"; coincidencias: number }
  | { estado: "desactualizado"; motivo: string }
  | { estado: "sin_fuente" }
  | { estado: "cargando" };

export default function StoreManager({ stores }: { stores: StoreSummary[] }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, Revalidacion>>({});

  useEffect(() => {
    let cancelado = false;
    for (const s of stores) {
      if (status[s.id]) continue;
      setStatus((prev) => ({ ...prev, [s.id]: { estado: "cargando" } }));
      fetch(`/api/tiendas/${s.id}/validar`)
        .then((r) => r.json())
        .then((j) => {
          if (cancelado) return;
          setStatus((prev) => ({
            ...prev,
            [s.id]: j.ok
              ? { estado: "ok", coincidencias: j.coincidencias ?? 0 }
              : { estado: "desactualizado", motivo: j.razon ?? "" },
          }));
        })
        .catch(() => {
          if (!cancelado)
            setStatus((prev) => ({ ...prev, [s.id]: { estado: "sin_fuente" } }));
        });
    }
    return () => {
      cancelado = true;
    };
  }, [stores]);

  function badge(s: StoreSummary): React.ReactNode {
    const st = status[s.id];
    if (!st || st.estado === "cargando")
      return (
        <span className="rounded-full bg-slate-700/40 px-2.5 py-0.5 text-[11px] font-semibold text-slate-300">
          …
        </span>
      );
    if (st.estado === "ok")
      return (
        <span
          className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400"
          title={`Re-analizada contra el archivo original: ${st.coincidencias} métricas verificadas`}
        >
          ✓ verificada
        </span>
      );
    if (st.estado === "desactualizado")
      return (
        <span
          className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300"
          title="El archivo original no coincide con el análisis guardado. Re-subilo."
        >
          ⚠ desactualizada
        </span>
      );
    return null;
  }

  async function eliminar(id: string) {
    setDeleting(id);
    setError(null);
    try {
      const res = await fetch(`/api/tiendas/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "No se pudo eliminar");
        return;
      }
      setConfirm(null);
      router.refresh();
    } catch {
      setError("Error de conexión");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/tiendas" className="flex h-10 w-10 items-center justify-center rounded-xl bg-margen text-base font-black text-slate-950">
            M
          </Link>
          <div>
            <h1 className="text-xl font-bold">Mis tiendas</h1>
            <p className="text-sm text-slate-400">
              {stores.length === 0
                ? "Todavía no tenés tiendas analizadas"
                : `${n(stores.length)} tienda${stores.length === 1 ? "" : "s"} · creá las tuyas o eliminá las que quieras`}
            </p>
          </div>
        </div>
        <Link
          href="/subir"
          className="rounded-xl bg-margen px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:brightness-110"
        >
          + Nueva tienda (CSV / Excel / Sheets)
        </Link>
      </header>

      {error ? (
        <p className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
          {error}
        </p>
      ) : null}

      {stores.length === 0 ? (
        <div className="card flex flex-col items-center gap-4 py-16 text-center">
          <span className="text-4xl">🏪</span>
          <p className="max-w-sm text-sm text-slate-400">
            Subí un CSV de Tienda Nube, un Excel o pegá el link de una planilla de
            Google Sheets para generar el dashboard automáticamente.
          </p>
          <Link
            href="/subir"
            className="rounded-xl bg-margen px-5 py-2.5 text-sm font-bold text-slate-950"
          >
            Crear mi primera tienda
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stores.map((s) => (
            <div
              key={s.id}
              className="card flex flex-col gap-4 transition hover:border-margen/50"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold">{titleCase(s.id)}</h2>
                  <p className="text-[11px] text-slate-500">
                    ID: <span className="font-mono">{s.id}</span>
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                {badge(s)}
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    s.tasa > 20
                      ? "bg-rose-500/15 text-rose-400"
                      : "bg-emerald-500/15 text-emerald-400"
                  }`}
                >
                  {s.tasa}% cancel.
                </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[11px] text-slate-500">Ingresos</p>
                  <p className="font-semibold tabular-nums">{ars(s.ingresos)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500">Churn</p>
                  <p className="font-semibold tabular-nums text-rose-400">
                    {ars(s.churn)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500">Pedidos</p>
                  <p className="tabular-nums text-slate-300">
                    {n(s.pedidos)} ({s.pagados} ok)
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500">Ticket prom.</p>
                  <p className="tabular-nums text-slate-300">{ars(s.ticket)}</p>
                </div>
              </div>

              <div className="mt-auto flex items-center gap-2 border-t border-slate-800 pt-3">
                <Link
                  href={`/tiendas/${s.id}`}
                  className="flex-1 rounded-lg bg-slate-800 px-3 py-2 text-center text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
                >
                  Abrir dashboard
                </Link>
                {confirm === s.id ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={deleting === s.id}
                      onClick={() => eliminar(s.id)}
                      className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-rose-500 disabled:opacity-60"
                    >
                      {deleting === s.id ? "…" : "Sí, borrar"}
                    </button>
                    <button
                      type="button"
                      disabled={deleting !== null}
                      onClick={() => setConfirm(null)}
                      className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirm(s.id)}
                    className="rounded-lg border border-rose-500/40 px-3 py-2 text-xs font-semibold text-rose-400 transition hover:bg-rose-500/10"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-8 text-center text-xs text-slate-600">
        Eliminar una tienda borra su CSV/Excel, los JSON procesados y su carpeta de
        output. Cada tienda es un espacio independiente: podés compartir el link de
        cada dashboard con su dueño.
      </p>
    </div>
  );
}