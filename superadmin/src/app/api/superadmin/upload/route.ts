import { NextResponse } from "next/server";
import { getSuperadminAccess } from "@/lib/superadmin-access";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const access = await getSuperadminAccess();
  if (access.kind === "unauthenticated") return NextResponse.json({ error: "Connectez-vous avec un compte administrateur." }, { status: 401 });
  if (access.kind === "forbidden") return NextResponse.json({ error: "Ce compte n’a pas le rôle administrateur." }, { status: 403 });

  const uploadsApiKey = process.env.UPLOADS_API_KEY;
  if (access.kind === "unconfigured" || !uploadsApiKey || uploadsApiKey.length < 32) {
    return NextResponse.json({ error: "Le téléversement n’est pas configuré (UPLOADS_API_KEY)." }, { status: 503 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choisissez une image à téléverser." }, { status: 400 });

  const upload = new FormData();
  upload.append("file", file, file.name);
  try {
    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
    const response = await fetch(new URL("/api/uploads", frontendUrl), {
      method: "POST",
      body: upload,
      headers: { "X-Uploads-Api-Key": uploadsApiKey },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const result: unknown = await response.json().catch(() => null);
    return NextResponse.json(result, { status: response.status });
  } catch {
    return NextResponse.json({ error: "Le service de téléversement ne répond pas. Réessayez." }, { status: 502 });
  }
}
