#!/usr/bin/env python3
"""
MargenLab Autopilot - Parser CSV Tienda Nube
Limpia, valida y anonimiza el CSV exportado de Tienda Nube.
Output: data/processed/{cliente}_clean.json
"""

import sys
import os
import json
import pandas as pd

REQUIRED_COLUMNS = [
    "id_pedido", "fecha", "producto", "categoria",
    "cantidad", "precio", "estado_pago", "estado_envio"
]

ANONYMIZE_COLUMNS = [
    "email_cliente", "nombre_cliente", "telefono",
    "direccion", "email", "nombre", "telefono_cliente"
]

OPTIONAL_COLUMNS = ["motivo_cancelacion", "proveedor", "sku"]


def validate_columns(df: pd.DataFrame) -> list:
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    return missing


def anonymize(df: pd.DataFrame) -> pd.DataFrame:
    cols_to_drop = [c for c in df.columns if c in ANONYMIZE_COLUMNS]
    return df.drop(columns=cols_to_drop, errors="ignore")


def clean(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    if "precio" in df.columns:
        df["precio"] = pd.to_numeric(
            df["precio"].astype(str).str.replace("$", "", regex=False)
            .str.replace(".", "", regex=False).str.replace(",", ".", regex=False),
            errors="coerce"
        ).fillna(0)

    if "cantidad" in df.columns:
        df["cantidad"] = pd.to_numeric(df["cantidad"], errors="coerce").fillna(1).astype(int)

    if "fecha" in df.columns:
        df["fecha"] = pd.to_datetime(df["fecha"], errors="coerce").dt.strftime("%Y-%m-%d")

    df["estado_pago"] = df.get("estado_pago", pd.Series(dtype=str)).str.strip().str.lower()
    df["estado_envio"] = df.get("estado_envio", pd.Series(dtype=str)).str.strip().str.lower()

    if "motivo_cancelacion" not in df.columns:
        df["motivo_cancelacion"] = ""

    df = df.fillna("")

    return df


def run(input_path: str):
    cliente = os.path.splitext(os.path.basename(input_path))[0]

    df = pd.read_csv(input_path, encoding="utf-8-sig")
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    missing = validate_columns(df)
    if missing:
        print(f"AVISO: Columnas faltantes (se crean vacias): {missing}")
        for c in missing:
            df[c] = ""

    df = anonymize(df)
    df = clean(df)

    out_dir = os.path.join("data", "processed")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"{cliente}_clean.json")

    records = df.to_dict(orient="records")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)

    n = len(df)
    pagados = len(df[df["estado_pago"].isin(["pagado", "pagada", "paid", "completed"])])
    cancelados = n - pagados
    cats = df["categoria"].nunique()

    print(f"Parse OK: {cliente}")
    print(f"  Pedidos: {n}")
    print(f"  Pagados: {pagados} | Cancelados: {cancelados}")
    print(f"  Categorias: {cats}")
    print(f"  Output: {out_path}")

    return out_path


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python parse_tiendanube.py <ruta_csv>")
        print("Ejemplo: python scripts/parse_tiendanube.py data/uploads/tienda_demo.csv")
        sys.exit(1)

    run(sys.argv[1])
