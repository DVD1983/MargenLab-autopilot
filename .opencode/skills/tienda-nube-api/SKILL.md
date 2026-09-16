# Skill: Tienda Nube API

## Para que sirve
Conectar MargenLab Autopilot con Tienda Nube real.

## CSV esperado
Tienda Nube exporta: `id_pedido, fecha, producto, categoria, cantidad, precio, estado_pago, estado_envio, motivo_cancelacion`

## Endpoints útiles
- GET /api/orders - lista pedidos
- Webhook: /api/tiendanube/webhook -> guarda en /data/uploads/
- Docs: https://tiendanube.github.io/api-documentation/

## Regla de anonimizacion
Antes de enviar a modelos free, eliminá: email_cliente, nombre_cliente, telefono, direccion. Quedate solo con producto/categoria/montos/estados.

## Ejemplo parser Python
```python
import pandas as pd
df = pd.read_csv("/data/uploads/{cliente}.csv")
df = df[["producto","categoria","precio","estado_pago"]]
df.to_json("/data/processed/{cliente}_clean.json")
```
