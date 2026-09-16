import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 text-center text-slate-300">
      <p className="text-5xl font-black text-slate-700">404</p>
      <p className="text-sm">
        Tienda no encontrada. Ejecutá el autopilot{" "}
        <span className="font-semibold text-margen">/agent orchestrator</span> para
        procesar un CSV.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-lg bg-margen px-4 py-2 text-sm font-semibold text-slate-950"
      >
        Volver al inicio
      </Link>
    </div>
  );
}