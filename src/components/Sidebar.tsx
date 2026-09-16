"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { titleCase } from "@/lib/format";

const NAV = [
  { href: "", label: "Resumen" },
  { href: "/pedidos", label: "Pedidos" },
  { href: "/recomendaciones", label: "Recomendaciones" },
];

export default function Sidebar({
  stores,
  current,
}: {
  stores: string[];
  current: string;
}) {
  const pathname = usePathname();
  const base = `/tiendas/${current}`;

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-900/80">
      <div className="flex items-center gap-2 border-b border-slate-800 px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-margen text-sm font-black text-slate-950">
          M
        </div>
        <div>
          <p className="text-sm font-bold leading-tight">MargenLab</p>
          <p className="text-[11px] leading-tight text-slate-400">
            Autopilot
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <Link
          href="/tiendas"
          className={`mb-4 block rounded-lg px-3 py-2 text-sm font-semibold transition ${
            pathname === "/tiendas"
              ? "bg-margen/15 text-margen"
              : "text-slate-300 hover:bg-slate-800"
          }`}
        >
          📊 Mis tiendas
        </Link>

        <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Tienda actual
        </p>
        <div className="mb-5 space-y-1">
          {stores.map((s) => {
            const active = s === current;
            return (
              <Link
                key={s}
                href={`/tiendas/${s}`}
                className={`block rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? "bg-margen/15 font-semibold text-margen"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                {titleCase(s)}
              </Link>
            );
          })}
        </div>

        <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Secciones
        </p>
        <div className="space-y-1">
          {NAV.map((item) => {
            const href = `${base}${item.href}`;
            const active = pathname === href;
            return (
              <Link
                key={item.href}
                href={href}
                className={`block rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? "bg-slate-800 font-semibold text-white"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-slate-800 px-5 py-4">
        <Link
          href="/subir"
          className="block w-full rounded-lg bg-margen px-3 py-2 text-center text-xs font-bold text-slate-950 transition hover:brightness-110"
        >
          + Analizar CSV / Excel / Sheets
        </Link>
      </div>
    </aside>
  );
}