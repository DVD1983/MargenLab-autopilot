# Skill: MargenLab Core

## Logica del Surshop-analytics
Basado en el repo Surshop-analytics de David.

## Metricas clave
- total_pedidos = len(df)
- pct_cancelacion = cancelados / total * 100
- churn_ars = cancelados * ticket_promedio
- margen_estimado por categoria = 1 - (cancelaciones_categoria / total_categoria) -> proxy cuando no hay costo
- top_80_20: categorías que suman 80% del margen

## Código base
```python
import pandas as pd
df = pd.read_csv(path)
ticket = df["precio"].mean()
churn = df[df.estado_pago=="cancelado"]["precio"].sum()
```

## Output
Siempre generar los dos JSON: _hallazgos.json y _finanzas.json
