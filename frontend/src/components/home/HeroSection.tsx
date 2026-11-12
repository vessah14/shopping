import Link from "next/link";
import Image from "next/image";
import StoreImage from "../ui/StoreImage";

export default function HeroSection() {
  return (
    <section className="hero" id="accueil" aria-label="Espace Shopping Plus, mode et beauté">
      <div className="hero-copy">
        <p className="hero-kicker"><span>01</span> MODE · BEAUTÉ · CAMEROUN</p>
        <Image className="hero-brand-logo" src="/espace-shopping-plus/logo-principal.png" alt="Logo Espace Shopping Plus" width={116} height={116} priority />
        <h1 className="hero-brand-name"><span>ESPACE</span><span>SHOPPING PLUS</span></h1>
        <p className="hero-tagline">Le style d’ici, à votre image.</p>
        <p className="hero-description">Mode, beauté et cheveux : retrouvez une sélection faite pour vous. Une question ? Écrivez-nous sur WhatsApp.</p>
        <div className="hero-actions">
          <Link className="hero-button" href="/boutique">Découvrir la collection <span aria-hidden="true">→</span></Link>
          <Link className="hero-secondary-link" href="#collections">Nos catégories</Link>
        </div>
        <span className="hero-edition">UNE SÉLECTION FAITE POUR VOUS · AU CAMEROUN</span>
      </div>
      <StoreImage className="hero-image" src="/espace-shopping-plus/hero-accueil.jpg" alt="Femme en tenue terracotta dans une rue ensoleillée" sizes="(max-width: 700px) 100vw, 57vw" objectPosition="50% 8%" priority />
      <span className="hero-image-note" aria-hidden="true">LE STYLE D’ICI</span>
    </section>
  );
}
