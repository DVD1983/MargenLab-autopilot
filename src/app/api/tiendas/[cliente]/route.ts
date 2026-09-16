import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { sanitizeCliente } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

const ROOT = process.cwd();
const UPLOADS_DIR = path.join(ROOT, "data", "uploads");
const PROCESSED_DIR = path.join(ROOT, "data", "processed");
const OUTPUT_DIR = path.join(ROOT, "output");

export async function DELETE(
  _request: Request,
  context: { params: { cliente: string } }
) {
  const raw = context.params.cliente;
  const cliente = sanitizeCliente(raw);

  if (!cliente) {
    return NextResponse.json(
      { ok: false, error: "Nombre de tienda no válido" },
      { status: 400 }
    );
  }

  const eliminados = {
    uploads: [] as string[],
    processed: [] as string[],
    output: false,
  };

  // Uploads: cualquier archivo que empiece con {cliente}.
  try {
    const uploads = await fs.readdir(UPLOADS_DIR);
    for (const f of uploads) {
      if (f === `${cliente}.csv` || f === `${cliente}.xlsx` || f === `${cliente}.xls`) {
        await fs.rm(path.join(UPLOADS_DIR, f), { force: true });
        eliminados.uploads.push(f);
      }
    }
  } catch {
    /* carpeta no existe */
  }

  // Processed: {cliente}_clean/hallazgos/finanzas.json
  try {
    const processed = await fs.readdir(PROCESSED_DIR);
    for (const f of processed) {
      if ((f + "").startsWith(`${cliente}_`) && f.endsWith(".json")) {
        await fs.rm(path.join(PROCESSED_DIR, f), { force: true });
        eliminados.processed.push(f);
      }
    }
  } catch {
    /* carpeta no existe */
  }

  // Output: carpeta completa del cliente
  const outputPath = path.join(OUTPUT_DIR, cliente);
  const outputExists = await fs.stat(outputPath).catch(() => null);
  if (outputExists) {
    await fs.rm(outputPath, { recursive: true, force: true });
    eliminados.output = true;
  }

  const total =
    eliminados.uploads.length + eliminados.processed.length + (eliminados.output ? 1 : 0);

  return NextResponse.json({ ok: true, cliente, eliminados, total });
}