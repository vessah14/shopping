import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

const maxUploadBytes = 8 * 1024 * 1024;
const imageTypes = new Map([
  ["image/jpeg", { extension: "jpg", matches: (bytes: Buffer) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff }],
  ["image/png", { extension: "png", matches: (bytes: Buffer) => bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) }],
  ["image/webp", { extension: "webp", matches: (bytes: Buffer) => bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" }],
]);

function corsHeaders(origin: string | null) {
  const frontendOrigin = new URL(process.env.NEXT_PUBLIC_FRONTEND_URL ?? "http://localhost:3000").origin;
  const adminOrigin = new URL(process.env.SUPERADMIN_URL ?? "http://localhost:3001").origin;
  if (origin && origin !== frontendOrigin && origin !== adminOrigin) return null;
  return new Headers({
    "Access-Control-Allow-Origin": origin ?? frontendOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  });
}

export function OPTIONS(request: NextRequest) {
  const headers = corsHeaders(request.headers.get("origin"));
  return headers
    ? new NextResponse(null, { status: 204, headers })
    : NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const headers = corsHeaders(request.headers.get("origin"));
  if (!headers) return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choisissez une image à téléverser." }, { status: 400, headers });
  if (file.size < 1 || file.size > maxUploadBytes) {
    return NextResponse.json({ error: "L’image doit peser moins de 8 Mo." }, { status: 413, headers });
  }

  const imageType = imageTypes.get(file.type);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!imageType || !imageType.matches(bytes)) {
    return NextResponse.json({ error: "Format non accepté. Choisissez une image JPG, PNG ou WebP valide." }, { status: 415, headers });
  }

  const directory = path.join(process.cwd(), "public", "uploads", "products");
  const filename = `${randomUUID()}.${imageType.extension}`;
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, filename), bytes, { flag: "wx" });

  return NextResponse.json({ path: `/uploads/products/${filename}` }, { status: 201, headers });
}
