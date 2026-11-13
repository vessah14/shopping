"use client";

import Link from "next/link";
import SiteHeader from "../layout/SiteHeader";
import SiteFooter from "../layout/SiteFooter";
import { productImage, type Product } from "../../data/store";
import { whatsappUrl } from "../../data/contact";
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
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);
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

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCheckoutError("");
    setIsCheckingOut(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cartProducts.map(({ slug, quantity }) => ({ slug, quantity })),
          phone,
          city,
          deliveryAddress,
          deliveryNotes,
          paymentMethod: "saspay",
        }),
      });
      const result: unknown = await response.json();
      const payload = typeof result === "object" && result !== null
        ? result as { error?: unknown; checkoutUrl?: unknown }
        : {};

      if (!response.ok) {
        throw new Error(typeof payload.error === "string"
          ? payload.error
          : "La commande n’a pas pu être créée. Réessayez.");
      }

      if (typeof payload.checkoutUrl !== "string") {
        throw new Error("La session de paiement SasPay n’a pas été reçue. Contactez-nous avant de recommander.");
      }

      const checkoutUrl = new URL(payload.checkoutUrl);
      if (checkoutUrl.protocol !== "https:" || checkoutUrl.hostname !== "pay.saspay.me") {
        throw new Error("L’adresse de paiement SasPay reçue n’est pas valide.");
      }

      window.location.assign(checkoutUrl);
    } catch (error) {
      setCheckoutError(error instanceof Error
        ? error.message
        : "Le service de paiement est indisponible. Réessayez.");
      setIsCheckingOut(false);
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
                <>
                  <a className="cart-contact-button" href={whatsappOrderUrl} target="_blank" rel="noopener noreferrer">
                    Commander sur WhatsApp <span aria-hidden="true">→</span>
                  </a>
                  <div className="checkout-panel">
                    <h2>Payer en ligne avec SasPay</h2>
                    <p>
                      Le paiement porte sur le sous-total affiché. Les frais de livraison
                      seront confirmés avec notre équipe.
                    </p>
                    {sessionPending ? (
                      <p role="status">Vérification de votre compte…</p>
                    ) : !session ? (
                      <p>
                        <Link href="/connexion?redirect=%2Fpanier">Connectez-vous</Link> à votre compte client
                        pour payer et suivre votre commande.
                      </p>
                    ) : session.user.role === "admin" || session.user.role === "superadmin" ? (
                      <p role="alert">Connectez-vous avec un compte client pour passer commande.</p>
                    ) : (
                      <form className="checkout-form" onSubmit={submitOrder}>
                        <label>
                          Téléphone
                          <input
                            type="tel"
                            name="phone"
                            autoComplete="tel"
                            value={phone}
                            onChange={(event) => setPhone(event.target.value)}
                            required
                            minLength={8}
                            maxLength={20}
                            pattern="[+0-9 ()-]{8,20}"
                          />
                        </label>
                        <label>
                          Ville
                          <input
                            name="city"
                            autoComplete="address-level2"
                            value={city}
                            onChange={(event) => setCity(event.target.value)}
                            required
                            minLength={2}
                            maxLength={100}
                          />
                        </label>
                        <label>
                          Adresse de livraison
                          <textarea
                            name="deliveryAddress"
                            autoComplete="street-address"
                            value={deliveryAddress}
                            onChange={(event) => setDeliveryAddress(event.target.value)}
                            required
                            minLength={8}
                            maxLength={300}
                            rows={3}
                          />
                        </label>
                        <label>
                          Instructions de livraison <span>(facultatif)</span>
                          <textarea
                            name="deliveryNotes"
                            value={deliveryNotes}
                            onChange={(event) => setDeliveryNotes(event.target.value)}
                            maxLength={500}
                            rows={2}
                          />
                        </label>
                        {checkoutError && <p className="checkout-unavailable" role="alert">{checkoutError}</p>}
                        <button className="cart-contact-button" type="submit" disabled={isCheckingOut}>
                          {isCheckingOut ? "Préparation du paiement…" : `Payer ${formatPrice(subtotal)} avec SasPay`}
                          {!isCheckingOut && <span aria-hidden="true">→</span>}
                        </button>
                      </form>
                    )}
                  </div>
                </>
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
