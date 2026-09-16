# MargenLab Autopilot - Factory con modelos FREE de OpenCode Zen

## Modelos usados (todos gratis del screenshot)
- orchestrator: big-pickle (Arquitecto)
- auditor: mimo-v2.5-free (1M contexto)
- finanzas: ling-3.0-flash-fin-free (Finanzas)
- dev: gpt-5-codex (Code)
- vendedor: muse-spark-1.3-free (Copy AR)
- reporter: kimi-k3 (Reportes largos)

## Instalación
1. Instala OpenCode: `npm i -g opencode-ai` o descarga Desktop
2. Copia esta carpeta a tu proyecto
3. `opencode auth` -> logueate en https://opencode.ai/zen -> pega API key (gratis)
4. `/connect` -> selecciona OpenCode Zen
5. `/models` -> verifica que ves los 6 free

## Uso
1. Pone el CSV del cliente en `/data/uploads/cliente.csv`
2. En la TUI de OpenCode: `/agent orchestrator`
3. Escribí: "Procesa cliente=tienda_ana"
4. Mirá `/output/tienda_ana/` -> dashboard + copy + reporte

## Flujo
CSV -> auditor (MiMo) -> finanzas (Ling) -> dev (GPT-5 Codex) + vendedor (Muse) en paralelo -> reporter (Kimi) -> /output

