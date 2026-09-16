"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Modo = "archivo" | "sheets";

export default function UploadCsv() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [modo, setModo] = useState<Modo>("archivo");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [nombre, setNombre] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const EXT_OK = [".csv", ".xlsx", ".xls"];

  function pickFile(f: File | undefined) {
    if (!f) return;
    const ext = f.name.includes(".")
      ? "." + f.name.split(".").pop()!.toLowerCase()
      : "";
    if (!EXT_OK.includes(ext)) {
      setError("Formato no soportado. Usá CSV (.csv) o Excel (.xlsx/.xls)");
      return;
    }
    setError(null);
    setArchivo(f);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    pickFile(e.dataTransfer.files?.[0]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (modo === "archivo" && !archivo) {
      setError("Elegí un archivo CSV o Excel");
      return;
    }
    if (modo === "sheets" && !url.trim()) {
      setError("Pegá la URL de la planilla pública");
      return;
    }
    setError(null);
    setOk(null);
    setLoading(true);
    try {
      const form = new FormData();
      if (modo === "archivo" && archivo) form.append("file", archivo);
      if (modo === "sheets") form.append("url", url.trim());
      form.append("nombre", nombre.trim());

      const res = await fetch("/api/upload", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Error procesando el archivo");
        return;
      }
      setOk(
        `${json.pedidos} pedidos (${json.pagados} pagados, ${json.cancelados} cancelados) — listo`
      );
      setTimeout(() => router.push(`/tiendas/${json.cliente}`), 600);
    } catch {
      setError("Error de conexión. Intentalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-bold">Subir y analizar tienda</h2>
        <p className="text-sm text-slate-400">
          CSV, Excel o Google Sheets → pipeline autopilot → dashboard nuevo
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-900 p-1">
        {(
          [
            { id: "archivo", label: "Archivo CSV / Excel" },
            { id: "sheets", label: "Google Sheets" },
          ] as { id: Modo; label: string }[]
        ).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setModo(m.id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              modo === m.id
                ? "bg-margen text-slate-950"
                : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="card space-y-5">
        {modo === "archivo" ? (
          <div>
            <label
              htmlFor="file"
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition ${
                dragOver
                  ? "border-margen bg-margen/10"
                  : "border-slate-700 bg-slate-950/40 hover:border-margen"
              }`}
            >
              <span className="text-3xl">📦</span>
              <span className="text-sm font-semibold">
                {archivo
                  ? archivo.name
                  : "Arrastrá el archivo acá o hacé click para elegirlo"}
              </span>
              <span className="text-xs text-slate-500">
                .csv · .xlsx · .xls — cualquier tamaño (columnas: pedido,
                fecha, producto, precio, estado…)
              </span>
            </label>
            <input
              ref={inputRef}
              id="file"
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              URL de la planilla (debe ser pública)
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/ABC123/edit"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none placeholder:text-slate-600 focus:border-margen"
            />
            <p className="mt-2 text-xs text-slate-500">
              La planilla tiene que estar compartida como{" "}
              <span className="text-slate-300">"Cualquier persona con el enlace"</span>{" "}
              para poder leerla.
            </p>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
            Nombre de la tienda
          </label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={
              modo === "archivo"
                ? "Opcional (si se vacía, usa el nombre del archivo)"
                : "Requerido, ej: tienda_carmen"
            }
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none placeholder:text-slate-600 focus:border-margen"
          />
        </div>

        {error ? (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
            {error}
          </p>
        ) : null}
        {ok ? (
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
            {ok}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-margen px-4 py-3 text-sm font-bold text-slate-950 transition hover:brightness-110 disabled:opacity-60"
        >
          {loading ? "Procesando…" : "Analizar y crear dashboard"}
        </button>
      </form>
      </div>
    </div>
  );
}