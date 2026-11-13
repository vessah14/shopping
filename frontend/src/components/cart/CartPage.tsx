"use client";

import Link from "next/link";
import SiteHeader from "../layout/SiteHeader";
import SiteFooter from "../layout/SiteFooter";
import { productImage, type Product } from "../../data/store";
import { whatsappUrl } from "../../data/contact";
import { useCart } from "./cartStore";
import { useEffect } from "react";

function numericPrice(price: string) {
  return Number(price.replace(/\D/g, ""));
}

function formatPrice(value: number) {
  return `${new Intl.NumberFormat("fr-FR").format(value)} FCFA`;
}

export default function CartPage({ products }: { products: Product[] }) {
  const { items, itemCount, setQuantity, removeItem, clear } = useCart();
  const cartProducts = items
    .map((line) => ({
      ...line,
      product: products.find((product) => product.slug === line.slug),
    }))
    .filter((line) => line.product);
  useEffect(() => {
    const availableSlugs = new Set(products.map((product) => product.slug));
    for (const line of items) {
      if (!availableSlugs.has(line.slug)) removeItem(line.slug);
    }
  }, [items, products, removeItem]);
  const subtotal = cartProducts.reduce(
    (sum, line) => sum + numericPrice(line.product!.price) * line.quantity,
    0,
  );
  const validItemCount = cartProducts.reduce((total, line) => total + line.quantity, 0);
  const cartAvailable = cartProducts.length === items.length && cartProducts.every((line) => line.product!.isAvailable !== false && (line.product!.stockQuantity === undefined || line.product!.stockQuantity >= line.quantity));
  const orderMessage = [
    "Bonjour Espace Shopping Plus, je souhaite commander :",
    ...cartProducts.map(({ quantity, product }) =>
      `- ${product!.name} x${quantity} : ${formatPrice(numericPrice(product!.price) * quantity)}`),
    "",
    `Sous-total : ${formatPrice(subtotal)}`,
    "Merci de confirmer la disponibilité et les frais de livraison.",
  ].join("\n");
  const whatsappOrderUrl = `${whatsappUrl}?text=${encodeURIComponent(orderMessage)}`;

  return (
    <main className="inner-page">
      <SiteHeader />
      <section className="cart-page-section">
        <div className="cart-page-heading">
          <p className="eyebrow">VOTRE SÉLECTION</p>
          <h1>Votre panier</h1>
          <p>
            {validItemCount} {validItemCount === 1 ? "article" : "articles"} dans votre
            panier
          </p>
        </div>
        {validItemCount === 0 ? (
          <div className="cart-empty">
            <span className="cart-empty-icon" aria-hidden="true">
              ♡
            </span>
            <h2>Votre panier vous attend.</h2>
            <p>
              Parcourez la boutique et ajoutez les articles qui vous plaisent.
            </p>
            <Link className="cart-continue-button" href="/boutique">
              Découvrir la boutique <span aria-hidden="true">→</span>
            </Link>
          </div>
        ) : (
          <div className="cart-layout">
            <div className="cart-items">
              <div className="cart-list-heading">
                <span>Article</span>
                <button type="button" onClick={clear}>
                  Vider le panier
                </button>
              </div>
              {cartProducts.map(({ slug, quantity, product }) => (
                <article className="cart-line" key={slug}>
                  <Link
                    className="cart-item-image"
                    href={`/produit/${slug}`}
                    style={{
                      backgroundImage: `url("${productImage(product!.image, 320)}")`,
                    }}
                    aria-label={`Voir ${product!.name}`}
                  />
                  <div className="cart-item-info">
                    <p className="cart-item-category">{product!.category}</p>
                    <h2>
                      <Link href={`/produit/${slug}`}>{product!.name}</Link>
                    </h2>
                    <p className="cart-item-price">{product!.price}</p>
                    <div className="cart-item-controls">
                      <div
                        className="cart-quantity"
                        aria-label={`Quantité de ${product!.name}`}
                      >
                        <button
                          type="button"
                          onClick={() => setQuantity(slug, quantity - 1)}
                          aria-label={`Diminuer la quantité de ${product!.name}`}
                        >
                          −
                        </button>
                        <span aria-live="polite">{quantity}</span>
                        <button
                          type="button"
                          onClick={() => setQuantity(slug, quantity + 1)}
                          disabled={product!.isAvailable === false || product!.stockQuantity === 0 || quantity >= Math.min(product!.stockQuantity ?? 50, 50)}
                          aria-label={`Augmenter la quantité de ${product!.name}`}
                        >
                          +
                        </button>
                      </div>
                      <button
                        className="cart-remove"
                        type="button"
                        onClick={() => removeItem(slug)}
                      >
                        Retirer
                      </button>
                    </div>
                  </div>
                  <strong className="cart-line-total">
                    {formatPrice(numericPrice(product!.price) * quantity)}
                  </strong>
                  {product!.isAvailable === false || (product!.stockQuantity !== undefined && quantity > product!.stockQuantity)
                    ? <p className="cart-line-warning" role="alert">{product!.isAvailable === false ? "Cet article n’est plus disponible." : `Stock limité à ${product!.stockQuantity} article${product!.stockQuantity === 1 ? "" : "s"}. Réduisez la quantité pour continuer.`}</p>
                    : null}
                </article>
              ))}
              {cartProducts.length < items.length && <div className="checkout-unavailable">
                Un ou plusieurs articles ont été retirés ou archivés. Supprimez-les du panier pour continuer.
                {items.filter((line) => !products.some((product) => product.slug === line.slug)).map((line) => <button className="cart-remove" type="button" onClick={() => removeItem(line.slug)} key={line.slug}>Retirer {line.slug}</button>)}
              </div>}
              <Link className="cart-back-link" href="/boutique">
                ← Continuer mes achats
              </Link>
            </div>
            <aside className="cart-summary">
              <h2>Récapitulatif</h2>
              <div>
                <span>
                  Sous-total ({validItemCount} article{validItemCount === 1 ? "" : "s"})
                </span>
                <strong>{formatPrice(subtotal)}</strong>
              </div>
              <div>
                <span>Livraison</span>
                <span>À confirmer</span>
              </div>
              <p>
                Les frais de livraison seront confirmés avec notre équipe avant
                la commande.
              </p>
              {cartAvailable ? (
                <a className="cart-contact-button" href={whatsappOrderUrl} target="_blank" rel="noopener noreferrer">
                  Commander sur WhatsApp <span aria-hidden="true">→</span>
                </a>
              ) : (
                <p className="checkout-unavailable">Un article n’est plus disponible dans la quantité choisie. Ajustez votre panier avant de commander.</p>
              )}
            </aside>
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
