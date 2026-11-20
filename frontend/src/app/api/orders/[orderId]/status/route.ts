import { NextResponse, type NextRequest } from "next/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const noStore = { "Cache-Control": "no-store" };

/**
 * Payment status of one order, readable with the secret token from the payment return
 * link. Works for guests and customers alike, without an account session.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const token = request.nextUrl.searchParams.get("token") ?? "";
  if (!uuidPattern.test(orderId) || !/^[A-Za-z0-9_-]{20,100}$/.test(token)) {
    return NextResponse.json({ error: "Lien de commande invalide." }, { status: 404, headers: noStore });
  }

  const apiUrl = process.env.STORE_API_URL?.trim().replace(/\/+$/, "");
  const apiKey = process.env.STORE_API_KEY;
  if (!apiUrl || !apiKey) {
    return NextResponse.json({ error: "Le service de commande n’est pas configuré." }, { status: 503, headers: noStore });
  }

  try {
    const response = await fetch(`${apiUrl}/api/store/orders/${orderId}/status`, {
      headers: { "X-Store-Api-Key": apiKey, "X-Order-Token": token },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 404) {
      return NextResponse.json({ error: "Commande introuvable." }, { status: 404, headers: noStore });
    }
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: { "Content-Type": "application/json", ...noStore },
    });
  } catch (error) {
    console.error("Store API order status request failed.", error);
    return NextResponse.json({ error: "Le service de commande est indisponible." }, { status: 503, headers: noStore });
  }
}
