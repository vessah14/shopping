import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import SiteHeader from "../../components/layout/SiteHeader";
import SiteFooter from "../../components/layout/SiteFooter";
import ContactForm from "../../components/contact/ContactForm";
import { contactPhone, storeAddress, storeMapUrl, whatsappUrl } from "../../data/contact";
import { absoluteSiteUrl } from "../../lib/seo";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contactez Espace Shopping Plus à Douala pour une question sur un produit, une commande ou la livraison.",
  alternates: { canonical: absoluteSiteUrl("/contact") },
  openGraph: {
    title: "Contacter Espace Shopping Plus",
    description: "Une question sur un produit ou une commande ? Contactez notre boutique à Douala.",
    url: absoluteSiteUrl("/contact"),
  },
};

export default function ContactPage() {
  return (
    <main className="inner-page">
      <SiteHeader />
      <section className="contact-page-section">
        <div className="contact-panel">
          <div className="contact-page-copy">
            <p className="contact-eyebrow"><span aria-hidden="true">✦</span> SERVICE CLIENT · ESPACE SHOPPING PLUS</p>
            <h1>Une question sur une coupe, une taille ou une pièce&nbsp;?</h1>
            <p>Un article vous intéresse ou vous hésitez sur votre choix ? Écrivez-nous directement. Notre équipe est là pour vous guider.</p>
            <div className="contact-phone-links">
              <a href={`tel:+${contactPhone.international}`}>Téléphone : {contactPhone.display}</a>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">WhatsApp : {contactPhone.display}</a>
            </div>
            <a className="contact-store-address" href={storeMapUrl} target="_blank" rel="noopener noreferrer">
              <span>Adresse de la boutique</span>
              <strong>{storeAddress}</strong>
              <small>Voir sur Google Maps ↗</small>
            </a>
            <div className="contact-note"><span className="contact-note-line" /><span>Mode, beauté et cheveux · au Cameroun</span></div>
            <Link className="contact-back-link" href="/#accueil">← Retour à la boutique</Link>
          </div>
          <Suspense fallback={<div className="contact-form contact-form-loading">Chargement du formulaire…</div>}><ContactForm /></Suspense>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
