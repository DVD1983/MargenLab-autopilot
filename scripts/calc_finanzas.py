#!/usr/bin/env python3
"""
MargenLab Autopilot - Calculadora Financiera
Lee JSON limpio y genera:
  1. data/processed/{cliente}_hallazgos.json (para auditor/MiMo)
  2. data/processed/{cliente}_finanzas.json (para finanzas/Ling)
"""

import sys
import os
import json
import pandas as pd


def calc_hallazgos(df: pd.DataFrame, cliente: str) -> dict:
    total = len(df)
    pagados = df[df["estado_pago"].isin(["pagado", "pagada", "paid", "completed"])]
    cancelados = df[~df["estado_pago"].isin(["pagado", "pagada", "paid", "completed"])]

    cats = []
    for cat, grp in df.groupby("categoria"):
        if not cat:
            continue
        n = len(grp)
        cats.append({
            "nombre": cat,
            "pedidos": n,
            "pct": round(n / total * 100, 1)
        })
    cats.sort(key=lambda x: x["pct"], reverse=True)

    motivos = {}
    if "motivo_cancelacion" in cancelados.columns:
        for m in cancelados["motivo_cancelacion"]:
            m = str(m).strip()
            if m:
                motivos[m] = motivos.get(m, 0) + 1
    motivos_top = sorted(motivos.items(), key=lambda x: x[1], reverse=True)[:5]

    ventas_por_producto = (
        df[df["estado_pago"].isin(["pagado", "pagada", "paid", "completed"])]
        .groupby("producto")["precio"].sum().sort_values(ascending=False)
    )
    top_productos = ventas_por_producto.head(10).index.tolist()
    criticos = ventas_por_producto.tail(5).index.tolist()

    return {
        "cliente": cliente,
        "total_pedidos": total,
        "pagados": len(pagados),
        "cancelados": len(cancelados),
        "tasa_cancelacion_pct": round(len(cancelados) / total * 100, 1) if total > 0 else 0,
        "categorias": cats,
        "cancelaciones": {
            "pct": round(len(cancelados) / total * 100, 1) if total > 0 else 0,
            "motivos_top": [{"motivo": m, "cantidad": c} for m, c in motivos_top]
        },
        "productos_top": top_productos,
        "productos_criticos": criticos
    }


def calc_finanzas(df: pd.DataFrame, cliente: str) -> dict:
    pagados = df[df["estado_pago"].isin(["pagado", "pagada", "paid", "completed"])]
    cancelados = df[~df["estado_pago"].isin(["pagado", "pagada", "paid", "completed"])]

    ticket_promedio = float(pagados["precio"].mean()) if len(pagados) > 0 else 0
    ticket_promedio = round(ticket_promedio, 2)

    ingresos_total = float(pagados["precio"].sum())
    churn_ars = float(cancelados["precio"].sum())

    margen_cat = []
    for cat, grp in df.groupby("categoria"):
        if not cat:
            continue
        cat_pagados = grp[grp["estado_pago"].isin(["pagado", "pagada", "paid", "completed"])]
        cat_cancelados = grp[~grp["estado_pago"].isin(["pagado", "pagada", "paid", "completed"])]
        cat_total = len(grp)
        cat_ingresos = float(cat_pagados["precio"].sum())
        cat_churn = float(cat_cancelados["precio"].sum())

        if cat_total > 0:
            pct_cancelacion = len(cat_cancelados) / cat_total
            margen_est = round((1 - pct_cancelacion) * 100, 1)
        else:
            margen_est = 0

        margen_cat.append({
            "categoria": cat,
            "pedidos": cat_total,
            "ingresos_ars": round(cat_ingresos, 2),
            "churn_ars": round(cat_churn, 2),
            "margen_estimado_pct": margen_est
        })

    margen_cat.sort(key=lambda x: x["margen_estimado_pct"], reverse=True)

    total_margen = sum(c["ingresos_ars"] for c in margen_cat)
    top_80 = []
    acumulado = 0
    for c in margen_cat:
        if total_margen > 0:
            acumulado += c["ingresos_ars"]
            if acumulado / total_margen <= 0.85:
                top_80.append(c["categoria"])

    if not top_80 and margen_cat:
        top_80 = [margen_cat[0]["categoria"]]

    acciones = []
    if churn_ars > 0:
        acciones.append(
            f"Recuperar ${int(churn_ars):,} ARS de cancelaciones: "
            f"contactar los 10 clientes mas recientes cancelados con 10% OFF"
        )
    if margen_cat:
        mejor = margen_cat[0]
        acciones.append(
            f"Focalizar marketing en '{mejor['categoria']}' "
            f"(margen {mejor['margen_estimado_pct']}%, ${int(mejor['ingresos_ars']):,} ARS)"
        )
    if len(margen_cat) > 1:
        peor = margen_cat[-1]
        if peor["churn_ars"] > 0:
            acciones.append(
                f"Revisar '{peor['categoria']}': "
                f"${int(peor['churn_ars']):,} ARS perdidos, "
                f"considerar pausar o ajustar precio"
            )

    if not acciones:
        acciones.append("Datos insuficientes para generar acciones automaticas")

    return {
        "cliente": cliente,
        "ticket_promedio_ars": ticket_promedio,
        "ingresos_total_ars": round(ingresos_total, 2),
        "churn_ars": round(churn_ars, 2),
        "margen_por_categoria": margen_cat,
        "top_80_20": top_80,
        "acciones": acciones
    }


def run(input_path: str):
    cliente = os.path.splitext(os.path.basename(input_path))[0].replace("_clean", "")

    df = pd.read_json(input_path)
    out_dir = os.path.join("data", "processed")
    os.makedirs(out_dir, exist_ok=True)

    hallazgos = calc_hallazgos(df, cliente)
    h_path = os.path.join(out_dir, f"{cliente}_hallazgos.json")
    with open(h_path, "w", encoding="utf-8") as f:
        json.dump(hallazgos, f, ensure_ascii=False, indent=2)
    print(f"Hallazgos OK: {h_path}")

    finanzas = calc_finanzas(df, cliente)
    f_path = os.path.join(out_dir, f"{cliente}_finanzas.json")
    with open(f_path, "w", encoding="utf-8") as f:
        json.dump(finanzas, f, ensure_ascii=False, indent=2)
    print(f"Finanzas OK: {f_path}")

    print(f"\n--- Resumen {cliente} ---")
    print(f"  Pedidos: {hallazgos['total_pedidos']}")
    print(f"  Tasa cancelacion: {hallazgos['tasa_cancelacion_pct']}%")
    print(f"  Churn ARS: ${int(finanzas['churn_ars']):,}")
    print(f"  Top 80/20: {', '.join(finanzas['top_80_20'])}")
    print(f"  Ticket promedio: ${finanzas['ticket_promedio_ars']:,.2f}")

    return h_path, f_path


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python calc_finanzas.py <ruta_json_clean>")
        print("Ejemplo: python scripts/calc_finanzas.py data/processed/tienda_demo_clean.json")
        sys.exit(1)

    run(sys.argv[1])
