import type { Metadata } from "next";
import Link from "next/link";
import PaymentStatusPoller from "./payment-status-poller";

export const instant = false;
export const metadata: Metadata = {
  title: "État du paiement",
  robots: { index: false, follow: false },
};

type PaymentReturnPageProps = {
  searchParams: Promise<{ orderId?: string | string[]; token?: string | string[] }>;
};

export default async function PaymentReturnPage({ searchParams }: PaymentReturnPageProps) {
  const { orderId, token } = await searchParams;
  const id = typeof orderId === "string" ? orderId : "";
  const accessToken = typeof token === "string" ? token : "";

  return (
    <main className="inner-page">
      <section className="cart-page-section">
        <div className="checkout-panel">
          <p className="eyebrow">PAIEMENT FAPSHI</p>
          <h1>Vérification de votre paiement</h1>
          {id ? (
            <PaymentStatusPoller orderId={id} accessToken={accessToken} />
          ) : (
            <p role="alert">Le numéro de commande est manquant.</p>
          )}
          <Link className="cart-contact-button" href="/compte">
            Consulter mes commandes
          </Link>
        </div>
      </section>
    </main>
  );
}
