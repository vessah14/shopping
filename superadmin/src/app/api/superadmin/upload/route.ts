import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choisissez une image à téléverser." }, { status: 400 });

  const upload = new FormData();
  upload.append("file", file, file.name);
  try {
    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
    const response = await fetch(new URL("/api/uploads", frontendUrl), { method: "POST", body: upload, cache: "no-store" });
    const result: unknown = await response.json().catch(() => null);
    return NextResponse.json(result, { status: response.status });
  } catch {
    return NextResponse.json({ error: "Le service de téléversement ne répond pas. Réessayez." }, { status: 502 });
  }
}
