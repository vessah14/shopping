import { randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { uploadsDirectory } from "@/lib/uploads";

const maxUploadBytes = 8 * 1024 * 1024;
const imageTypes = new Map([
  ["image/jpeg", { extension: "jpg", matches: (bytes: Buffer) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff }],
  ["image/png", { extension: "png", matches: (bytes: Buffer) => bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) }],
  ["image/webp", { extension: "webp", matches: (bytes: Buffer) => bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" }],
]);

// Uploads are only accepted from the admin application's server, which checks the
// administrator session and then forwards the file with this shared secret.
function isAuthorized(request: NextRequest) {
  const expected = process.env.UPLOADS_API_KEY;
  const supplied = request.headers.get("x-uploads-api-key");
  if (!expected || expected.length < 32 || !supplied) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxUploadBytes + 64 * 1024) {
    return NextResponse.json({ error: "L’image doit peser moins de 8 Mo." }, { status: 413 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choisissez une image à téléverser." }, { status: 400 });
  if (file.size < 1 || file.size > maxUploadBytes) {
    return NextResponse.json({ error: "L’image doit peser moins de 8 Mo." }, { status: 413 });
  }

  const imageType = imageTypes.get(file.type);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!imageType || !imageType.matches(bytes)) {
    return NextResponse.json({ error: "Format non accepté. Choisissez une image JPG, PNG ou WebP valide." }, { status: 415 });
  }

  const filename = `${randomUUID()}.${imageType.extension}`;
  await mkdir(uploadsDirectory, { recursive: true });
  await writeFile(`${uploadsDirectory}/${filename}`, bytes, { flag: "wx" });

  return NextResponse.json({ path: `/uploads/products/${filename}` }, { status: 201 });
}
