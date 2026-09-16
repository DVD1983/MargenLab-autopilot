import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { analizeRows, parseBuffer, parseCsvText, sanitizeCliente } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

const ROOT = process.cwd();
const UPLOADS_DIR = path.join(ROOT, "data", "uploads");
const PROCESSED_DIR = path.join(ROOT, "data", "processed");

type Uploaded = { file: string; rows: Record<string, unknown>[] };

async function loadUpload(cliente: string): Promise<Uploaded | null> {
  let files: string[];
  try {
    files = await fs.readdir(UPLOADS_DIR);
  } catch {
    return null;
  }
  const target = files.find((f) =>
    /^[^.]+\.(csv|xlsx|xls)$/i.test(f) &&
    sanitizeCliente(f) === cliente
  );
  if (!target) return null;
  const buf = new Uint8Array(await fs.readFile(path.join(UPLOADS_DIR, target)));
  const ext = target.split(".").pop()?.toLowerCase();
  const rows =
    ext === "csv" ? parseCsvText(Buffer.from(buf).toString("utf-8")) : parseBuffer(buf);
  return { file: target, rows };
}

function compareNum(label: string, got: unknown, want: number | undefined): string | null {
  if (want === undefined) return null;
  const g = Number(got ?? 0);
  if (Math.abs(g - want) > 0.011) {
    return `${label}: esperado ${want}, calculado ${g} (diferencia ${(g - want).toFixed(2)})`;
  }
  return null;
}

function joined(arr: unknown[] | undefined, key: string): string {
  return (arr ?? []).map((x) => String((x as Record<string, unknown>)[key] ?? "")).join("|");
}

function joinedArr(arr: unknown[] | undefined): string {
  return (arr ?? []).map((x) => String(x)).join("|");
}

export async function GET(
  _request: Request,
  context: { params: { cliente: string } }
) {
  const cliente = sanitizeCliente(context.params.cliente);
  const res = async (body: Record<string, unknown>, status = 200) =>
    NextResponse.json(body, { status });

  const upload = await loadUpload(cliente);
  if (!upload) {
    return res({
      ok: false,
      razon: "sin_fuente",
      error: "No hay archivo original para re-validar. Subilo de nuevo por /subir.",
    });
  }

  let analizado;
  try {
    analizado = analizeRows(cliente, upload.rows);
  } catch {
    return res({ ok: false, razon: "analisis_error", error: "No se pudo re-analizar el archivo" });
  }

  const finPath = path.join(PROCESSED_DIR, `${cliente}_finanzas.json`);
  const hallPath = path.join(PROCESSED_DIR, `${cliente}_hallazgos.json`);
  const [rawFinanzas, rawHallazgos] = await Promise.all([
    fs.readFile(finPath, "utf-8").catch(() => null),
    fs.readFile(hallPath, "utf-8").catch(() => null),
  ]);
  if (!rawFinanzas || !rawHallazgos) {
    return res({
      ok: false,
      razon: "sin_analisis",
      error: "La tienda no tiene JSON de análisis almacenados.",
    });
  }

  const savedF = JSON.parse(rawFinanzas) as Record<string, unknown>;
  const savedH = JSON.parse(rawHallazgos) as Record<string, unknown>;
  const calcF = analizado.finanzas;
  const calcH = analizado.hallazgos;

  const discrepancias: string[] = [];
  const coincidencias: string[] = [];
  const push = (label: string, igual: boolean, detalle?: string) => {
    (igual ? coincidencias : discrepancias).push(
      igual ? label : detalle ?? label
    );
  };

  const checks: [string, unknown, number | undefined][] = [
    ["ingresos_total_ars", calcF["ingresos_total_ars"], savedF["ingresos_total_ars"] as number],
    ["churn_ars", calcF["churn_ars"], savedF["churn_ars"] as number],
    ["ticket_promedio_ars", calcF["ticket_promedio_ars"], savedF["ticket_promedio_ars"] as number],
    ["costo_total_ars", calcF["costo_total_ars"], savedF["costo_total_ars"] as number],
    ["envio_cobrado_total_ars", calcF["envio_cobrado_total_ars"], savedF["envio_cobrado_total_ars"] as number],
    ["envio_costo_total_ars", calcF["envio_costo_total_ars"], savedF["envio_costo_total_ars"] as number],
    ["utilidad_neta_ars", calcF["utilidad_neta_ars"], savedF["utilidad_neta_ars"] as number],
    ["margen_neto_pct", calcF["margen_neto_pct"], savedF["margen_neto_pct"] as number],
    ["tasa_cancelacion_pct", calcH["tasa_cancelacion_pct"], savedH["tasa_cancelacion_pct"] as number],
    ["total_pedidos", calcH["total_pedidos"], savedH["total_pedidos"] as number],
    ["pagados", calcH["pagados"], savedH["pagados"] as number],
    ["cancelados", calcH["cancelados"], savedH["cancelados"] as number],
  ];
  for (const [label, got, want] of checks) {
    const diff = compareNum(label, got, want);
    push(label, diff === null, diff ?? undefined);
  }

  const cmpString = (label: string, a: unknown[], b: unknown[]) => {
    const sa = joinedArr(a);
    const sb = joinedArr(b);
    push(label, sa === sb, `${label}: guardado [${sb}] vs re-calculado [${sa}]`);
  };
  const cmpJoined = (label: string, a: unknown[], b: unknown[], key: string) => {
    const sa = joined(a, key);
    const sb = joined(b, key);
    push(label, sa === sb, `${label}: guardado [${sb}] vs re-calculado [${sa}]`);
  };
  cmpString("top_80_20", calcF["top_80_20"] as unknown[], savedF["top_80_20"] as unknown[]);
  cmpJoined("metodo_pago", calcF["metodo_pago"] as unknown[], savedF["metodo_pago"] as unknown[], "metodo");

  const calcCats = (calcF["margen_por_categoria"] as { categoria: string; ingresos_ars: number; churn_ars: number }[]) ?? [];
  const savedCats = (savedF["margen_por_categoria"] as { categoria: string; ingresos_ars: number; churn_ars: number }[]) ?? [];
  for (const sc of savedCats) {
    const cc = calcCats.find((x) => x.categoria === sc.categoria);
    if (!cc) {
      discrepancias.push(`categoria '${sc.categoria}' en guardado no aparece re-calculada`);
      continue;
    }
    push(`categoria ${sc.categoria} ingresos`, Math.abs(cc.ingresos_ars - sc.ingresos_ars) <= 0.011, `categoria ${sc.categoria}: ingresos esperado ${sc.ingresos_ars}, calculado ${cc.ingresos_ars}`);
    push(`categoria ${sc.categoria} churn`, Math.abs(cc.churn_ars - sc.churn_ars) <= 0.011, `categoria ${sc.categoria}: churn esperado ${sc.churn_ars}, calculado ${cc.churn_ars}`);
  }

  return res({
    ok: discrepancias.length === 0,
    tienda: cliente,
    origen: upload.file,
    pedidos: calcH["total_pedidos"],
    coincidencias: coincidencias.length,
    discrepancias,
    validado_en: new Date().toISOString(),
  });
}