import { NextResponse } from "next/server";
import { listStores } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ tiendas: await listStores() });
}