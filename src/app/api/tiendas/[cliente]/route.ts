import { NextResponse } from "next/server";
import { sanitizeCliente } from "@/lib/pipeline";
import { getStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: { params: { cliente: string } }
) {
  const raw = context.params.cliente;
  const cliente = sanitizeCliente(raw);

  if (!cliente) {
    return NextResponse.json(
      { ok: false, error: "Nombre de tienda no válido" },
      { status: 400 }
    );
  }

  const eliminados = await getStorage().delete(cliente);

  return NextResponse.json({ ok: true, cliente, eliminados, total: eliminados.total });
}