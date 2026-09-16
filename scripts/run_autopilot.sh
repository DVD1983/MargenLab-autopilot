#!/usr/bin/env bash
# MargenLab Autopilot - Pipeline completo
# Uso: bash scripts/run_autopilot.sh <cliente>
# Ejemplo: bash scripts/run_autopilot.sh tienda_demo
#
# Paso 1: parse + finanzas (Python, $0)
# Paso 2: orquestacion OpenCode (modelos FREE de OpenCode Zen)
set -euo pipefail

CLIENTE="${1:-}"
if [ -z "$CLIENTE" ]; then
  echo "ERROR: falta el nombre del cliente."
  echo "Uso: bash scripts/run_autopilot.sh <cliente>"
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Detecta interprete de Python que tenga pandas
PYTHON=""
if [ -d "/mnt/c" ]; then
  # WSL: usar el Python nativo de Windows (tiene pandas)
  for win_py in /mnt/c/Users/*/AppData/Local/Microsoft/WindowsApps/python3.exe /mnt/c/Users/*/AppData/Local/Microsoft/WindowsApps/python.exe; do
    if [ -f "$win_py" ] && "$win_py" -c "import pandas" >/dev/null 2>&1; then
      PYTHON="$win_py"
      break
    fi
  done
fi
if [ -z "$PYTHON" ]; then
  for candidate in python python3 py py3; do
    if command -v "$candidate" >/dev/null 2>&1; then
      if "$candidate" -c "import pandas" >/dev/null 2>&1; then
        PYTHON="$candidate"
        break
      fi
    fi
  done
fi
if [ -z "$PYTHON" ]; then
  echo "ERROR: no se encontro Python (python/python3/py). Instalalo y volve a intentar."
  exit 1
fi
echo "Usando Python: $PYTHON"

CSV="data/uploads/${CLIENTE}.csv"
mkdir -p data/processed output/${CLIENTE}

if [ ! -f "$CSV" ]; then
  echo "ERROR: no existe $CSV"
  exit 1
fi

echo "=== [1/5] Parse + anonimizacion ==="
$PYTHON scripts/parse_tiendanube.py "$CSV"

echo "=== [2/5] Calculo financiero ==="
$PYTHON scripts/calc_finanzas.py "data/processed/${CLIENTE}_clean.json"

echo "=== [3/5] Auditor + Finanzas -> Orquestador OpenCode ==="
if command -v opencode >/dev/null 2>&1; then
  opencode run --agent orchestrator "Procesa cliente=${CLIENTE}" || true
  opencode run --agent auditor "Lee data/processed/${CLIENTE}_cleans.json y genera haliazgos" || true
else
  echo "SKIP: no se encontro 'opencode' en el PATH."
  echo "  Abri la TUI de OpenCode y ejecuta:"
  echo "    /agent orchestrator"
  echo "    Procesa cliente=${CLIENTE}"
  echo "  Luego segui el flujo del orquestador hasta /output/${CLIENTE}/"
fi

echo "=== [4/5] Dev + Vendedor + Reporter (los corre el orquestador) ==="

echo "=== [5/5] Fin ==="
echo "Resultados:"
ls -la "output/${CLIENTE}/" 2>/dev/null || echo "  Aun sin output. Completa la orquestacion en OpenCode."
echo "JSON procesados:"
ls -la "data/processed/${CLIENTE}_"*.json 2>/dev/null || true
echo ""
echo "Siguiente: cuando los agentes terminen, empaqueta con:"
echo "  tar -czf output/${CLIENTE}.tgz -C output ${CLIENTE}  (o zippeala para WhatsApp)"