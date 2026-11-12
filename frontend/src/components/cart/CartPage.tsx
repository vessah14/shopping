"use client";

import Link from "next/link";
import SiteHeader from "../layout/SiteHeader";
import SiteFooter from "../layout/SiteFooter";
import { productImage, type Product } from "../../data/store";
import { useCart } from "./cartStore";
import { useEffect, useState, type FormEvent } from "react";
import { authClient } from "../../lib/auth-client";

function numericPrice(price: string) {
  return Number(price.replace(/\D/g, ""));
}

function formatPrice(value: number) {
  return `${new Intl.NumberFormat("fr-FR").format(value)} FCFA`;
}

export default function CartPage({ products }: { products: Product[] }) {
  const { items, itemCount, setQuantity, removeItem, clear } = useCart();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [checkoutError, setCheckoutError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completedOrder, setCompletedOrder] = useState("");
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

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setCheckoutError("");
    setSubmitting(true);
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map(({ slug, quantity }) => ({ slug, quantity })),
          phone: form.get("phone"),
          city: form.get("city"),
          deliveryAddress: form.get("deliveryAddress"),
          deliveryNotes: form.get("deliveryNotes"),
          paymentMethod: form.get("paymentMethod"),
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message = typeof result === "object" && result !== null && "error" in result ? String(result.error) : "La commande n’a pas pu être enregistrée.";
        throw new Error(message);
      }
      if (typeof result !== "object" || result === null || !("id" in result) || typeof result.id !== "string") {
        throw new Error("La commande a été reçue, mais son numéro n’a pas pu être confirmé.");
      }
      clear();
      setCompletedOrder(result.id);
      if ("checkoutUrl" in result && typeof result.checkoutUrl === "string") {
        window.location.assign(result.checkoutUrl);
        return;
      }
      formElement.reset();
    } catch (reason) {
      setCheckoutError(reason instanceof Error ? reason.message : "Le service de commande ne répond pas. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

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
        {completedOrder && <p className="checkout-success" role="status">Commande {completedOrder.slice(0, 8).toUpperCase()} enregistrée. Notre équipe confirmera les détails avec vous.</p>}
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
                votre commande.
              </p>
              <a className="cart-pay-button" href="#checkout">
                Commander <span aria-hidden="true">↓</span>
              </a>
              <Link className="cart-contact-button" href="/contact">
                Contacter la boutique <span aria-hidden="true">→</span>
              </Link>
              {cartAvailable ? <section className="checkout-panel" id="checkout">
                <h2>Finaliser la commande</h2>
                {sessionPending ? <p>Vérification de votre compte…</p>
                    : !session ? <p>Connectez-vous pour commander. <Link href="/connexion?redirect=%2Fpanier">Se connecter</Link></p>
                      : session.user.role === "admin" || session.user.role === "superadmin" ? <p>Connectez-vous avec un compte client pour passer commande.</p>
                        : <form className="checkout-form" onSubmit={submitOrder}>
                          <label>Téléphone<input name="phone" type="tel" autoComplete="tel" required minLength={8} maxLength={20} placeholder="+237 6XX XXX XXX" /></label>
                          <label>Ville<input name="city" required minLength={2} maxLength={100} autoComplete="address-level2" /></label>
                          <label>Adresse de livraison<textarea name="deliveryAddress" required minLength={8} maxLength={300} autoComplete="street-address" rows={3} /></label>
                          <label>Informations complémentaires <span>(facultatif)</span><textarea name="deliveryNotes" maxLength={500} rows={2} /></label>
                          <label>Moyen de paiement<select name="paymentMethod" defaultValue="cash_on_delivery"><option value="cash_on_delivery">Paiement à la livraison</option><option value="saspay">Mobile Money ou carte avec SasPay</option><option value="mtn_money">MTN Mobile Money (confirmation manuelle)</option><option value="orange_money">Orange Money (confirmation manuelle)</option></select></label>
                          {checkoutError && <p className="form-error" role="alert">{checkoutError}</p>}
                          <button className="cart-contact-button" type="submit" disabled={submitting}>{submitting ? "Enregistrement…" : "Confirmer la commande"} <span aria-hidden="true">→</span></button>
                        </form>}
              </section> : <p className="checkout-unavailable">Un article n’est plus disponible dans la quantité choisie. Ajustez votre panier avant de commander.</p>}
            </aside>
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
