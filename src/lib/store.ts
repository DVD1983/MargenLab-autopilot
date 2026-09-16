import { getStorage } from "@/lib/storage";

export interface Pedido {
  id_pedido: number;
  fecha: string;
  producto: string;
  categoria: string;
  cantidad: number;
  precio: number;
  estado_pago: string;
  estado_envio: string;
  motivo_cancelacion: string;
}

export interface MargenCategoria {
  categoria: string;
  pedidos: number;
  ingresos_ars: number;
  churn_ars: number;
  margen_estimado_pct: number;
}

export interface Finanzas {
  cliente: string;
  ticket_promedio_ars: number;
  ingresos_total_ars: number;
  churn_ars: number;
  margen_por_categoria: MargenCategoria[];
  top_80_20: string[];
  acciones: string[];
  costo_total_ars?: number;
  envio_cobrado_total_ars?: number;
  envio_costo_total_ars?: number;
  utilidad_neta_ars?: number;
  margen_neto_pct?: number;
  metodo_pago?: { metodo: string; pedidos: number; pct: number }[];
  serie_diaria?: DiaPoint[];
}

export interface CategoriaH {
  nombre: string;
  pedidos: number;
  pct: number;
}

export interface MotivoCancelacion {
  motivo: string;
  cantidad: number;
}

export interface Hallazgos {
  cliente: string;
  total_pedidos: number;
  pagados: number;
  cancelados: number;
  tasa_cancelacion_pct: number;
  categorias: CategoriaH[];
  cancelaciones: {
    pct: number;
    motivos_top: MotivoCancelacion[];
  };
  productos_top: string[];
  productos_criticos: string[];
}

export interface DiaPoint {
  fecha: string;
  ingresos: number;
  churn: number;
  pedidos: number;
}

export interface StoreData {
  id: string;
  finanzas: Finanzas;
  hallazgos: Hallazgos;
  orders: Pedido[];
  diario: DiaPoint[];
}

export async function listStores(): Promise<string[]> {
  return getStorage().list();
}

function buildDiario(orders: Pedido[]): DiaPoint[] {
  const byDay = new Map<string, DiaPoint>();
  for (const o of orders) {
    const day = byDay.get(o.fecha) ?? { fecha: o.fecha, ingresos: 0, churn: 0, pedidos: 0 };
    day.pedidos += 1;
    if (o.estado_pago === "pagado") day.ingresos += o.precio * o.cantidad;
    else day.churn += o.precio * o.cantidad;
    byDay.set(o.fecha, day);
  }
  return Array.from(byDay.values()).sort((a, b) =>
    a.fecha.localeCompare(b.fecha)
  );
}

export async function getStore(clientId: string): Promise<StoreData | null> {
  const stored = await getStorage().get(clientId);
  if (!stored) return null;
  const finanzas = stored.finanzas as Finanzas;
  const hallazgos = stored.hallazgos as Hallazgos;
  const orders = stored.clean as Pedido[];
  return {
    id: clientId,
    finanzas,
    hallazgos,
    orders,
    diario: finanzas.serie_diaria?.length ? finanzas.serie_diaria : buildDiario(orders),
  };
}