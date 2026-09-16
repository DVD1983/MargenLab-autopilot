#!/usr/bin/env python3
"""
MargenLab Autopilot - Pipeline de referencia en Python.
Implementacion independiente (misma especificacion) del analisis TS de
src/lib/pipeline.ts. Se usa para validacion cruzada TS <-> Python.

Uso (lib):
    import margenlab_pipeline as mp
    res = mp.analyze("cliente", df_rows)   # df iterable de dicts ya normalizados
    res = mp.analyze_file("data/uploads/x.csv")
"""

import json
import math
import os
import re
import unicodedata
from datetime import datetime, timedelta

import pandas as pd

PAGADOS = {"pagado", "pagada", "paid", "completed"}

OUTPUT_COLUMNS = [
    "id_pedido", "fecha", "producto", "categoria", "cantidad", "precio",
    "estado_pago", "estado_envio", "motivo_cancelacion", "ingreso", "churn",
    "margen_neto", "costo_unitario", "costo_envio", "envio_cobrado", "metodo_pago",
]

REQUIRED_COLUMNS = [
    "id_pedido", "fecha", "producto", "categoria", "cantidad", "precio",
    "estado_pago", "estado_envio",
]

ANONYMIZE_COLUMNS = {
    "email_cliente", "nombre_cliente", "telefono", "direccion",
    "email", "nombre", "telefono_cliente",
}

# Mismo mapa de aliases que el pipeline TS
ALIAS_HEADERS = {
    "id_pedido": "id_pedido", "pedido": "id_pedido", "numero_pedido": "id_pedido",
    "numero_de_pedido": "id_pedido", "n_de_pedido": "id_pedido", "n_orden": "id_pedido",
    "order_id": "id_pedido", "id_orden": "id_pedido", "codigo_pedido": "id_pedido",
    "orden": "id_pedido", "fecha": "fecha", "fecha_pedido": "fecha",
    "fecha_creacion": "fecha", "producto": "producto", "nombre_producto": "producto",
    "nombre_del_producto": "producto", "articulo": "producto", "categoria": "categoria",
    "categoria_producto": "categoria", "tipo_producto": "categoria", "cantidad": "cantidad",
    "qty": "cantidad", "unidades": "cantidad", "precio": "precio",
    "precio_unitario": "precio", "precio_total": "precio", "precio_final": "precio",
    "monto": "precio", "monto_total": "precio", "importe": "precio",
    "estado_pago": "estado_pago", "estado_del_pago": "estado_pago",
    "estado_de_pago": "estado_pago", "estado_pago_pedido": "estado_pago",
    "estado_pedido": "estado_pago", "estado": "estado_pago", "status": "estado_pago",
    "pago": "estado_pago", "estado_envio": "estado_envio",
    "estado_del_envio": "estado_envio", "estado_de_envio": "estado_envio",
    "estado_del_shipping": "estado_envio", "envio": "estado_envio",
    "motivo_cancelacion": "motivo_cancelacion", "motivo_de_cancelacion": "motivo_cancelacion",
    "motivo_cancelacion_pedido": "motivo_cancelacion", "cancelado": "motivo_cancelacion",
    "ingreso": "ingreso", "ingresos": "ingreso", "ingreso_total": "ingreso",
    "importe_total": "ingreso", "monto_ingreso": "ingreso", "churn": "churn",
    "perdida": "churn", "perdido": "churn", "margen_neto": "margen_neto",
    "margen": "margen_neto", "ganancia_neta": "margen_neto", "beneficio": "margen_neto",
    "costo_unitario": "costo_unitario", "costo": "costo_unitario",
    "costo_producto": "costo_unitario", "costo_envio": "costo_envio",
    "costo_de_envio": "costo_envio", "envio_cobrado": "envio_cobrado",
    "envio_cobrado_cliente": "envio_cobrado", "metodo_pago": "metodo_pago",
    "medio_de_pago": "metodo_pago", "medio_pago": "metodo_pago",
    "forma_de_pago": "metodo_pago", "pago_metodo": "metodo_pago",
}


def strip_accents(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    )


def ts_round(x: float, decimals: int = 1) -> float:
    """Emula Math.round: mitad hacia arriba (no banker's rounding)."""
    factor = 10 ** decimals
    return math.floor(x * factor + 0.5) / factor


def round2(x: float) -> float:
    return math.floor(x * 100 + 0.5) / 100


def to_number(v) -> float:
    if isinstance(v, (int, float)):
        return float(v) if v else 0.0
    s = str(v).strip().replace("$", "").replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return 0.0


def to_int(v) -> int:
    try:
        n = float(v)
    except (TypeError, ValueError):
        return 1
    if not math.isfinite(n):
        return 1
    r = int(round(n))
    return r if r else 1


def to_fecha(v) -> str:
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        base = datetime(1899, 12, 30) + timedelta(days=float(v))
        return base.strftime("%Y-%m-%d")
    s = str(v).strip()
    if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
        return s
    try:
        return datetime.fromisoformat(s[:10]).strftime("%Y-%m-%d")
    except ValueError:
        return ""


def normalize(key: str) -> str:
    k = strip_accents(key.strip()).lower()
    k = re.sub(r"\s+", "_", k)
    k = re.sub(r"[^a-z0-9_]+", "_", k)
    k = re.sub(r"_+", "_", k)
    return k.strip("_")


def normalize_headers(rows: list) -> list:
    out_rows = []
    for r in rows:
        out = {}
        for k, v in r.items():
            key = normalize(str(k))
            if not key:
                continue
            canonical = ALIAS_HEADERS.get(key, key)
            if canonical in ANONYMIZE_COLUMNS:
                continue
            out[canonical] = v
        out_rows.append(out)
    return out_rows


def headers_recognized(rows: list) -> bool:
    if not rows:
        return False
    known = set(ALIAS_HEADERS.values())
    present = [k for k in rows[0].keys() if k in known]
    return len(present) >= 3


def clean_rows(rows: list) -> list:
    cleaned = []
    for r in rows:
        out = {c: (r.get(c, "") if r.get(c) is not None else "") for c in OUTPUT_COLUMNS}
        if out["id_pedido"] != "":
            try:
                n = float(out["id_pedido"])
                out["id_pedido"] = int(n) if n.is_integer() else n
            except (TypeError, ValueError):
                out["id_pedido"] = str(out["id_pedido"])
        out["precio"] = to_number(out["precio"])
        out["cantidad"] = to_int(out["cantidad"])
        out["fecha"] = to_fecha(out["fecha"])
        for c in ("ingreso", "churn", "margen_neto", "costo_unitario",
                  "costo_envio", "envio_cobrado"):
            out[c] = to_number(out[c])
        out["metodo_pago"] = str(out["metodo_pago"]).strip()
        for c in ("estado_pago", "estado_envio", "motivo_cancelacion"):
            out[c] = str(out[c]).strip().lower()
        if isinstance(out["producto"], (int, float)) or isinstance(out["categoria"], (int, float)):
            pass
        out["producto"] = str(out["producto"]).strip() if out["producto"] else ""
        out["categoria"] = str(out["categoria"]).strip() if out["categoria"] else ""
        cleaned.append(out)
    return cleaned


def compute_hallazgos(rows: list, cliente: str) -> dict:
    total = len(rows)
    pagados = [r for r in rows if r["estado_pago"] in PAGADOS]
    cancelados = [r for r in rows if r["estado_pago"] not in PAGADOS]

    cat_order = []
    cat_counts = {}
    for r in rows:
        c = str(r["categoria"])
        if c:
            if c not in cat_counts:
                cat_order.append(c)
                cat_counts[c] = 0
            cat_counts[c] += 1
    cats = [
        {
            "nombre": c,
            "pedidos": cat_counts[c],
            "pct": ts_round(cat_counts[c] / total * 100, 1) if total > 0 else 0,
        }
        for c in cat_order
    ]
    cats.sort(key=lambda x: x["pct"], reverse=True)

    motivo_counts = {}
    motivo_order = []
    for r in cancelados:
        m = str(r.get("motivo_cancelacion", "")).strip()
        if m:
            if m not in motivo_counts:
                motivo_order.append(m)
                motivo_counts[m] = 0
            motivo_counts[m] += 1
    motivos_top = sorted(
        ([m, motivo_counts[m]] for m in motivo_order), key=lambda x: x[1], reverse=True
    )[:5]

    ventas = {}
    ventas_order = []
    for r in pagados:
        p = str(r["producto"])
        v = to_number(r["precio"])
        if p not in ventas:
            ventas_order.append(p)
            ventas[p] = 0
        ventas[p] += v
    sorted_v = sorted(((p, ventas[p]) for p in ventas_order),
                      key=lambda x: x[1], reverse=True)
    top_prod = [p for p, _ in sorted_v[:10]]
    criticos = [p for p, _ in sorted_v[-5:]]

    tasa = ts_round(len(cancelados) / total * 100, 1) if total > 0 else 0
    return {
        "cliente": cliente, "total_pedidos": total, "pagados": len(pagados),
        "cancelados": len(cancelados), "tasa_cancelacion_pct": tasa,
        "categorias": cats,
        "cancelaciones": {"pct": tasa,
                          "motivos_top": [{"motivo": m, "cantidad": c} for m, c in motivos_top]},
        "productos_top": top_prod, "productos_criticos": criticos,
    }


def compute_finanzas(rows: list, cliente: str, avail: dict) -> dict:
    has_ingreso = avail["has_ingreso"]
    has_churn = avail["has_churn"]
    has_costo = avail["has_costo"]
    has_margen_neto = avail["has_margen_neto"]
    has_envio_cobrado = avail["has_envio_cobrado"]
    has_metodo_pago = avail["has_metodo_pago"]

    def cant(r):
        return float(r["cantidad"]) or 1.0

    def dinero(r):
        paid = r["estado_pago"] in PAGADOS
        if has_ingreso:
            inc = to_number(r["ingreso"])
            if has_churn:
                return (inc if paid else 0.0, to_number(r["churn"]) if not paid else 0.0)
            return (inc if paid else 0.0, inc if not paid else 0.0)
        base = to_number(r["precio"]) * cant(r) + to_number(r["envio_cobrado"])
        return (base if paid else 0.0, base if not paid else 0.0)

    pagados = [r for r in rows if r["estado_pago"] in PAGADOS]
    ingreso_total = sum(dinero(r)[0] for r in rows)
    churn_total = sum(dinero(r)[1] for r in rows)
    ticket = round2(ingreso_total / len(pagados)) if pagados else 0.0

    cat_order = []
    cat_stats = {}
    serie_order = []
    serie_map = {}
    for r in rows:
        inc, churn = dinero(r)
        c = str(r["categoria"])
        if c:
            if c not in cat_stats:
                cat_order.append(c)
                cat_stats[c] = {"pedidos": 0, "ingresos": 0.0, "churn": 0.0, "cancelados": 0}
            st = cat_stats[c]
            st["pedidos"] += 1
            st["ingresos"] += inc
            st["churn"] += churn
            if r["estado_pago"] not in PAGADOS:
                st["cancelados"] += 1
        fecha = str(r.get("fecha") or "")[:10]
        if fecha:
            if fecha not in serie_map:
                serie_order.append(fecha)
                serie_map[fecha] = {"ingresos": 0.0, "churn": 0.0, "pedidos": 0}
            dp = serie_map[fecha]
            dp["pedidos"] += 1
            dp["ingresos"] += inc
            dp["churn"] += churn

    margen_cat = [
        {
            "categoria": c,
            "pedidos": st["pedidos"],
            "ingresos_ars": round2(st["ingresos"]),
            "churn_ars": round2(st["churn"]),
            "margen_estimado_pct": ts_round((1 - st["cancelados"] / st["pedidos"]) * 100, 1)
            if st["pedidos"] > 0 else 0,
        }
        for c, st in cat_stats.items()
    ]
    margen_cat.sort(key=lambda x: x["margen_estimado_pct"], reverse=True)

    total_margen = sum(c["ingresos_ars"] for c in margen_cat)
    top80 = []
    acum = 0.0
    for c in margen_cat:
        if total_margen > 0:
            acum += c["ingresos_ars"]
            if acum / total_margen <= 0.85:
                top80.append(c["categoria"])
    if not top80 and margen_cat:
        top80.append(margen_cat[0]["categoria"])

    costo_total = round2(sum(
        to_number(r["costo_unitario"]) * cant(r) + to_number(r["costo_envio"]) for r in rows
    )) if has_costo else 0.0
    envio_cobrado_total = round2(sum(to_number(r["envio_cobrado"]) for r in rows)) if has_envio_cobrado else 0.0
    envio_costo_total = round2(sum(to_number(r["costo_envio"]) for r in rows)) if has_costo else 0.0
    margen_neto_col = round2(sum(to_number(r["margen_neto"]) for r in rows)) if has_margen_neto else 0.0
    utilidad_neta = round2(ingreso_total - churn_total - costo_total)
    margen_neto_pct = ts_round(utilidad_neta / ingreso_total * 100, 1) if ingreso_total > 0 else 0.0

    metodo_counts = {}
    metodo_order = []
    for r in rows:
        m = str(r["metodo_pago"]).strip()
        if m:
            if m not in metodo_counts:
                metodo_order.append(m)
                metodo_counts[m] = 0
            metodo_counts[m] += 1
    metodos_pago = [
        {"metodo": m, "pedidos": metodo_counts[m],
         "pct": ts_round(metodo_counts[m] / len(rows) * 100, 1) if rows else 0}
        for m in sorted(metodo_order, key=lambda x: metodo_counts[x], reverse=True)
    ][:5]

    serie_diaria = [
        {"fecha": f, **serie_map[f]} for f in sorted(serie_order)
    ]

    acciones = []
    if churn_total > 0:
        acciones.append(
            f"Recuperar ${int(churn_total):,} ARS de cancelaciones: "
            f"contactar los 10 clientes mas recientes cancelados con 10% OFF"
        )
    if margen_cat:
        mejor = margen_cat[0]
        acciones.append(
            f"Focalizar marketing en '{mejor['categoria']}' "
            f"(margen {mejor['margen_estimado_pct']:.1f}%, ${int(mejor['ingresos_ars']):,} ARS)"
        )
    if len(margen_cat) > 1:
        peor = margen_cat[-1]
        if peor["churn_ars"] > 0:
            acciones.append(
                f"Revisar '{peor['categoria']}': ${int(peor['churn_ars']):,} ARS perdidos, "
                f"considerar pausar o ajustar precio"
            )
    if has_costo and costo_total > 0:
        acciones.append(
            f"Optimizar costos: ${int(costo_total):,} ARS en costo de mercaderia y envio, "
            f"negociar con proveedores o carrier"
        )
    if not acciones:
        acciones.append("Datos insuficientes para generar acciones automaticas")

    finanzas = {
        "cliente": cliente, "ticket_promedio_ars": ticket,
        "ingresos_total_ars": round2(ingreso_total), "churn_ars": round2(churn_total),
        "margen_por_categoria": margen_cat, "top_80_20": top80, "acciones": acciones,
    }
    if has_costo or has_margen_neto or has_envio_cobrado:
        finanzas["margen_neto_pct"] = margen_neto_pct
    if has_costo:
        finanzas["costo_total_ars"] = costo_total
        finanzas["envio_costo_total_ars"] = envio_costo_total
        finanzas["utilidad_neta_ars"] = utilidad_neta
    elif has_margen_neto:
        finanzas["utilidad_neta_ars"] = margen_neto_col
    if has_envio_cobrado:
        finanzas["envio_cobrado_total_ars"] = envio_cobrado_total
    if has_metodo_pago:
        finanzas["metodo_pago"] = metodos_pago
    finanzas["serie_diaria"] = serie_diaria
    return finanzas


def read_rows(path: str) -> list:
    ext = os.path.splitext(path)[1].lower()
    if ext in (".xlsx", ".xls"):
        df = pd.read_excel(path, dtype=object, keep_default_na=False)
    else:
        df = pd.read_csv(path, dtype=str, keep_default_na=False, encoding="utf-8-sig")
    return df.to_dict(orient="records")


def analyze(cliente: str, rows: list) -> dict:
    normalized = normalize_headers(rows)
    if not headers_recognized(normalized):
        raise ValueError("No se reconocieron las columnas del archivo. "
                         "Necesita al menos 3 de: " + ", ".join(REQUIRED_COLUMNS))
    clean = [r for r in clean_rows(normalized)
             if str(r["producto"]).strip() != "" or to_number(r["precio"]) > 0]
    first = normalized[0] if normalized else {}
    avail = {
        "has_ingreso": "ingreso" in first,
        "has_churn": "churn" in first,
        "has_costo": "costo_unitario" in first or "costo_envio" in first,
        "has_margen_neto": "margen_neto" in first,
        "has_envio_cobrado": "envio_cobrado" in first,
        "has_metodo_pago": "metodo_pago" in first,
    }
    return {
        "clean": clean,
        "hallazgos": compute_hallazgos(clean, cliente),
        "finanzas": compute_finanzas(clean, cliente, avail),
    }


def analyze_file(path: str) -> dict:
    cliente = os.path.splitext(os.path.basename(path))[0]
    return analyze(cliente, read_rows(path))


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Uso: python margenlab_pipeline.py <archivo.csv|xlsx>")
        sys.exit(1)
    result = analyze_file(sys.argv[1])
    print(json.dumps({"ok": True, "cliente": result["finanzas"]["cliente"]}))