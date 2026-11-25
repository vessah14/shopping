import Link from "next/link";
import { Brand, Icon } from "../ui/Brand";
import { contactPhone, storeAddress, storeMapUrl, whatsappUrl } from "../../data/contact";

export default function SiteFooter() {
  return (
    <footer className="site-footer" id="footer">
      <div className="footer-main">
        <div className="footer-brand-block">
          <Brand alternate />
          <p className="footer-brand-message">Mode, beauté et cheveux.<br />Une sélection pour vous accompagner au quotidien.</p>
          <Link className="footer-contact-link" href="/contact">Besoin d’un conseil ? <span aria-hidden="true">→</span></Link>
          <Link className="footer-contact-link footer-account-link" href="/compte">Mon compte <span aria-hidden="true">→</span></Link>
          <a className="footer-contact-link" href={`tel:+${contactPhone.international}`}>Téléphone : {contactPhone.display}</a>
          <a className="footer-contact-link" href={whatsappUrl} target="_blank" rel="noopener noreferrer">WhatsApp : {contactPhone.display}</a>
          <a className="footer-contact-link footer-address-link" href={storeMapUrl} target="_blank" rel="noopener noreferrer">
            <span>Adresse : {storeAddress}</span><span aria-hidden="true">↗</span>
          </a>
          <div className="footer-social" aria-label="Nos réseaux sociaux">
            <a href="https://www.instagram.com/espaceshopping.cmr/" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><Icon name="instagram" /></a>
            <a href="https://www.facebook.com/share/1CiY4wF8zN/" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><Icon name="facebook" /></a>
            <a href="https://www.tiktok.com/@espace.shopping.c" target="_blank" rel="noopener noreferrer" aria-label="TikTok"><Icon name="tiktok" /></a>
            <a href="https://www.snapchat.com/add/espace_shopping" target="_blank" rel="noopener noreferrer" aria-label="Snapchat"><Icon name="snapchat" /></a>
          </div>
        </div>
        <div className="newsletter">
          <p className="newsletter-kicker">UN CONSEIL, UNE QUESTION ?</p>
          <h2>La boutique vous répond sur WhatsApp.</h2>
          <p>Écrivez-nous pour en savoir plus sur un article ou sa disponibilité.</p>
          <a className="newsletter-whatsapp-link" href={`${whatsappUrl}?text=${encodeURIComponent("Bonjour Espace Shopping Plus, j’aimerais en savoir plus sur votre sélection.")}`} target="_blank" rel="noopener noreferrer">
            Écrire à la boutique <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
      <div className="footer-bottom">
        <nav className="footer-legal" aria-label="Liens utiles">
          <Link href="/boutique">Boutique</Link><Link href="/#collections">Nos catégories</Link><Link href="/livraison-retours">Livraison et retours</Link><Link href="/contact">Contact</Link>
        </nav>
        <span>© 2026 Espace Shopping Plus</span>
      </div>
    </footer>
  );
}
