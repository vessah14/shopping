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
    `SELECT id, message, updated_at AS "updatedAt",
            starts_at AS "startsAt", ends_at AS "endsAt"
     FROM store_announcements
     WHERE id = 1
       AND is_enabled = true
       AND (ends_at IS NULL OR ends_at > now())
     LIMIT 1`,
  );

  return NextResponse.json(result.rows[0] ?? null, {
    headers: { "Cache-Control": "no-store" },
  });
}
