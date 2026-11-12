import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function getCustomerSession() {
  if (!process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET) return null;
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session || session.user.role === "admin" || session.user.role === "superadmin") return null;
  return session;
}

async function forwardToStoreApi(
  path: string,
  method: "GET" | "POST",
  session: NonNullable<Awaited<ReturnType<typeof getCustomerSession>>>,
  body?: string,
) {
  const apiUrl = process.env.STORE_API_URL?.trim().replace(/\/+$/, "");
  const apiKey = process.env.STORE_API_KEY;
  if (!apiUrl || !apiKey) {
    return NextResponse.json(
      { error: "Le service de commande n’est pas configuré." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const requestHeaders = new Headers({
    "X-Store-Api-Key": apiKey,
    "X-Customer-Id": session.user.id,
  });
  if (method === "POST") {
    requestHeaders.set("Content-Type", "application/json");
  }

  try {
    const response = await fetch(`${apiUrl}${path}`, {
      method,
      headers: requestHeaders,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const responseBody = await response.text();
    return new NextResponse(responseBody, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Store API order request failed.", error);
    return NextResponse.json(
      { error: "Le service de commande est indisponible. Réessayez plus tard." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function GET() {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "Connectez-vous pour consulter vos commandes." }, { status: 401 });
  }

  return forwardToStoreApi("/api/store/orders", "GET", session);
}

export async function POST(request: NextRequest) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "Connectez-vous à votre compte avant de commander." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(await request.text());
  } catch {
    return NextResponse.json(
      { error: "Le contenu de la commande est invalide." },
      { status: 400 },
    );
  }
  if (!isRecord(payload)) {
    return NextResponse.json(
      { error: "Le contenu de la commande est invalide." },
      { status: 400 },
    );
  }

  const body = JSON.stringify({
    ...payload,
    customerName: session.user.name,
    customerEmail: session.user.email,
  });
  return forwardToStoreApi("/api/store/orders", "POST", session, body);
}
