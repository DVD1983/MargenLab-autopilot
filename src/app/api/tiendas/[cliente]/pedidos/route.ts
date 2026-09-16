import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: { cliente: string } }
) {
  const { cliente } = context.params;
  const data = await getStore(cliente);
  if (!data) return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404 });

  const url = new URL(request.url);
  const search = (url.searchParams.get("search") ?? "").trim().toLowerCase();
  const estado = url.searchParams.get("estado") ?? "todos";
  const categoria = url.searchParams.get("categoria") ?? "todas";
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.max(1, Math.min(100, Number(url.searchParams.get("pageSize")) || 12));

  let filtered = data.orders;

  if (estado === "pagado") filtered = filtered.filter((o) => o.estado_pago === "pagado");
  if (estado === "cancelado") filtered = filtered.filter((o) => o.estado_pago === "cancelado");

  if (categoria !== "todas") filtered = filtered.filter((o) => o.categoria === categoria);

  if (search) {
    filtered = filtered.filter(
      (o) =>
        o.producto.toLowerCase().includes(search) ||
        o.id_pedido.toString().includes(search)
    );
  }

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const pedidos = filtered.slice(start, start + pageSize);

  return NextResponse.json({ pedidos, total, page, pageSize });
}