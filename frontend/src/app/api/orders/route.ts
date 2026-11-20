import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

const noStore = { "Cache-Control": "no-store" };

// Orders reserve stock until they are paid or expire, so limit how many one visitor
// can open: 5 every 15 minutes.
const ordersPerClient = createRateLimiter({ limit: 5, windowMs: 15 * 60_000 });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function getSession() {
  if (!process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET) return null;
  return getAuth().api.getSession({ headers: await headers() });
}

function isStaff(session: Awaited<ReturnType<typeof getSession>>) {
  return session?.user.role === "admin" || session?.user.role === "superadmin";
}

async function forwardToStoreApi(path: string, method: "GET" | "POST", customerId: string | null, body?: string) {
  const apiUrl = process.env.STORE_API_URL?.trim().replace(/\/+$/, "");
  const apiKey = process.env.STORE_API_KEY;
  if (!apiUrl || !apiKey) {
    return NextResponse.json({ error: "Le service de commande n’est pas configuré." }, { status: 503, headers: noStore });
  }

  const requestHeaders = new Headers({ "X-Store-Api-Key": apiKey });
  if (customerId) requestHeaders.set("X-Customer-Id", customerId);
  if (method === "POST") requestHeaders.set("Content-Type", "application/json");

  try {
    const response = await fetch(`${apiUrl}${path}`, {
      method,
      headers: requestHeaders,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json", ...noStore },
    });
  } catch (error) {
    console.error("Store API order request failed.", error);
    return NextResponse.json({ error: "Le service de commande est indisponible. Réessayez plus tard." }, { status: 503, headers: noStore });
  }
}

export async function GET() {
  const session = await getSession();
  if (!session || isStaff(session)) {
    return NextResponse.json({ error: "Connectez-vous pour consulter vos commandes." }, { status: 401, headers: noStore });
  }
  return forwardToStoreApi("/api/store/orders", "GET", session.user.id);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (isStaff(session)) {
    return NextResponse.json({ error: "Connectez-vous avec un compte client pour passer commande." }, { status: 403, headers: noStore });
  }

  const limit = ordersPerClient(clientIp(request.headers));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Vous avez lancé plusieurs commandes récemment. Réessayez dans quelques minutes ou contactez-nous sur WhatsApp." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds), ...noStore } },
    );
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 32_768) {
    return NextResponse.json({ error: "Le contenu de la commande est trop volumineux." }, { status: 413, headers: noStore });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(await request.text());
  } catch {
    return NextResponse.json({ error: "Le contenu de la commande est invalide." }, { status: 400, headers: noStore });
  }
  if (!isRecord(payload)) {
    return NextResponse.json({ error: "Le contenu de la commande est invalide." }, { status: 400, headers: noStore });
  }

  // Signed-in customers order under their account; guests give their own name and
  // optional e-mail, validated again by the backend.
  const body = JSON.stringify(session
    ? { ...payload, customerName: session.user.name, customerEmail: session.user.email }
    : {
      ...payload,
      customerName: typeof payload.customerName === "string" ? payload.customerName : "",
      customerEmail: typeof payload.customerEmail === "string" ? payload.customerEmail : "",
    });
  return forwardToStoreApi("/api/store/orders", "POST", session?.user.id ?? null, body);
}
