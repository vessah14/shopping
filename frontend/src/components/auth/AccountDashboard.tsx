"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authClient } from "../../lib/auth-client";

type AccountDashboardProps = { name: string; email: string; isAdmin: boolean };
type CustomerOrder = { id: string; status: string; paymentMethod: string; paymentStatus: string; subtotalCfa: number; createdAt: string; items: { name: string; quantity: number; lineTotalCfa: number }[] };

const orderLabels: Record<string, string> = {
  pending: "À confirmer", confirmed: "Confirmée", preparing: "En préparation",
  shipped: "Expédiée", delivered: "Livrée", cancelled: "Annulée",
};
const paymentLabels: Record<string, string> = {
  pending: "Paiement à confirmer", confirmed: "Payée", paid: "Payée", failed: "Paiement échoué", refunded: "Remboursée",
};
const paymentMethodLabels: Record<string, string> = {
  cash_on_delivery: "Paiement à la livraison",
  mtn_money: "MTN Mobile Money",
  orange_money: "Orange Money",
  saspay: "SasPay",
  fapshi: "Fapshi",
};

const ORDERS_PER_PAGE = 5;

export default function AccountDashboard({ name, email, isAdmin }: AccountDashboardProps) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersMessage, setOrdersMessage] = useState("");
  const [ordersReload, setOrdersReload] = useState(0);
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(orders.length / ORDERS_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const visibleOrders = orders.slice((currentPage - 1) * ORDERS_PER_PAGE, currentPage * ORDERS_PER_PAGE);

  useEffect(() => {
    let active = true;
    fetch("/api/orders", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          if (response.status === 401) return [];
          throw new Error("Impossible de charger votre historique de commandes.");
        }
        return response.json();
      })
      .then((result: unknown) => {
        if (active && Array.isArray(result)) {
          setOrders(result);
          setOrdersMessage("");
        }
      })
      .catch((error: unknown) => {
        if (active) setOrdersMessage(error instanceof Error ? error.message : "Impossible de charger vos commandes.");
      })
      .finally(() => {
        if (active) setOrdersLoading(false);
      });
    return () => { active = false; };
  }, [ordersReload]);

  async function signOut() {
    setFeedback("");
    setIsSigningOut(true);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setFeedback("La déconnexion n’a pas abouti. Réessayez.");
        return;
      }
      router.replace("/connexion");
      router.refresh();
    } catch {
      setFeedback("Le service de compte ne répond pas. Réessayez dans un instant.");
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="account-form-content">
      <p className="eyebrow">ESPACE SHOPPING PLUS</p>
      <h1>Bonjour {name}.</h1>
      <p className="account-intro">Vous êtes connecté à votre espace client.</p>
      <section className="account-profile" aria-label="Informations du compte">
        <h2>Mes informations</h2>
        <p><span>Nom</span><strong>{name}</strong></p>
        <p><span>Adresse e-mail</span><strong>{email}</strong></p>
      </section>
      <section className="account-orders" aria-label="Historique des commandes">
        <h2>Mes commandes</h2>
        {ordersLoading
          ? <p role="status">Chargement de vos commandes…</p>
          : ordersMessage
            ? <div><p className="account-status" role="alert">{ordersMessage}</p><button className="account-orders-retry" type="button" onClick={() => {
              setOrdersLoading(true);
              setOrdersReload((current) => current + 1);
            }}>Réessayer</button></div>
            : orders.length === 0
              ? <p>Vos commandes apparaîtront ici.</p>
              : visibleOrders.map((order) => <article className="account-order" key={order.id}>
                <div className="account-order-heading"><div><strong>Commande #{order.id.slice(0, 8).toUpperCase()}</strong><span>{new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(order.createdAt))}</span></div><div><strong>{new Intl.NumberFormat("fr-FR").format(order.subtotalCfa)} FCFA</strong><span>{orderLabels[order.status] ?? order.status}</span></div></div>
                <p className={`account-order-payment is-${order.paymentStatus}`}>{paymentLabels[order.paymentStatus] ?? order.paymentStatus} · {paymentMethodLabels[order.paymentMethod] ?? order.paymentMethod.replaceAll("_", " ")}</p>
                <ul className="account-order-items">{order.items.map((item, index) => <li key={`${item.name}-${index}`}><span>{item.name} <b>× {item.quantity}</b></span><strong>{new Intl.NumberFormat("fr-FR").format(item.lineTotalCfa)} FCFA</strong></li>)}</ul>
              </article>)}
        {!ordersLoading && !ordersMessage && pageCount > 1 && <nav className="account-pagination" aria-label="Pagination des commandes">
          <button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>← Précédent</button>
          <span>Page {currentPage} sur {pageCount}</span>
          <button type="button" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Suivant →</button>
        </nav>}
      </section>
      {feedback && <p className="account-status" role="alert">{feedback}</p>}
      <button className="account-submit" type="button" onClick={signOut} disabled={isSigningOut}>
        {isSigningOut ? "Déconnexion…" : "Me déconnecter"}
        <span aria-hidden="true">→</span>
      </button>
      <Link className="account-overview-back" href="/boutique">Continuer vers la boutique</Link>
      {isAdmin && <Link className="account-overview-back" href="/superadmin">Ouvrir l’administration</Link>}
    </div>
  );
}
