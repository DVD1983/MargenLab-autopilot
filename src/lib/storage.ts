import { promises as fs } from "fs";
import path from "path";
import { Pool } from "pg";

const ROOT = process.cwd();
const UPLOADS_DIR = path.join(ROOT, "data", "uploads");
const PROCESSED_DIR = path.join(ROOT, "data", "processed");
const OUTPUT_DIR = path.join(ROOT, "output");

export interface StoredTienda {
  finanzas: unknown;
  hallazgos: unknown;
  clean: unknown;
}

export interface PutTienda {
  origen: string;
  uploadName?: string;
  uploadBytes?: Uint8Array;
  finanzas: unknown;
  hallazgos: unknown;
  clean: unknown;
}

export interface DelResult {
  uploads: string[];
  processed: string[];
  output: boolean;
  total: number;
}

export interface UploadOrig {
  name: string;
  bytes: Uint8Array;
}

export interface StorageIO {
  list(): Promise<string[]>;
  get(cliente: string): Promise<StoredTienda | null>;
  put(cliente: string, data: PutTienda): Promise<void>;
  delete(cliente: string): Promise<DelResult>;
  readUpload(cliente: string): Promise<UploadOrig | null>;
}

// ---------- Backend archivos (desarrollo local / VPS / tests) ----------

class FileSystemStore implements StorageIO {
  async list(): Promise<string[]> {
    try {
      const files = await fs.readdir(PROCESSED_DIR);
      const stores = new Set<string>();
      for (const f of files) {
        const m = f.match(/^(.+?)_finanzas\.json$/);
        if (m) stores.add(m[1]);
      }
      return Array.from(stores).sort();
    } catch {
      return [];
    }
  }

  async get(cliente: string): Promise<StoredTienda | null> {
    const read = async (rel: string) => {
      try {
        return JSON.parse(await fs.readFile(path.join(PROCESSED_DIR, rel), "utf-8"));
      } catch {
        return null;
      }
    };
    const [finanzas, hallazgos, clean] = await Promise.all([
      read(`${cliente}_finanzas.json`),
      read(`${cliente}_hallazgos.json`),
      read(`${cliente}_clean.json`),
    ]);
    if (!finanzas || !hallazgos || !clean) return null;
    return { finanzas, hallazgos, clean };
  }

  async put(cliente: string, data: PutTienda): Promise<void> {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.mkdir(PROCESSED_DIR, { recursive: true });
    await Promise.all([
      fs.writeFile(path.join(PROCESSED_DIR, `${cliente}_clean.json`), JSON.stringify(data.clean, null, 2), "utf-8"),
      fs.writeFile(path.join(PROCESSED_DIR, `${cliente}_hallazgos.json`), JSON.stringify(data.hallazgos, null, 2), "utf-8"),
      fs.writeFile(path.join(PROCESSED_DIR, `${cliente}_finanzas.json`), JSON.stringify(data.finanzas, null, 2), "utf-8"),
    ]);
    if (data.uploadBytes && data.uploadName) {
      await fs.writeFile(path.join(UPLOADS_DIR, data.uploadName), data.uploadBytes);
    }
  }

  async delete(cliente: string): Promise<DelResult> {
    const eliminados: DelResult = { uploads: [], processed: [], output: false, total: 0 };
    try {
      const uploads = await fs.readdir(UPLOADS_DIR);
      for (const f of uploads) {
        if (f === `${cliente}.csv` || f === `${cliente}.xlsx` || f === `${cliente}.xls`) {
          await fs.rm(path.join(UPLOADS_DIR, f), { force: true });
          eliminados.uploads.push(f);
        }
      }
    } catch {
      /* sin carpeta */
    }
    try {
      const processed = await fs.readdir(PROCESSED_DIR);
      for (const f of processed) {
        if (f.startsWith(`${cliente}_`) && f.endsWith(".json")) {
          await fs.rm(path.join(PROCESSED_DIR, f), { force: true });
          eliminados.processed.push(f);
        }
      }
    } catch {
      /* sin carpeta */
    }
    const outputPath = path.join(OUTPUT_DIR, cliente);
    const exists = await fs.stat(outputPath).catch(() => null);
    if (exists) {
      await fs.rm(outputPath, { recursive: true, force: true });
      eliminados.output = true;
    }
    eliminados.total =
      eliminados.uploads.length + eliminados.processed.length + (eliminados.output ? 1 : 0);
    return eliminados;
  }

  async readUpload(cliente: string): Promise<UploadOrig | null> {
    try {
      const files = await fs.readdir(UPLOADS_DIR);
    } catch {
      return null;
    }
    for (const ext of ["csv", "xlsx", "xls"]) {
      const p = path.join(UPLOADS_DIR, `${cliente}.${ext}`);
      const buf = await fs.readFile(p).catch(() => null);
      if (buf) return { name: `${cliente}.${ext}`, bytes: new Uint8Array(buf) };
    }
    return null;
  }
}

// ---------- Backend PostgreSQL (Vercel / producción, Supabase) ----------

function b64encode(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function b64decode(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

class PostgresStore implements StorageIO {
  private pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      max: 5,
      ssl: { rejectUnauthorized: false },
    });
  }

  async list(): Promise<string[]> {
    const res = await this.pool.query("SELECT cliente FROM tiendas ORDER BY cliente");
    return res.rows.map((r) => r.cliente);
  }

  async get(cliente: string): Promise<StoredTienda | null> {
    const res = await this.pool.query(
      "SELECT clean, hallazgos, finanzas FROM tiendas WHERE cliente = $1",
      [cliente]
    );
    if (res.rowCount === 0) return null;
    const r = res.rows[0];
    return {
      clean: typeof r.clean === "string" ? JSON.parse(r.clean) : r.clean,
      hallazgos: typeof r.hallazgos === "string" ? JSON.parse(r.hallazgos) : r.hallazgos,
      finanzas: typeof r.finanzas === "string" ? JSON.parse(r.finanzas) : r.finanzas,
    };
  }

  async put(cliente: string, data: PutTienda): Promise<void> {
    await this.pool.query(
      `INSERT INTO tiendas (cliente, origen, upload_name, upload_base64, clean, hallazgos, finanzas, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, now())
       ON CONFLICT (cliente) DO UPDATE SET
         origen = EXCLUDED.origen,
         upload_name = EXCLUDED.upload_name,
         upload_base64 = EXCLUDED.upload_base64,
         clean = EXCLUDED.clean,
         hallazgos = EXCLUDED.hallazgos,
         finanzas = EXCLUDED.finanzas,
         updated_at = now()`,
      [
        cliente,
        data.origen,
        data.uploadName ?? null,
        data.uploadBytes ? b64encode(data.uploadBytes) : null,
        JSON.stringify(data.clean),
        JSON.stringify(data.hallazgos),
        JSON.stringify(data.finanzas),
      ]
    );
  }

  async delete(cliente: string): Promise<DelResult> {
    const res = await this.pool.query("DELETE FROM tiendas WHERE cliente = $1", [cliente]);
    const n = res.rowCount ?? 0;
    return { uploads: n ? [`${cliente}.*`] : [], processed: n ? [`${cliente}_*.json`] : [], output: false, total: n };
  }

  async readUpload(cliente: string): Promise<UploadOrig | null> {
    const res = await this.pool.query(
      "SELECT upload_name, upload_base64 FROM tiendas WHERE cliente = $1",
      [cliente]
    );
    if (res.rowCount === 0 || !res.rows[0].upload_base64 || !res.rows[0].upload_name) return null;
    return { name: res.rows[0].upload_name, bytes: b64decode(res.rows[0].upload_base64) };
  }
}

// ---------- Factory ----------

let cached: StorageIO | null = null;

export function getStorage(): StorageIO {
  if (cached) return cached;
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl && process.env.DATA_STORE !== "fs") {
    cached = new PostgresStore(dbUrl);
  } else if (process.env.VERCEL) {
    throw new Error(
      "Falta DATABASE_URL. En Vercel: Settings → Environment Variables → DATABASE_URL con la URI de Supabase (Postgres)."
    );
  } else {
    cached = new FileSystemStore();
  }
  return cached;
}