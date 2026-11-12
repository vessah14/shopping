"use client";

import { useState } from "react";
import Link from "next/link";
import { productImage, type Product } from "../../data/store";
import SiteHeader from "../layout/SiteHeader";
import SiteFooter from "../layout/SiteFooter";
import { useCart } from "../cart/cartStore";
import StoreImage from "../ui/StoreImage";
import { whatsappUrl } from "../../data/contact";
import { useHydrated } from "../../lib/use-hydrated";

export default function ProductDetail({ product }: { product: Product }) {
  const [added, setAdded] = useState(false);
  const images = product.images?.length ? product.images : [product.image];
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const selectedImage = images[selectedImageIndex] ?? images[0];
  const hasHydrated = useHydrated();
  const { addItem, items } = useCart();
  const isAvailable = product.isAvailable !== false && (product.stockQuantity === undefined || product.stockQuantity > 0);
  const showAvailable = hasHydrated ? isAvailable : true;
  const cartQuantity = items.find((item) => item.slug === product.slug)?.quantity ?? 0;
  const cartLimit = Math.min(product.stockQuantity ?? 50, 50);
  const isCartLimitReached = cartQuantity >= cartLimit;

  function addToCart() {
    if (!isAvailable || isCartLimitReached) return;
    addItem(product.slug);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  }

  const whatsappMessage = encodeURIComponent(`Bonjour Espace Shopping Plus, je souhaite commander ${product.name} (${product.price}). Pouvez-vous me confirmer les tailles et couleurs disponibles ?`);
  const whatsappHref = `${whatsappUrl}?text=${whatsappMessage}`;

  return (
    <main className="inner-page">
      <SiteHeader />
      <section className="product-detail-section">
        <nav className="product-breadcrumb" aria-label="Fil d’Ariane"><Link href="/">Accueil</Link><span>/</span><Link href="/boutique">Boutique</Link><span>/</span><span>{product.name}</span></nav>
        <div className="product-detail">
          <div className="product-detail-gallery">
            <StoreImage className="product-detail-image" src={productImage(selectedImage, 1500)} alt={product.name} sizes="(max-width: 700px) 90vw, 55vw" />
            {images.length > 1 && <div className="product-detail-thumbnails" aria-label="Autres photos du produit">
              {images.map((image, index) => <button
                className={`product-detail-thumbnail${selectedImageIndex === index ? " is-selected" : ""}`}
                type="button"
                key={`${image}-${index}`}
                onClick={() => setSelectedImageIndex(index)}
                aria-label={`Afficher la photo ${index + 1} de ${product.name}`}
                aria-pressed={selectedImageIndex === index}
              >
                <StoreImage className="product-detail-thumbnail-image" src={productImage(image, 240)} alt="" sizes="84px" />
              </button>)}
            </div>}
          </div>
          <div className="product-detail-copy">
            <p className="eyebrow">{product.category}</p>
            <h1>{product.name}</h1>
            {!showAvailable && <div className="product-detail-badges"><span className="product-stock-badge">Indisponible</span></div>}
            <p className="product-detail-price">{product.originalPrice && <del className="product-old-price">{product.originalPrice}</del>}<span>{product.price}</span></p>
            <p className="product-detail-description">{product.description}</p>
            <div className="product-options">
              <div><h2>Tailles / formats</h2><p>{product.sizes.length ? product.sizes.join(" · ") : "À confirmer auprès de la boutique."}</p></div>
              <div><h2>Couleurs</h2><p>{product.colors.length ? product.colors.join(" · ") : "À confirmer auprès de la boutique."}</p></div>
              <small>{!hasHydrated || product.isAvailable === undefined ? "Tailles et coloris indicatifs ; disponibilité à confirmer auprès de la boutique." : isAvailable ? `Disponible · ${product.stockQuantity} article${product.stockQuantity === 1 ? "" : "s"} en stock.` : "Cet article est actuellement indisponible."}</small>
            </div>
            <ul className="product-detail-benefits"><li>Livraison disponible au Cameroun</li><li>Besoin d’un conseil ? Contactez-nous sur WhatsApp</li></ul>
            <button className="product-cart-button product-detail-add" type="button" onClick={addToCart} disabled={!showAvailable || isCartLimitReached}>{!showAvailable ? "Indisponible" : isCartLimitReached ? "Limite atteinte" : added ? "Ajouté au panier ✓" : "Ajouter au panier"}</button>
            {isCartLimitReached && <p className="product-cart-limit" role="status">La quantité maximale disponible est déjà dans votre panier.</p>}
            <a className="product-whatsapp-cta" href={whatsappHref} target="_blank" rel="noopener noreferrer">Commander ou poser une question sur WhatsApp <span aria-hidden="true">↗</span></a>
            {added && <p className="product-added-message" role="status">L’article a été ajouté à votre panier.</p>}
            <Link className="product-back-link" href="/boutique">← Retour à la boutique</Link>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
