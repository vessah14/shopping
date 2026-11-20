import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import SiteFooter from "../../components/layout/SiteFooter";
import SiteHeader from "../../components/layout/SiteHeader";
import { whatsappUrl } from "../../data/contact";
import { formatCfa, getDeliveryZones } from "../../lib/delivery-zones";

export const metadata: Metadata = {
  title: "Livraison et retours",
  description: "Consultez les zones et frais de livraison d’Espace Shopping Plus et contactez la boutique pour une demande de retour ou d’échange.",
};

export default async function DeliveryAndReturnsPage() {
  return <Suspense fallback={<main className="catalog-loading">Chargement des informations de livraison…</main>}><DeliveryAndReturnsContent /></Suspense>;
}

async function DeliveryAndReturnsContent() {
  await connection();
  const zones = await getDeliveryZones();

  return (
    <main className="inner-page">
      <SiteHeader />
      <section className="delivery-page-section">
        <div className="delivery-page-content">
          <p className="eyebrow">INFORMATIONS PRATIQUES</p>
          <h1>Livraison et retours</h1>
          <p className="delivery-page-intro">
            Les frais et délais affichés ci-dessous sont repris dans le récapitulatif de votre panier avant paiement.
            Le montant de la livraison est inclus dans le total payé en ligne.
          </p>

          <section aria-labelledby="delivery-zones-title">
            <h2 id="delivery-zones-title">Zones de livraison</h2>
            {zones.length ? (
              <ul className="delivery-zone-list">
                {zones.map((zone) => (
                  <li key={zone.id}>
                    <strong>{zone.name}</strong>
                    <span className="delivery-zone-fee">{zone.feeCfa ? formatCfa(zone.feeCfa) : "Gratuite"}</span>
                    {zone.delay && <span className="delivery-zone-delay">{zone.delay}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Les zones de livraison ne sont pas disponibles pour le moment. Contactez la boutique pour connaître les modalités.</p>
            )}
          </section>

          <section aria-labelledby="returns-title">
            <h2 id="returns-title">Retours et échanges</h2>
            <p>
              Pour signaler un problème ou demander un échange ou un retour, contactez la boutique avant de renvoyer un article.
              Notre équipe vous indiquera la marche à suivre pour votre commande.
            </p>
            <a className="delivery-contact-button" href={`${whatsappUrl}?text=${encodeURIComponent("Bonjour Espace Shopping Plus, j’ai une question concernant la livraison ou un retour.")}`} target="_blank" rel="noopener noreferrer">
              Contacter la boutique sur WhatsApp <span aria-hidden="true">↗</span>
            </a>
          </section>

          <Link className="delivery-back-link" href="/boutique">← Retour à la boutique</Link>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
