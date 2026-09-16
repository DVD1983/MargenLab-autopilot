import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsvText, analizeRows } from "../src/lib/pipeline.ts";

const FULL_CSV = `order_id,fecha,producto,categoria,cantidad,precio_unitario,costo_unitario,costo_envio,envio_cobrado,estado,motivo_cancelacion,ingreso,churn,margen_neto,metodo_pago
1,2024-10-15,Vela Citricos,Velas,2,5000,1500,200,300,pagado,,10300,0,7400,Transferencia
2,2024-10-16,Jabon Avena,Jabones,1,3000,800,150,150,cancelado,Precio,0,3150,-2150,MercadoPago
3,2024-10-16,Vela Citricos,Velas,1,6000,1800,250,250,pagado,,6250,0,3950,Tarjeta`;

const BASIC_CSV = `id_pedido,fecha,producto,categoria,cantidad,precio,estado
1,2026-01-01,Vela,Velas,2,5000,pagado
2,2026-01-02,Jabon,Jabones,1,3000,cancelado`;

const ACCENTS_CSV = `N.º de pedido,Fecha,Nombre del producto,Categoría,Cantidad,Precio unitario,Estado del pago,Motivo de cancelación
1,2026-01-01,Vela,Velas,1,5000,PAGADO,`;

const PRICE_FORMAT_CSV = `pedido,fecha,producto,categoria,cantidad,precio,estado
1,2026-01-01,Vela,Velas,2,"$4.299,90",pagado`;

function fin(rows: string) {
  return analizeRows("test", parseCsvText(rows)).finanzas;
}
function hall(rows: string) {
  return analizeRows("test", parseCsvText(rows)).hallazgos;
}

test("formato completo: todo matchea valores calculados a mano", () => {
  const f = fin(FULL_CSV);
  assert.equal(f["ingresos_total_ars"], 16550); // 10300 + 6250
  assert.equal(f["churn_ars"], 3150);
  assert.equal(f["ticket_promedio_ars"], 8275); // 16550 / 2
  assert.equal(f["costo_total_ars"], 6200); // (1500*2+200)+(800*1+150)+(1800*1+250)
  assert.equal(f["envio_cobrado_total_ars"], 700);
  assert.equal(f["envio_costo_total_ars"], 600);
  assert.equal(f["utilidad_neta_ars"], 7200); // 16550 - 3150 - 6200
  assert.equal(f["margen_neto_pct"], 43.5); // 7200/16550

  const cats = f["margen_por_categoria"] as { categoria: string; pedidos: number; ingresos_ars: number; churn_ars: number; margen_estimado_pct: number }[];
  const velas = cats.find((c) => c.categoria === "Velas");
  const jabones = cats.find((c) => c.categoria === "Jabones");
  assert.equal(velas?.pedidos, 2);
  assert.equal(velas?.ingresos_ars, 16550);
  assert.equal(velas?.churn_ars, 0);
  assert.equal(velas?.margen_estimado_pct, 100);
  assert.equal(jabones?.ingresos_ars, 0);
  assert.equal(jabones?.churn_ars, 3150);
  assert.equal(jabones?.margen_estimado_pct, 0);

  assert.deepEqual(f["top_80_20"], ["Velas"]);

  const serie = f["serie_diaria"] as { fecha: string; ingresos: number; churn: number; pedidos: number }[];
  assert.equal(serie.length, 2);
  assert.deepEqual(serie[0], { fecha: "2024-10-15", ingresos: 10300, churn: 0, pedidos: 1 });
  assert.deepEqual(serie[1], { fecha: "2024-10-16", ingresos: 6250, churn: 3150, pedidos: 2 });

  const metodos = f["metodo_pago"] as { metodo: string; pedidos: number; pct: number }[];
  assert.equal(metodos.length, 3);
  assert.deepEqual(metodos[0], { metodo: "Transferencia", pedidos: 1, pct: 33.3 });

  assert.ok(
    (f["acciones"] as string[]).some((a) => a.includes("$3,150")),
    "accion de recuperar churn usa el monto real"
  );
});

test("formato completo: conteos hallazgos", () => {
  const h = hall(FULL_CSV);
  assert.equal(h["total_pedidos"], 3);
  assert.equal(h["pagados"], 2);
  assert.equal(h["cancelados"], 1);
  assert.equal(h["tasa_cancelacion_pct"], 33.3);
});

test("fallback sin columnas de dinero: precio*cantidad", () => {
  const f = fin(BASIC_CSV);
  assert.equal(f["ingresos_total_ars"], 10000); // 2*5000
  assert.equal(f["churn_ars"], 3000);
  assert.equal(f["ticket_promedio_ars"], 10000);
  assert.equal(f["utilidad_neta_ars"], undefined);
  assert.equal(f["costo_total_ars"], undefined);
  assert.equal(f["metodo_pago"], undefined);
});

test("headings con acentos, º, mayusculas y alias", () => {
  const f = fin(ACCENTS_CSV);
  assert.equal(f["ingresos_total_ars"], 5000);
  assert.equal(f["churn_ars"], 0);
  const h = hall(ACCENTS_CSV);
  assert.equal(h["pagados"], 1);
  assert.equal(h["cancelados"], 0);
  const clean = analizeRows("test", parseCsvText(ACCENTS_CSV)).clean;
  assert.equal(clean[0]["id_pedido"], 1);
  assert.equal(clean[0]["estado_pago"], "pagado"); // PAGADO normalizado a minuscula
});

test("formato de precio $4.299,90 (con punto y coma)", () => {
  const f = fin(PRICE_FORMAT_CSV);
  assert.equal(f["ingresos_total_ars"], 8599.8); // 4299.9 * 2
});

test("estado 'cancelado' no esta en PAGADOS", () => {
  const f = fin(BASIC_CSV);
  assert.equal(f["churn_ars"], 3000);
});

test("columnas irreconocibles lanzan error claro", () => {
  assert.throws(
    () => analizeRows("test", parseCsvText(`foo,bar,baz\n1,2,3`)),
    /No se reconocieron/
  );
});

test("canalización de cancelaciones vacias no descarta filas", () => {
  const f = fin(
    `id_pedido,fecha,producto,categoria,cantidad,precio,estado_pago,motivo_cancelacion
1,2026-01-01,Vela,Velas,1,5000,pagado,
2,2026-01-02,Jabon,Jabones,1,3000,cancelado,Precio`
  );
  assert.equal(f["ingresos_total_ars"], 5000);
  assert.equal(f["churn_ars"], 3000);
});