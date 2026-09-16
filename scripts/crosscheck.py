#!/usr/bin/env python3
"""
MargenLab Autopilot - Validacion cruzada TS <-> Python.
Corre el mismo analisis por dos implementaciones independientes
(TipoScript en src/lib/pipeline.ts y Python en scripts/margenlab_pipeline.py)
sobre el MISMO archivo y diffiea cada metrica.

Uso:
    python scripts/crosscheck.py                 # auto: uploads o fixtures
    python scripts/crosscheck.py <archivo.csv|xlsx> [con_nombre]
Exit code: 0 todo OK, 1 si hay discrepancias.
"""

import glob
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import margenlab_pipeline as mp

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NODE = "node"
TS_RUNNER = os.path.join(ROOT, "scripts", "ts_analize.ts")
TOL = 0.011


def ts_result(file_path):
    proc = subprocess.run(
        [NODE, TS_RUNNER, file_path], capture_output=True, text=True, cwd=ROOT
    )
    if proc.returncode != 0:
        raise RuntimeError(f"node ts_analize fallo:\n{proc.stderr}")
    return json.loads(proc.stdout)


def cmp_num(a, b):
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return abs(float(a) - float(b)) <= TOL
    return str(a) == str(b)


def cmp_arr_str(a, b):
    return [str(x) for x in (a or [])] == [str(x) for x in (b or [])]


def check(name, ts, py, diffs, ties=None):
    ok = cmp_num(ts, py)
    diffs.append((name, ts, py, ok))
    return ok


def run_file(path):
    print(f"\n=== Cross-check: {os.path.basename(path)} ===")
    ts = ts_result(path)
    py = mp.analyze_file(path)
    diffs = []

    tf, pf = ts["finanzas"], py["finanzas"]
    th, ph = ts["hallazgos"], py["hallazgos"]

    if not cmp_num(len(ts["clean"]), len(py["clean"])):
        diffs.append(("clean.filas", len(ts["clean"]), len(py["clean"]), False))

    for k in ["total_pedidos", "pagados", "cancelados", "tasa_cancelacion_pct"]:
        check(f"hallazgos.{k}", th[k], ph[k], diffs)

    cats_t = {c["nombre"]: c for c in th["categorias"]}
    cats_p = {c["nombre"]: c for c in ph["categorias"]}
    for k in sorted(set(cats_t) | set(cats_p)):
        if k not in cats_t or k not in cats_p:
            diffs.append((f"hallazgos.categoria.{k}", cats_t.get(k), cats_p.get(k), False))
            continue
        for ck in ["pedidos", "pct"]:
            check(f"hallazgos.categoria.{k}.{ck}", cats_t[k][ck], cats_p[k][ck], diffs)

    for k in ["ingresos_total_ars", "churn_ars", "ticket_promedio_ars",
              "costo_total_ars", "envio_cobrado_total_ars", "envio_costo_total_ars",
              "utilidad_neta_ars", "margen_neto_pct"]:
        if k in tf or k in pf:
            check(f"finanzas.{k}", tf.get(k), pf.get(k), diffs)

    if not cmp_arr_str(tf["top_80_20"], pf["top_80_20"]):
        diffs.append(("finanzas.top_80_20", tf["top_80_20"], pf["top_80_20"], False))
    if tf["acciones"] != pf["acciones"]:
        diffs.append(("finanzas.acciones", tf["acciones"], pf["acciones"], False))

    cats_f = {c["categoria"]: c for c in tf["margen_por_categoria"]}
    cats_pf = {c["categoria"]: c for c in pf["margen_por_categoria"]}
    for k in sorted(set(cats_f) | set(cats_pf)):
        if k not in cats_f or k not in cats_pf:
            diffs.append(("finanzas.margen_cat." + k, cats_f.get(k), cats_pf.get(k), False))
            continue
        for ck in ["pedidos", "ingresos_ars", "churn_ars", "margen_estimado_pct"]:
            check(f"finanzas.margen_cat.{k}.{ck}", cats_f[k][ck], cats_pf[k][ck], diffs)

    serie_t = {(s["fecha"]): s for s in tf.get("serie_diaria", [])}
    serie_p = {(s["fecha"]): s for s in pf.get("serie_diaria", [])}
    for k in sorted(set(serie_t) | set(serie_p)):
        if k not in serie_t or k not in serie_p:
            diffs.append((f"serie.{k}", serie_t.get(k), serie_p.get(k), False))
            continue
        for ck in ["ingresos", "churn", "pedidos"]:
            check(f"serie.{k}.{ck}", serie_t[k][ck], serie_p[k][ck], diffs)

    # Comparar motivos, productos y metodo_pago ignorando orden salvo por valor
    mot_t = sorted((m["motivo"], m["cantidad"]) for m in th["cancelaciones"]["motivos_top"])
    mot_p = sorted((m["motivo"], m["cantidad"]) for m in ph["cancelaciones"]["motivos_top"])
    if mot_t != mot_p:
        diffs.append(("hallazgos.motivos_top", mot_t, mot_p, False))

    if not cmp_arr_str(th["productos_top"], ph["productos_top"]):
        diffs.append(("hallazgos.productos_top", th["productos_top"], ph["productos_top"], False))
    if not cmp_arr_str(th["productos_criticos"], ph["productos_criticos"]):
        diffs.append(("hallazgos.productos_criticos", th["productos_criticos"], ph["productos_criticos"], False))

    met_t = sorted((m["metodo"], m["pedidos"], m["pct"]) for m in tf.get("metodo_pago", []))
    met_p = sorted((m["metodo"], m["pedidos"], m["pct"]) for m in pf.get("metodo_pago", []))
    if met_t != met_p:
        diffs.append(("finanzas.metodo_pago", met_t, met_p, False))

    fails = [d for d in diffs if not d[3]]
    if fails:
        for name, a, b, _ in fails:
            print(f"  ✖ {name}: TS={a}  Python={b}")
    if diffs:
        print(f"  comparados {len(diffs)} puntos, {len(fails)} discrepancias")
    else:
        print("  ✔ 100% coincidencia (todos los puntos comparados iguales)")
    return len(fails)


def main():
    files = []
    tl = mp.ts_round
    if len(sys.argv) >= 2 and os.path.isfile(sys.argv[1]):
        files = [sys.argv[1]]
    else:
        uploads = sorted(glob.glob(os.path.join(ROOT, "data", "uploads", "*")))
        files = [f for f in uploads if f.lower().endswith((".csv", ".xlsx", ".xls"))]
        if not files:
            fixtures = sorted(glob.glob(os.path.join(ROOT, "tests", "data", "*.csv")))
            files = fixtures
    if not files:
        print("No hay archivos para validar.")
        sys.exit(1)

    total_fails = 0
    for f in files:
        try:
            total_fails += run_file(f)
        except Exception as e:  # noqa
            print(f"  ✖ error ejecutando: {e}")
            total_fails += 1

    print(f"\n=== Resumen: {'OK' if total_fails == 0 else 'HAY DISCREPANCIAS'} ({total_fails} errores) ===")
    sys.exit(1 if total_fails else 0)


if __name__ == "__main__":
    main()