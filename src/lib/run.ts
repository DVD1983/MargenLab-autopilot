import { analizeRows, sanitizeCliente, UploadResult } from "./pipeline";
import { getStorage } from "./storage";

export async function runPipeline(
  cliente: string,
  rows: Record<string, unknown>[],
  origen: UploadResult["origen"],
  contenidoOriginal?: Uint8Array,
  uploadFileName?: string
): Promise<UploadResult> {
  const safe = sanitizeCliente(cliente);
  const { clean, hallazgos, finanzas } = analizeRows(safe, rows);
  const existed = (await getStorage().get(safe)) !== null;

  await getStorage().put(safe, {
    origen,
    uploadName: uploadFileName ?? `${safe}.csv`,
    uploadBytes: contenidoOriginal,
    clean,
    hallazgos,
    finanzas,
  });

  const hallazgosT = hallazgos as { pagados: number; cancelados: number; categorias: unknown[] };
  return {
    cliente: safe,
    pedidos: hallazgosT.pagados + hallazgosT.cancelados,
    pagados: hallazgosT.pagados,
    cancelados: hallazgosT.cancelados,
    categorias: hallazgosT.categorias.length,
    updated: existed,
    origen,
  };
}