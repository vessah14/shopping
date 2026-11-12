"use client";

import { useState } from "react";
import Link from "next/link";
import type { Product } from "../../data/store";
import { productImage } from "../../data/store";
import { useHydrated } from "../../lib/use-hydrated";
import StoreImage from "../ui/StoreImage";


export default function ProductCard({ product, cartQuantity, onAddToCart }: { product: Product; cartQuantity: number; onAddToCart: (slug: string) => void }) {
  const [added, setAdded] = useState(false);
  const hasHydrated = useHydrated();
  const isAvailable = product.isAvailable !== false && (product.stockQuantity === undefined || product.stockQuantity > 0);
  const showAvailable = hasHydrated ? isAvailable : true;
  const cartLimit = Math.min(product.stockQuantity ?? 50, 50);
  const isCartLimitReached = cartQuantity >= cartLimit;

  function addToCart() {
    if (!isAvailable || isCartLimitReached) return;
    onAddToCart(product.slug);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  }


  return (
    <article className="product-card">
      <Link className="product-image-link" href={`/produit/${product.slug}`} aria-label={`Voir le détail de ${product.name}`}>
        <StoreImage className="product-image" src={productImage(product.image, 1200)} alt={product.name} sizes="(max-width: 700px) 48vw, (max-width: 1000px) 30vw, 19vw" />
        {!showAvailable && <span className="product-image-badges"><span className="product-stock-badge">Indisponible</span></span>}
      </Link>
      <div className="product-info">
        <h3><Link href={`/produit/${product.slug}`}>{product.name}</Link></h3>
        <p className="product-short-description">{product.description}</p>
        <p className="product-price">{product.originalPrice && <del className="product-old-price">{product.originalPrice}</del>}<span>{product.price}</span></p>
        <div className="product-actions">
          <Link className="product-view-button" href={`/produit/${product.slug}`}>Détail</Link>
          <button className="product-cart-button" type="button" onClick={addToCart} disabled={!showAvailable || isCartLimitReached}>{!showAvailable ? "Indisponible" : isCartLimitReached ? "Limite atteinte" : added ? "Ajouté ✓" : "Ajouter au panier"}</button>
          {isCartLimitReached && <p className="product-cart-limit" role="status">Quantité maximale disponible déjà dans votre panier.</p>}
        </div>
      </div>
    </article>
  );
}
