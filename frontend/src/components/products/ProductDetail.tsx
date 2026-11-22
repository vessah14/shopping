"use client";

import { useState } from "react";
import Link from "next/link";
import { productImage, type Product } from "../../data/store";
import SiteHeader from "../layout/SiteHeader";
import SiteFooter from "../layout/SiteFooter";
import { productQuantity, useCart } from "../cart/cartStore";
import StoreImage from "../ui/StoreImage";
import { whatsappUrl } from "../../data/contact";
import ProductCard from "./ProductCard";
import { stockLabel } from "./stock";

function OptionPicker({ label, options, value, onChange, missing }: { label: string; options: string[]; value: string; onChange: (value: string) => void; missing: boolean }) {
  if (!options.length) return null;
  return (
    <fieldset className={`product-option-picker${missing ? " is-missing" : ""}`}>
      <legend>{label}{value && <span> : {value}</span>}</legend>
      <div className="product-option-values">
        {options.map((option) => <button
          type="button"
          className={value === option ? "product-option is-selected" : "product-option"}
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          key={option}
        >{option}</button>)}
      </div>
      {missing && <p className="product-option-error" role="alert">Choisissez {label.toLowerCase() === "taille" ? "une taille" : "une couleur"}.</p>}
    </fieldset>
  );
}

export default function ProductDetail({ product, relatedProducts = [] }: { product: Product; relatedProducts?: Product[] }) {
  const images = product.images?.length ? product.images : [product.image];
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const activeImageIndex = Math.min(selectedImageIndex, images.length - 1);
  const selectedImage = images[activeImageIndex] ?? images[0];
  const [size, setSize] = useState(product.sizes.length === 1 ? product.sizes[0] : "");
  const [color, setColor] = useState(product.colors.length === 1 ? product.colors[0] : "");
  const [showMissing, setShowMissing] = useState(false);
  const { addItem, items } = useCart();
  const isAvailable = product.isAvailable !== false && (product.stockQuantity === undefined || product.stockQuantity > 0);
  const cartQuantity = productQuantity(items, product.slug);
  const cartLimit = Math.min(product.stockQuantity ?? 50, 50);
  const isCartLimitReached = cartQuantity >= cartLimit;
  const missingSize = product.sizes.length > 0 && !size;
  const missingColor = product.colors.length > 0 && !color;
  const lowStock = isAvailable ? stockLabel(product.stockQuantity) : null;

  function addToCart() {
    if (!isAvailable || isCartLimitReached) return;
    if (missingSize || missingColor) {
      setShowMissing(true);
      return;
    }
    addItem(product.slug, { size, color, name: product.name });
  }

  function showPreviousImage() {
    setSelectedImageIndex((index) => (Math.min(index, images.length - 1) - 1 + images.length) % images.length);
  }

  function showNextImage() {
    setSelectedImageIndex((index) => (Math.min(index, images.length - 1) + 1) % images.length);
  }

  const selection = [size && `taille ${size}`, color && `couleur ${color}`].filter(Boolean).join(", ");
  const whatsappMessage = encodeURIComponent(`Bonjour Espace Shopping Plus, je souhaite avoir des informations sur ${product.name} (${product.price})${selection ? ` en ${selection}` : ""}. Est-il disponible ?`);
  const whatsappHref = `${whatsappUrl}?text=${whatsappMessage}`;

  return (
    <main className="inner-page">
      <SiteHeader />
      <section className="product-detail-section">
        <nav className="product-breadcrumb" aria-label="Fil d’Ariane"><Link href="/">Accueil</Link><span>/</span><Link href="/boutique">Boutique</Link><span>/</span><Link href={`/boutique?categorie=${encodeURIComponent(product.category)}`}>{product.category}</Link><span>/</span><span>{product.name}</span></nav>
        <div className="product-detail">
          <div className="product-detail-gallery">
            <div className="product-detail-viewer" role="region" aria-label={`Galerie photo de ${product.name}`}>
              <StoreImage
                className="product-detail-image"
                src={productImage(selectedImage, 1500)}
                alt={images.length > 1 ? `${product.name}, photo ${activeImageIndex + 1} sur ${images.length}` : product.name}
                sizes="(max-width: 700px) 90vw, 55vw"
              />
              {images.length > 1 && <>
                <button className="product-detail-carousel-control product-detail-carousel-previous" type="button" onClick={showPreviousImage} aria-label="Photo précédente">
                  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                </button>
                <button className="product-detail-carousel-control product-detail-carousel-next" type="button" onClick={showNextImage} aria-label="Photo suivante">
                  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                </button>
                <span className="product-detail-image-count" aria-live="polite">{activeImageIndex + 1} / {images.length}</span>
              </>}
            </div>
            {images.length > 1 && <div className="product-detail-thumbnails" role="group" aria-label={`Choisir une photo de ${product.name}`}>
              {images.map((image, index) => <button
                className={`product-detail-thumbnail${activeImageIndex === index ? " is-selected" : ""}`}
                type="button"
                key={`${image}-${index}`}
                onClick={() => setSelectedImageIndex(index)}
                aria-label={`Afficher la photo ${index + 1} de ${product.name}`}
                aria-pressed={activeImageIndex === index}
              >
                <StoreImage className="product-detail-thumbnail-image" src={productImage(image, 240)} alt="" sizes="84px" />
              </button>)}
            </div>}
          </div>
          <div className="product-detail-copy">
            <p className="eyebrow">{product.category}</p>
            <h1>{product.name}</h1>
            {!isAvailable && <div className="product-detail-badges"><span className="product-stock-badge">Indisponible</span></div>}
            <p className="product-detail-price">{product.originalPrice && <del className="product-old-price">{product.originalPrice}</del>}<span>{product.price}</span></p>
            {lowStock && <p className="product-low-stock">{lowStock}</p>}
            <p className="product-detail-description">{product.description}</p>
            {isAvailable && <div className="product-options">
              <OptionPicker label="Taille" options={product.sizes} value={size} onChange={(value) => { setSize(value); }} missing={showMissing && missingSize} />
              <OptionPicker label="Couleur" options={product.colors} value={color} onChange={(value) => { setColor(value); }} missing={showMissing && missingColor} />
            </div>}
            <button className="product-cart-button product-detail-add" type="button" onClick={addToCart} disabled={!isAvailable || isCartLimitReached}>{!isAvailable ? "Indisponible" : isCartLimitReached ? "Limite atteinte" : "Ajouter au panier"}</button>
            {isCartLimitReached && isAvailable && <p className="product-cart-limit" role="status">La quantité maximale disponible est déjà dans votre panier.</p>}
            <ul className="product-detail-benefits">
              <li>Paiement sécurisé par Mobile Money (MTN, Orange)</li>
              <li>Livraison au Cameroun — frais affichés avant le paiement</li>
              <li><Link href="/livraison-retours">Conditions de livraison et de retour</Link></li>
            </ul>
            <a className="product-whatsapp-cta" href={whatsappHref} target="_blank" rel="noopener noreferrer">Une question ? Écrivez-nous sur WhatsApp <span aria-hidden="true">↗</span></a>
            <Link className="product-back-link" href="/boutique">← Retour à la boutique</Link>
          </div>
        </div>
      </section>
      {relatedProducts.length > 0 && <section className="related-products" aria-labelledby="related-products-title">
        <h2 id="related-products-title">Vous aimerez aussi</h2>
        <div className="product-grid">
          {relatedProducts.map((related) => <ProductCard product={related} cartQuantity={productQuantity(items, related.slug)} onAddToCart={addItem} key={related.slug} />)}
        </div>
      </section>}
      <SiteFooter />
    </main>
  );
}
