import { NextResponse } from "next/server";
import { connection } from "next/server";
import { getDatabasePool } from "@/lib/auth";

export async function GET() {
  await connection();
  const result = await getDatabasePool().query<{
    id: number;
    message: string;
    updatedAt: string;
    startsAt: string;
    endsAt: string | null;
  }>(
    `SELECT id::integer AS id, message, updated_at AS "updatedAt",
            starts_at AS "startsAt", ends_at AS "endsAt"
     FROM store_announcement_posts
     WHERE is_enabled = true
       AND (ends_at IS NULL OR ends_at > now())
     ORDER BY starts_at, id`,
  );

  return NextResponse.json(result.rows, {
    headers: { "Cache-Control": "no-store" },
  });
}
