import { NextResponse, type NextRequest } from "next/server";
import { connection } from "next/server";
import { getDatabasePool } from "@/lib/auth";
import { parseNewStoreComment, type StoreComment } from "@/lib/store-comments";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

// 3 comments per visitor every 10 minutes, and at most 30 for the whole shop per hour.
const commentsPerClient = createRateLimiter({ limit: 3, windowMs: 10 * 60_000 });
const commentsGlobal = createRateLimiter({ limit: 30, windowMs: 60 * 60_000 });

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

  const perClient = commentsPerClient(clientIp(request.headers));
  const global = commentsGlobal("all");
  if (!perClient.allowed || !global.allowed) {
    const retryAfter = Math.max(perClient.retryAfterSeconds, global.retryAfterSeconds);
    return NextResponse.json(
      { error: "Vous avez publié plusieurs commentaires récemment. Réessayez un peu plus tard." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 16_384) {
    return NextResponse.json({ error: "Le commentaire envoyé est trop volumineux." }, { status: 413 });
  }

  const body: unknown = await request.json().catch(() => null);
  const comment = parseNewStoreComment(body);
  if (!comment) {
    return NextResponse.json(
      { error: "Indiquez un nom (2 à 80 caractères) et un commentaire (2 à 1 000 caractères), sans lien internet." },
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
