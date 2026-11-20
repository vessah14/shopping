import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { uploadFilenamePattern, uploadsDirectory } from "@/lib/uploads";

const contentTypes: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

// Serves product images uploaded after the build. Requests reach this route through the
// `fallback` rewrite in next.config.ts, i.e. only when no static file matched.
export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  const match = uploadFilenamePattern.exec(filename);
  if (!match) return new NextResponse(null, { status: 404 });

  try {
    const bytes = await readFile(path.join(uploadsDirectory, filename));
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": contentTypes[match[1]],
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
