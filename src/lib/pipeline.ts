import { parse as parseCsv } from "csv-parse/sync";
import * as XLSX from "xlsx";

const REQUIRED_COLUMNS = [
  "id_pedido",
  "fecha",
  "producto",
  "categoria",
  "cantidad",
  "precio",
  "estado_pago",
  "estado_envio",
];

const ANONYMIZE_COLUMNS = [
  "email_cliente",
  "nombre_cliente",
  "telefono",
  "direccion",
  "email",
  "nombre",
  "telefono_cliente",
];

const OUTPUT_COLUMNS = [
  "id_pedido",
  "fecha",
  "producto",
  "categoria",
  "cantidad",
  "precio",
  "estado_pago",
  "estado_envio",
  "motivo_cancelacion",
  "ingreso",
  "churn",
  "margen_neto",
  "costo_unitario",
  "costo_envio",
  "envio_cobrado",
  "metodo_pago",
];

export interface UploadResult {
  cliente: string;
  pedidos: number;
  pagados: number;
  cancelados: number;
  categorias: number;
  updated: boolean;
  origen: "csv" | "xlsx" | "google_sheets";
}

export function sanitizeCliente(raw: string): string {
  const clean = raw
    .trim()
    .toLowerCase()
    .replace(/\.(csv|xlsx|xls)$/i, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
  return clean;
}

export function parseCsvText(text: string): Record<string, unknown>[] {
  return parseCsv(text, {
    columns: true,
    skip_empty_lines: true,
    skip_records_with_empty_values: true,
    relax_column_count: true,
    trim: true,
    bom: true,
  }) as Record<string, unknown>[];
}

export function parseBuffer(buffer: Uint8Array): Record<string, unknown>[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: "",
    raw: false,
  });
  if (raw.length === 0) return [];
  const headers = (raw[0] as unknown[]).map((h) => String(h ?? ""));
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < raw.length; i++) {
    const cells = raw[i] as unknown[];
    const row: Record<string, unknown> = {};
    for (let c = 0; c < headers.length; c++) {
      if (headers[c]) row[headers[c]] = cells[c] ?? "";
    }
    if (Object.keys(row).length > 0) rows.push(row);
  }
  return rows;
}

export function extractGoogleSheetsId(url: string): string | null {
  const trimmed = url.trim();
  const fromPath = trimmed.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (fromPath) return fromPath[1];
  if (/^[a-zA-Z0-9-_]{15,}$/.test(trimmed)) return trimmed;
  return null;
}

export async function fetchGoogleSheetsCsv(url: string): Promise<string> {
  const id = extractGoogleSheetsId(url);
  if (!id) throw new Error("URL de Google Sheets no válida");
  const exportUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`;
  const res = await fetch(exportUrl, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error("No se pudo descargar la planilla (¿es pública?)");
  return await res.text();
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  const s = String(v ?? "")
    .trim()
    .replace(/\$/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function toInt(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.round(n) || 1;
}

function toFecha(v: unknown): string {
  if (typeof v === "number") {
    const base = new Date(25569 * 86400 * 1000);
    const d = new Date(base.getTime() + v * 86400 * 1000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return "";
}

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const ALIAS_HEADERS: Record<string, string> = {
  id_pedido: "id_pedido",
  pedido: "id_pedido",
  numero_pedido: "id_pedido",
  numero_de_pedido: "id_pedido",
  n_de_pedido: "id_pedido",
  n_orden: "id_pedido",
  order_id: "id_pedido",
  id_orden: "id_pedido",
  codigo_pedido: "id_pedido",
  orden: "id_pedido",
  fecha: "fecha",
  fecha_pedido: "fecha",
  fecha_creacion: "fecha",
  producto: "producto",
  nombre_producto: "producto",
  nombre_del_producto: "producto",
  articulo: "producto",
  categoria: "categoria",
  categoria_producto: "categoria",
  tipo_producto: "categoria",
  cantidad: "cantidad",
  qty: "cantidad",
  unidades: "cantidad",
  precio: "precio",
  precio_unitario: "precio",
  precio_total: "precio",
  precio_final: "precio",
  monto: "precio",
  monto_total: "precio",
  importe: "precio",
  estado_pago: "estado_pago",
  estado_del_pago: "estado_pago",
  estado_de_pago: "estado_pago",
  estado_pago_pedido: "estado_pago",
  estado_pedido: "estado_pago",
  estado: "estado_pago",
  status: "estado_pago",
  pago: "estado_pago",
  estado_envio: "estado_envio",
  estado_del_envio: "estado_envio",
  estado_de_envio: "estado_envio",
  estado_del_shipping: "estado_envio",
  envio: "estado_envio",
  motivo_cancelacion: "motivo_cancelacion",
  motivo_de_cancelacion: "motivo_cancelacion",
  motivo_cancelacion_pedido: "motivo_cancelacion",
  cancelado: "motivo_cancelacion",
  ingreso: "ingreso",
  ingresos: "ingreso",
  ingreso_total: "ingreso",
  importe_total: "ingreso",
  monto_ingreso: "ingreso",
  churn: "churn",
  perdida: "churn",
  perdido: "churn",
  margen_neto: "margen_neto",
  margen: "margen_neto",
  ganancia_neta: "margen_neto",
  beneficio: "margen_neto",
  costo_unitario: "costo_unitario",
  costo: "costo_unitario",
  costo_producto: "costo_unitario",
  costo_envio: "costo_envio",
  costo_de_envio: "costo_envio",
  envio_cobrado: "envio_cobrado",
  envio_cobrado_cliente: "envio_cobrado",
  metodo_pago: "metodo_pago",
  medio_de_pago: "metodo_pago",
  medio_pago: "metodo_pago",
  forma_de_pago: "metodo_pago",
  pago_metodo: "metodo_pago",
};

function normalizeHeaders(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
      const key = stripAccents(k.trim())
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");
      if (!key) continue;
      const canonical = ALIAS_HEADERS[key] ?? key;
      if (ANONYMIZE_COLUMNS.includes(canonical)) continue;
      out[canonical] = v;
    }
    return out;
  });
}

function headersRecognized(rows: Record<string, unknown>[]): boolean {
  if (rows.length === 0) return false;
  const sample = rows[0];
  const known = new Set(Object.values(ALIAS_HEADERS));
  const present = Object.keys(sample).filter((k) => known.has(k));
  return present.length >= 3;
}

function cleanRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const col of OUTPUT_COLUMNS) {
      out[col] = r[col] ?? "";
    }
    out["id_pedido"] = (() => {
      const v = out["id_pedido"];
      const n = Number(v);
      return v !== "" && Number.isFinite(n) ? n : String(v ?? "");
    })();
    out["precio"] = toNumber(out["precio"]);
    out["cantidad"] = toInt(out["cantidad"]);
    out["fecha"] = toFecha(out["fecha"]);
    for (const col of [
      "ingreso",
      "churn",
      "margen_neto",
      "costo_unitario",
      "costo_envio",
      "envio_cobrado",
    ]) {
      out[col] = toNumber(out[col]);
    }
    out["metodo_pago"] = String(out["metodo_pago"] ?? "").trim();
    for (const col of ["estado_pago", "estado_envio", "motivo_cancelacion"]) {
      out[col] = String(out[col] ?? "").trim().toLowerCase();
    }
    if (typeof out["producto"] === "number") out["producto"] = String(out["producto"]);
    if (typeof out["categoria"] === "number") out["categoria"] = String(out["categoria"]);
    out["producto"] = String(out["producto"] ?? "").trim();
    out["categoria"] = String(out["categoria"] ?? "").trim();
    return out;
  });
}

const PAGADOS = new Set(["pagado", "pagada", "paid", "completed"]);

function computeHallazgos(
  rows: Record<string, unknown>[],
  cliente: string
): Record<string, unknown> {
  const total = rows.length;
  const pagados = rows.filter((r) => PAGADOS.has(String(r.estado_pago)));
  const cancelados = rows.filter((r) => !PAGADOS.has(String(r.estado_pago)));

  const catMap = new Map<string, number>();
  for (const r of rows) {
    const c = String(r.categoria);
    if (c) catMap.set(c, (catMap.get(c) ?? 0) + 1);
  }
  const categorias = [...catMap.entries()]
    .map(([nombre, pedidos]) => ({
      nombre,
      pedidos,
      pct: total > 0 ? Math.round((pedidos / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.pct - a.pct);

  const motivoCount = new Map<string, number>();
  for (const r of cancelados) {
    const m = String(r.motivo_cancelacion).trim();
    if (m) motivoCount.set(m, (motivoCount.get(m) ?? 0) + 1);
  }
  const motivosTop = [...motivoCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([motivo, cantidad]) => ({ motivo, cantidad }));

  const ventas = new Map<string, number>();
  for (const r of pagados) {
    const p = String(r.producto);
    const v = Number(r.precio) || 0;
    ventas.set(p, (ventas.get(p) ?? 0) + v);
  }
  const sorted = [...ventas.entries()].sort((a, b) => b[1] - a[1]);
  const topProd = sorted.slice(0, 10).map(([p]) => p);
  const criticos = sorted.slice(-5).map(([p]) => p);

  return {
    cliente,
    total_pedidos: total,
    pagados: pagados.length,
    cancelados: cancelados.length,
    tasa_cancelacion_pct:
      total > 0 ? Math.round((cancelados.length / total) * 1000) / 10 : 0,
    categorias,
    cancelaciones: {
      pct: total > 0 ? Math.round((cancelados.length / total) * 1000) / 10 : 0,
      motivos_top: motivosTop,
    },
    productos_top: topProd,
    productos_criticos: criticos,
  };
}

function computeFinanzas(
  rows: Record<string, unknown>[],
  cliente: string,
  avail: {
    hasIngreso: boolean;
    hasChurn: boolean;
    hasCosto: boolean;
    hasMargenNeto: boolean;
    hasEnvioCobrado: boolean;
    hasMetodoPago: boolean;
  }
): Record<string, unknown> {
  const pagados = rows.filter((r) => PAGADOS.has(String(r.estado_pago)));
  const cancelados = rows.filter((r) => !PAGADOS.has(String(r.estado_pago)));

  const { hasIngreso, hasChurn, hasCosto, hasMargenNeto, hasEnvioCobrado, hasMetodoPago } = avail;

  const cantidad = (r: Record<string, unknown>) => Number(r.cantidad) || 1;
  const dinero = (r: Record<string, unknown>): { ingreso: number; churn: number } => {
    const paid = PAGADOS.has(String(r.estado_pago));
    if (hasIngreso) {
      const inc = toNumber(r.ingreso);
      if (hasChurn)
        return { ingreso: paid ? inc : 0, churn: paid ? 0 : toNumber(r.churn) };
      return { ingreso: paid ? inc : 0, churn: paid ? 0 : inc };
    }
    const base = (Number(r.precio) || 0) * cantidad(r) + toNumber(r.envio_cobrado);
    return { ingreso: paid ? base : 0, churn: paid ? 0 : base };
  };

  const ingresoTotal = rows.reduce((s, r) => s + dinero(r).ingreso, 0);
  const churnTotal = rows.reduce((s, r) => s + dinero(r).churn, 0);
  const ticket = pagados.length > 0 ? ingresoTotal / pagados.length : 0;

  const catStats = new Map<
    string,
    { pedidos: number; ingresos: number; churn: number; cancelados: number }
  >();
  const serieMap = new Map<string, { ingresos: number; churn: number; pedidos: number }>();
  for (const r of rows) {
    const c = String(r.categoria);
    const d = dinero(r);
    if (c) {
      const st = catStats.get(c) ?? { pedidos: 0, ingresos: 0, churn: 0, cancelados: 0 };
      st.pedidos += 1;
      st.ingresos += d.ingreso;
      st.churn += d.churn;
      if (!PAGADOS.has(String(r.estado_pago))) st.cancelados += 1;
      catStats.set(c, st);
    }
    const fecha = String(r.fecha || "").slice(0, 10);
    if (fecha) {
      const dp = serieMap.get(fecha) ?? { ingresos: 0, churn: 0, pedidos: 0 };
      dp.pedidos += 1;
      dp.ingresos += d.ingreso;
      dp.churn += d.churn;
      serieMap.set(fecha, dp);
    }
  }

  const margenCat = [...catStats.entries()]
    .map(([categoria, st]) => ({
      categoria,
      pedidos: st.pedidos,
      ingresos_ars: round2(st.ingresos),
      churn_ars: round2(st.churn),
      margen_estimado_pct:
        st.pedidos > 0
          ? Number((Math.round((1 - st.cancelados / st.pedidos) * 1000) / 10).toFixed(1))
          : 0,
    }))
    .sort((a, b) => b.margen_estimado_pct - a.margen_estimado_pct);

  const totalMargen = margenCat.reduce((s, c) => s + c.ingresos_ars, 0);
  const top80: string[] = [];
  let acum = 0;
  for (const c of margenCat) {
    if (totalMargen > 0) {
      acum += c.ingresos_ars;
      if (acum / totalMargen <= 0.85) top80.push(c.categoria);
    }
  }
  if (top80.length === 0 && margenCat.length > 0) top80.push(margenCat[0].categoria);

  const costoTotal = hasCosto
    ? round2(
        rows.reduce(
          (s, r) =>
            s + (Number(r.costo_unitario) || 0) * cantidad(r) + (Number(r.costo_envio) || 0),
          0
        )
      )
    : 0;
  const envioCobradoTotal = hasEnvioCobrado
    ? round2(rows.reduce((s, r) => s + (Number(r.envio_cobrado) || 0), 0))
    : 0;
  const envioCostoTotal = hasCosto
    ? round2(rows.reduce((s, r) => s + (Number(r.costo_envio) || 0), 0))
    : 0;
  const margenNetoCol = hasMargenNeto
    ? round2(rows.reduce((s, r) => s + (Number(r.margen_neto) || 0), 0))
    : 0;
  const utilidadNeta = round2(ingresoTotal - churnTotal - costoTotal);
  const margenNetoPct =
    ingresoTotal > 0 ? Number((Math.round((utilidadNeta / ingresoTotal) * 1000) / 10).toFixed(1)) : 0;

  const metodoMap = new Map<string, number>();
  for (const r of rows) {
    const m = String(r.metodo_pago ?? "").trim();
    if (m) metodoMap.set(m, (metodoMap.get(m) ?? 0) + 1);
  }
  const metodosPago = [...metodoMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([metodo, pedidos]) => ({
      metodo,
      pedidos,
      pct:
        rows.length > 0 ? Number((Math.round((pedidos / rows.length) * 1000) / 10).toFixed(1)) : 0,
    }));

  const serieDiaria = [...serieMap.entries()]
    .map(([fecha, dp]) => ({ fecha, ...dp }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const acciones: string[] = [];
  if (churnTotal > 0) {
    acciones.push(
      `Recuperar $${Math.trunc(churnTotal).toLocaleString("en-US")} ARS de cancelaciones: contactar los 10 clientes mas recientes cancelados con 10% OFF`
    );
  }
  if (margenCat.length > 0) {
    const mejor = margenCat[0];
    acciones.push(
      `Focalizar marketing en '${mejor.categoria}' (margen ${mejor.margen_estimado_pct.toFixed(1)}%, $${Math.trunc(mejor.ingresos_ars).toLocaleString("en-US")} ARS)`
    );
  }
  if (margenCat.length > 1) {
    const peor = margenCat[margenCat.length - 1];
    if (peor.churn_ars > 0) {
      acciones.push(
        `Revisar '${peor.categoria}': $${Math.trunc(peor.churn_ars).toLocaleString("en-US")} ARS perdidos, considerar pausar o ajustar precio`
      );
    }
  }
  if (hasCosto && costoTotal > 0) {
    acciones.push(
      `Optimizar costos: $${Math.trunc(costoTotal).toLocaleString("en-US")} ARS en costo de mercaderia y envio, negociar con proveedores o carrier`
    );
  }
  if (acciones.length === 0) acciones.push("Datos insuficientes para generar acciones automaticas");

  const finanzas: Record<string, unknown> = {
    cliente,
    ticket_promedio_ars: round2(ticket),
    ingresos_total_ars: round2(ingresoTotal),
    churn_ars: round2(churnTotal),
    margen_por_categoria: margenCat,
    top_80_20: top80,
    acciones,
  };

  if (hasCosto || hasMargenNeto || hasEnvioCobrado) {
    finanzas.margen_neto_pct = margenNetoPct;
  }
  if (hasCosto) {
    finanzas.costo_total_ars = costoTotal;
    finanzas.envio_costo_total_ars = envioCostoTotal;
    finanzas.utilidad_neta_ars = utilidadNeta;
  } else if (hasMargenNeto) {
    finanzas.utilidad_neta_ars = margenNetoCol;
  }
  if (hasEnvioCobrado) finanzas.envio_cobrado_total_ars = envioCobradoTotal;
  if (hasMetodoPago) finanzas.metodo_pago = metodosPago;
  finanzas.serie_diaria = serieDiaria;

  return finanzas;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface ColumnFlags {
  hasIngreso: boolean;
  hasChurn: boolean;
  hasCosto: boolean;
  hasMargenNeto: boolean;
  hasEnvioCobrado: boolean;
  hasMetodoPago: boolean;
}

export interface AnalisisResult {
  clean: Record<string, unknown>[];
  hallazgos: Record<string, unknown>;
  finanzas: Record<string, unknown>;
  avail: ColumnFlags;
}

export function analizeRows(
  cliente: string,
  rows: Record<string, unknown>[]
): AnalisisResult {
  const normalized = normalizeHeaders(rows);
  if (!headersRecognized(normalized)) {
    throw new Error(
      `No se reconocieron las columnas del archivo. El CSV/planilla necesita al menos 3 de estas columnas: ${REQUIRED_COLUMNS.join(
        ", "
      )}`
    );
  }
  const clean = cleanRows(normalized).filter(
    (r) => String(r.producto).trim() !== "" || (r.precio as number) > 0
  );
  const avail: ColumnFlags = {
    hasIngreso: Object.prototype.hasOwnProperty.call(normalized[0] ?? {}, "ingreso"),
    hasChurn: Object.prototype.hasOwnProperty.call(normalized[0] ?? {}, "churn"),
    hasCosto:
      Object.prototype.hasOwnProperty.call(normalized[0] ?? {}, "costo_unitario") ||
      Object.prototype.hasOwnProperty.call(normalized[0] ?? {}, "costo_envio"),
    hasMargenNeto: Object.prototype.hasOwnProperty.call(normalized[0] ?? {}, "margen_neto"),
    hasEnvioCobrado: Object.prototype.hasOwnProperty.call(
      normalized[0] ?? {},
      "envio_cobrado"
    ),
    hasMetodoPago: Object.prototype.hasOwnProperty.call(normalized[0] ?? {}, "metodo_pago"),
  };
  return {
    clean,
    hallazgos: computeHallazgos(clean, cliente),
    finanzas: computeFinanzas(clean, cliente, avail),
    avail,
  };
}

export function csvSerialize(
  headers: string[],
  rows: Record<string, unknown>[]
): Uint8Array {
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(esc).join(",")];
  for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(","));
  return new TextEncoder().encode(lines.join("\n"));
}