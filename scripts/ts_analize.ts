import { promises as fs } from "fs";
import path from "path";
import { analizeRows, parseBuffer, parseCsvText } from "../src/lib/pipeline.ts";

const file = process.argv[2];
if (!file) {
  console.error("Uso: node scripts/ts_analize.ts <archivo.csv|xlsx|xls>");
  process.exit(1);
}

const buf = new Uint8Array(await fs.readFile(file));
const ext = path.extname(file).toLowerCase();
const rows =
  ext === ".csv" ? parseCsvText(Buffer.from(buf).toString("utf-8")) : parseBuffer(buf);

const a = analizeRows("x", rows);
process.stdout.write(JSON.stringify(a));