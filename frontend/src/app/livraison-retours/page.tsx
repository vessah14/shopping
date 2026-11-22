import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import SiteFooter from "../../components/layout/SiteFooter";
import SiteHeader from "../../components/layout/SiteHeader";
import { storeAddress, storeMapUrl, whatsappUrl } from "../../data/contact";
import { formatCfa, getDeliveryZones } from "../../lib/delivery-zones";

export const metadata: Metadata = {
  title: "Livraison et retours",
  description: "Retrait gratuit en boutique à Douala, informations de livraison et demandes de retour ou d’échange.",
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
            Si une zone de livraison est disponible, ses frais et délais sont affichés dans le panier avant paiement et les frais s’ajoutent au total.
          </p>

          <section aria-labelledby="pickup-title">
            <h2 id="pickup-title">Retrait en boutique</h2>
            <p>Le retrait en boutique est gratuit. Choisissez cette option au moment du paiement en ligne.</p>
            <p><a className="delivery-pickup-map" href={storeMapUrl} target="_blank" rel="noopener noreferrer">{storeAddress} · Voir sur la carte ↗</a></p>
          </section>

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
              <p>
                La livraison en ligne n’est pas encore configurée. Pour organiser une livraison,{" "}
                <a className="delivery-pickup-map" href={`${whatsappUrl}?text=${encodeURIComponent("Bonjour Espace Shopping Plus, je souhaite organiser une livraison.")}`} target="_blank" rel="noopener noreferrer">contactez la boutique sur WhatsApp</a>.
              </p>
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
