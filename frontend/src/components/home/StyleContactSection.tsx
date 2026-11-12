import { whatsappUrl } from "../../data/contact";

export default function StyleContactSection() {
  return (
    <section className="style-contact-section">
      <div className="style-contact-copy">
        <span className="style-contact-mark" aria-hidden="true">✦</span>
        <p className="eyebrow">BESOIN D’UN RENSEIGNEMENT ?</p>
        <h2>Échangeons sur WhatsApp.</h2>
        <p>Une question sur un article, sa taille ou sa disponibilité ? Notre équipe vous répond directement.</p>
      </div>
      <a className="button-light" href={`${whatsappUrl}?text=${encodeURIComponent("Bonjour Espace Shopping Plus, j’aimerais un renseignement sur votre sélection.")}`} target="_blank" rel="noopener noreferrer">Écrire à la boutique <span className="style-contact-arrow" aria-hidden="true">→</span></a>
      <span className="style-contact-side" aria-hidden="true">ESPACE SHOPPING PLUS <i>·</i> CAMEROUN</span>
    </section>
  );
}
