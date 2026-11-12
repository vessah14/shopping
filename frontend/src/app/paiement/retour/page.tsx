import Link from "next/link";
import PaymentStatusPoller from "./payment-status-poller";

export const instant = false;

type PaymentReturnPageProps = {
  searchParams: Promise<{ orderId?: string | string[] }>;
};

export default async function PaymentReturnPage({ searchParams }: PaymentReturnPageProps) {
  const { orderId } = await searchParams;
  const id = typeof orderId === "string" ? orderId : "";

  return (
    <main className="inner-page">
      <section className="cart-page-section">
        <div className="checkout-panel">
          <p className="eyebrow">PAIEMENT SASPAY</p>
          <h1>Vérification de votre paiement</h1>
          {id ? (
            <PaymentStatusPoller orderId={id} />
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
