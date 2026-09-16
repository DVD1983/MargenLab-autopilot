import { NextResponse } from "next/server";
import {
  fetchGoogleSheetsCsv,
  parseBuffer,
  parseCsvText,
  sanitizeCliente,
} from "@/lib/pipeline";
import { runPipeline } from "@/lib/run";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const url = String(form.get("url") ?? "").trim();
    const nombre = String(form.get("nombre") ?? "").trim();

    let rows: Record<string, unknown>[];
    let origen: "csv" | "xlsx" | "google_sheets";
    let cliente = "";
    let contenidoOriginal: Uint8Array | undefined;

    if (file && file instanceof File) {
      const name = String(file.name);
      const ext = name.split(".").pop()?.toLowerCase() ?? "";
      cliente = sanitizeCliente(nombre || name);
      if (!cliente) throw new Error("Nombre de cliente inválido");

      if (ext === "csv") {
        origen = "csv";
        const text = await file.text();
        rows = parseCsvText(text);
        contenidoOriginal = new TextEncoder().encode(text);
      } else if (ext === "xlsx" || ext === "xls") {
        origen = "xlsx";
        const buffer: Uint8Array = new Uint8Array(await file.arrayBuffer());
        rows = parseBuffer(buffer);
        contenidoOriginal = buffer;
      } else {
        throw new Error("Formato no soportado. Usá CSV (.csv) o Excel (.xlsx/.xls)");
      }
    } else if (url) {
      if (!/docs\.google\.com\/spreadsheets/i.test(url)) {
        throw new Error("La URL no parece ser de Google Sheets");
      }
      cliente = sanitizeCliente(nombre || "planilla");
      if (!cliente) throw new Error("Nombre de cliente inválido");
      origen = "google_sheets";
      const text = await fetchGoogleSheetsCsv(url);
      rows = parseCsvText(text);
      contenidoOriginal = new TextEncoder().encode(text);
    } else {
      throw new Error("Subí un archivo o pegá la URL de Google Sheets");
    }

    if (rows.length === 0) throw new Error("La planilla no tiene filas de datos");

    const uploadFileName =
      file && file instanceof File
        ? `${cliente}.${(String(file.name).split(".").pop() ?? "csv").toLowerCase()}`
        : `${cliente}.csv`;

    const result = await runPipeline(
      cliente,
      rows,
      origen,
      contenidoOriginal,
      uploadFileName
    );

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error procesando el archivo";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}