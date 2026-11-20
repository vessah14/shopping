"use client";

import Link from "next/link";
import type { Product } from "../../data/store";
import { productImage } from "../../data/store";
import type { CartOptions } from "../cart/cartStore";
import StoreImage from "../ui/StoreImage";
import { stockLabel } from "./stock";

export default function ProductCard({ product, cartQuantity, onAddToCart }: { product: Product; cartQuantity: number; onAddToCart: (slug: string, options?: CartOptions) => void }) {
  const isAvailable = product.isAvailable !== false && (product.stockQuantity === undefined || product.stockQuantity > 0);
  const cartLimit = Math.min(product.stockQuantity ?? 50, 50);
  const isCartLimitReached = cartQuantity >= cartLimit;
  // Products sold in several sizes or colours must be configured on their page first.
  const needsOptions = product.sizes.length > 0 || product.colors.length > 0;
  const lowStock = isAvailable ? stockLabel(product.stockQuantity) : null;
  const href = `/produit/${product.slug}`;

  return (
    <article className="product-card">
      <Link className="product-image-link" href={href} aria-label={`Voir le détail de ${product.name}`}>
        <StoreImage className="product-image" src={productImage(product.image, 1200)} alt={product.name} sizes="(max-width: 700px) 48vw, (max-width: 1000px) 30vw, 19vw" />
        {(!isAvailable || product.originalPrice) && <span className="product-image-badges">
          {!isAvailable && <span className="product-stock-badge">Indisponible</span>}
          {isAvailable && product.originalPrice && <span className="product-promo-badge">Promo</span>}
        </span>}
      </Link>
      <div className="product-info">
        <h3><Link href={href}>{product.name}</Link></h3>
        <p className="product-short-description">{product.description}</p>
        <p className="product-price">{product.originalPrice && <del className="product-old-price">{product.originalPrice}</del>}<span>{product.price}</span></p>
        {lowStock && <p className="product-low-stock">{lowStock}</p>}
        <div className="product-actions">
          {!isAvailable
            ? <button className="product-cart-button" type="button" disabled>Indisponible</button>
            : needsOptions
              ? <Link className="product-cart-button" href={href}>Choisir {product.sizes.length ? "la taille" : "la couleur"}</Link>
              : <button className="product-cart-button" type="button" onClick={() => onAddToCart(product.slug, { name: product.name })} disabled={isCartLimitReached}>{isCartLimitReached ? "Limite atteinte" : "Ajouter au panier"}</button>}
          {isCartLimitReached && isAvailable && <p className="product-cart-limit" role="status">Quantité maximale disponible déjà dans votre panier.</p>}
        </div>
      </div>
    </article>
  );
}
