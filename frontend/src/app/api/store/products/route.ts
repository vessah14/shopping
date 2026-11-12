import { NextResponse } from "next/server";
import { connection } from "next/server";
import { getStoreData } from "@/lib/store-data";

export async function GET() {
  await connection();
  const { products } = await getStoreData();
  return NextResponse.json(products, { headers: { "Cache-Control": "no-store" } });
}
