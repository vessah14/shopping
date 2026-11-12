import { NextResponse, type NextRequest } from "next/server";
import { connection } from "next/server";
import { getDatabasePool } from "@/lib/auth";
import { parseNewStoreComment, type StoreComment } from "@/lib/store-comments";

const commentColumns = `id::text AS id, author_name AS name, message, created_at AS "createdAt"`;

function databaseUnavailable() {
  return NextResponse.json(
    { error: "Les commentaires nécessitent la configuration de la base PostgreSQL." },
    { status: 503 },
  );
}

export async function GET() {
  await connection();
  if (!process.env.DATABASE_URL) return databaseUnavailable();

  const result = await getDatabasePool().query<StoreComment>(
    `SELECT ${commentColumns}
     FROM store_comments
     ORDER BY created_at DESC
     LIMIT 50`,
  );
  return NextResponse.json(result.rows, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) return databaseUnavailable();

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 16_384) {
    return NextResponse.json({ error: "Le commentaire envoyé est trop volumineux." }, { status: 413 });
  }

  const body: unknown = await request.json().catch(() => null);
  const comment = parseNewStoreComment(body);
  if (!comment) {
    return NextResponse.json(
      { error: "Indiquez un nom (2 à 80 caractères) et un commentaire (2 à 1 000 caractères)." },
      { status: 400 },
    );
  }

  const result = await getDatabasePool().query<StoreComment>(
    `INSERT INTO store_comments (author_name, message)
     VALUES ($1, $2)
     RETURNING ${commentColumns}`,
    [comment.name, comment.message],
  );
  return NextResponse.json(result.rows[0], { status: 201, headers: { "Cache-Control": "no-store" } });
}
