"use client";

import Link from "next/link";
import SiteHeader from "../layout/SiteHeader";
import SiteFooter from "../layout/SiteFooter";
import StoreImage from "../ui/StoreImage";
import { productImage, type Product } from "../../data/store";
import { whatsappUrl } from "../../data/contact";
import { lineKey, productQuantity, useCart } from "./cartStore";
import { useState, type FormEvent } from "react";
import { authClient } from "../../lib/auth-client";
import type { DeliveryZone } from "../../lib/delivery-zones";

function numericPrice(price: string) {
  return Number(price.replace(/\D/g, ""));
}

function formatPrice(value: number) {
  return `${new Intl.NumberFormat("fr-FR").format(value)} FCFA`;
}

function lineOptions(line: { size: string; color: string }) {
  return [line.size && `Taille ${line.size}`, line.color && `Couleur ${line.color}`].filter(Boolean).join(" · ");
}

export default function CartPage({ products, deliveryZones }: { products: Product[]; deliveryZones: DeliveryZone[] }) {
  const { items, setQuantity, removeItem, clear } = useCart();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [zoneId, setZoneId] = useState(deliveryZones.length === 1 ? String(deliveryZones[0].id) : "");
  const [city, setCity] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const cartProducts = items
    .map((line) => ({ ...line, key: lineKey(line), product: products.find((product) => product.slug === line.slug) }))
    .filter((line): line is typeof line & { product: Product } => Boolean(line.product));
  const missingLines = items.filter((line) => !products.some((product) => product.slug === line.slug));
  const subtotal = cartProducts.reduce((sum, line) => sum + numericPrice(line.product.price) * line.quantity, 0);
  const zone = deliveryZones.find((candidate) => String(candidate.id) === zoneId);
  const total = subtotal + (zone?.feeCfa ?? 0);
  const validItemCount = cartProducts.reduce((count, line) => count + line.quantity, 0);
  const lineProblem = (line: (typeof cartProducts)[number]) => {
    const { product } = line;
    if (product.isAvailable === false) return "Cet article n’est plus disponible.";
    const inCart = productQuantity(items, product.slug);
    if (product.stockQuantity !== undefined && inCart > product.stockQuantity) {
      return `Stock limité à ${product.stockQuantity} article${product.stockQuantity === 1 ? "" : "s"}. Réduisez la quantité pour continuer.`;
    }
    if ((product.sizes.length > 0 && !product.sizes.includes(line.size)) || (product.colors.length > 0 && !product.colors.includes(line.color))) {
      return "Choisissez de nouveau la taille ou la couleur de cet article.";
    }
    return null;
  };
  const cartAvailable = missingLines.length === 0 && cartProducts.every((line) => !lineProblem(line));
  const isStaff = session?.user.role === "admin" || session?.user.role === "superadmin";

  const whatsappHelpUrl = `${whatsappUrl}?text=${encodeURIComponent("Bonjour Espace Shopping Plus, j’ai une question au sujet de mon panier.")}`;
  const whatsappOrderMessage = [
    "Bonjour Espace Shopping Plus, je souhaite commander :",
    ...cartProducts.map((line) => {
      const options = lineOptions(line);
      return `- ${line.product.name}${options ? ` (${options})` : ""} x${line.quantity}`;
    }),
    `Sous-total : ${formatPrice(subtotal)}`,
    zone ? `Livraison ${zone.name} : ${formatPrice(zone.feeCfa)}` : "Livraison à confirmer avec la boutique.",
  ].join("\n");
  const whatsappOrderUrl = `${whatsappUrl}?text=${encodeURIComponent(whatsappOrderMessage)}`;

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCheckoutError("");
    if (!zone) {
      setCheckoutError("Choisissez votre zone de livraison.");
      return;
    }
    setIsCheckingOut(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cartProducts.map(({ slug, size, color, quantity }) => ({ slug, size, color, quantity })),
          customerName,
          customerEmail,
          phone,
          city,
          deliveryAddress,
          deliveryNotes,
          deliveryZoneId: zone.id,
          paymentMethod: "fapshi",
        }),
      });
      const result: unknown = await response.json().catch(() => null);
      const payload = typeof result === "object" && result !== null
        ? result as { error?: unknown; checkoutUrl?: unknown }
        : {};

      if (!response.ok) {
        throw new Error(typeof payload.error === "string"
          ? payload.error
          : "La commande n’a pas pu être créée. Réessayez.");
      }

      if (typeof payload.checkoutUrl !== "string") {
        throw new Error("La page de paiement n’a pas été reçue. Contactez-nous avant de recommander.");
      }

      const checkoutUrl = new URL(payload.checkoutUrl);
      if (checkoutUrl.protocol !== "https:" || !(checkoutUrl.hostname === "fapshi.com" || checkoutUrl.hostname.endsWith(".fapshi.com"))) {
        throw new Error("L’adresse de paiement reçue n’est pas valide.");
      }

      clear();
      window.location.assign(checkoutUrl);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Le service de paiement est indisponible. Réessayez.");
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
          <p>{validItemCount} {validItemCount === 1 ? "article" : "articles"} dans votre panier</p>
        </div>
        {items.length === 0 ? (
          <div className="cart-empty">
            <span className="cart-empty-icon" aria-hidden="true">♡</span>
            <h2>Votre panier vous attend.</h2>
            <p>Parcourez la boutique et ajoutez les articles qui vous plaisent.</p>
            <Link className="cart-continue-button" href="/boutique">Découvrir la boutique <span aria-hidden="true">→</span></Link>
          </div>
        ) : (
          <div className="cart-layout">
            <div className="cart-items">
              <div className="cart-list-heading">
                <span>Article</span>
                <button type="button" onClick={clear}>Vider le panier</button>
              </div>
              {cartProducts.map((line) => {
                const { key, slug, quantity, product } = line;
                const options = lineOptions(line);
                const problem = lineProblem(line);
                const stockLimit = Math.min(product.stockQuantity ?? 50, 50);
                return (
                  <article className="cart-line" key={key}>
                    <Link className="cart-item-image" href={`/produit/${slug}`} aria-label={`Voir ${product.name}`}>
                      <StoreImage className="cart-item-photo" src={productImage(product.image, 320)} alt="" sizes="110px" />
                    </Link>
                    <div className="cart-item-info">
                      <p className="cart-item-category">{product.category}</p>
                      <h2><Link href={`/produit/${slug}`}>{product.name}</Link></h2>
                      {options && <p className="cart-item-options">{options}</p>}
                      <p className="cart-item-price">{product.price}</p>
                      <div className="cart-item-controls">
                        <div className="cart-quantity" role="group" aria-label={`Quantité de ${product.name}`}>
                          <button type="button" onClick={() => setQuantity(key, quantity - 1)} aria-label={`Diminuer la quantité de ${product.name}`}>−</button>
                          <span aria-live="polite">{quantity}</span>
                          <button
                            type="button"
                            onClick={() => setQuantity(key, quantity + 1)}
                            disabled={product.isAvailable === false || productQuantity(items, slug) >= stockLimit}
                            aria-label={`Augmenter la quantité de ${product.name}`}
                          >+</button>
                        </div>
                        <button className="cart-remove" type="button" onClick={() => removeItem(key)}>Retirer</button>
                      </div>
                    </div>
                    <strong className="cart-line-total">{formatPrice(numericPrice(product.price) * quantity)}</strong>
                    {problem && <p className="cart-line-warning" role="alert">{problem}</p>}
                  </article>
                );
              })}
              {missingLines.length > 0 && <div className="checkout-unavailable">
                Un ou plusieurs articles ne sont plus en vente. Retirez-les pour continuer.
                {missingLines.map((line) => <button className="cart-remove" type="button" onClick={() => removeItem(lineKey(line))} key={lineKey(line)}>Retirer {line.slug}</button>)}
              </div>}
              <Link className="cart-back-link" href="/boutique">← Continuer mes achats</Link>
            </div>

            <aside className="cart-summary" aria-labelledby="cart-summary-title">
              <h2 id="cart-summary-title">Récapitulatif</h2>
              <div><span>Sous-total ({validItemCount} article{validItemCount === 1 ? "" : "s"})</span><strong>{formatPrice(subtotal)}</strong></div>
              <div><span>Livraison{zone ? ` — ${zone.name}` : ""}</span><span>{zone ? (zone.feeCfa ? formatPrice(zone.feeCfa) : "Gratuite") : "Choisissez votre zone"}</span></div>
              <div className="cart-summary-total"><span>{zone ? "Total à payer" : "Total produits"}</span><strong>{formatPrice(total)}</strong></div>

              {!cartAvailable ? (
                <p className="checkout-unavailable">Ajustez votre panier avant de commander.</p>
              ) : isStaff ? (
                <p role="alert">Connectez-vous avec un compte client ou déconnectez-vous pour passer commande.</p>
              ) : deliveryZones.length === 0 ? (
                <p className="checkout-unavailable">Les tarifs de livraison ne sont pas encore disponibles. Contactez-nous pour finaliser votre commande.</p>
              ) : (
                <form className="checkout-form" onSubmit={submitOrder}>
                  {!sessionPending && !session && <>
                    <p className="checkout-guest-note">Pas besoin de compte. <Link href="/connexion?redirect=%2Fpanier">Se connecter</Link> pour retrouver vos commandes.</p>
                    <label>
                      Nom complet
                      <input name="name" autoComplete="name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} required minLength={2} maxLength={100} />
                    </label>
                  </>}
                  <label>
                    Téléphone (Mobile Money)
                    <input type="tel" name="phone" autoComplete="tel" inputMode="tel" placeholder="6XX XX XX XX" value={phone} onChange={(event) => setPhone(event.target.value)} required minLength={8} maxLength={20} pattern="[+0-9 ()-]{8,20}" />
                  </label>
                  {!sessionPending && !session && <label>
                    E-mail <span>(facultatif)</span>
                    <input type="email" name="email" autoComplete="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} maxLength={254} />
                  </label>}
                  <label>
                    Zone de livraison
                    <select name="deliveryZone" value={zoneId} onChange={(event) => setZoneId(event.target.value)} required>
                      <option value="">Choisissez votre zone…</option>
                      {deliveryZones.map((candidate) => <option value={candidate.id} key={candidate.id}>
                        {candidate.name} — {candidate.feeCfa ? formatPrice(candidate.feeCfa) : "gratuite"}{candidate.delay ? ` (${candidate.delay})` : ""}
                      </option>)}
                    </select>
                  </label>
                  <label>
                    Ville / quartier
                    <input name="city" autoComplete="address-level2" value={city} onChange={(event) => setCity(event.target.value)} required minLength={2} maxLength={100} />
                  </label>
                  <label>
                    Adresse de livraison
                    <textarea name="deliveryAddress" autoComplete="street-address" placeholder="Rue, repère, immeuble…" value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} required minLength={8} maxLength={300} rows={3} />
                  </label>
                  <label>
                    Instructions de livraison <span>(facultatif)</span>
                    <textarea name="deliveryNotes" value={deliveryNotes} onChange={(event) => setDeliveryNotes(event.target.value)} maxLength={500} rows={2} />
                  </label>
                  {checkoutError && <p className="checkout-unavailable" role="alert">{checkoutError}</p>}
                  <button className="cart-contact-button cart-pay-button" type="submit" disabled={isCheckingOut || sessionPending}>
                    {isCheckingOut ? "Préparation du paiement…" : `Payer par Mobile Money · ${formatPrice(total)}`}
                    {!isCheckingOut && <span aria-hidden="true">→</span>}
                  </button>
                  <div className="checkout-payment-methods" aria-label="Moyens de paiement acceptés">
                    <span className="payment-badge payment-badge-mtn"><strong>MTN</strong><span>Mobile Money</span></span>
                    <span className="payment-badge payment-badge-orange"><strong>Orange</strong><span>Money</span></span>
                    <small>Paiement sécurisé via Fapshi</small>
                  </div>
                </form>
              )}
              <a className="cart-whatsapp-link" href={deliveryZones.length === 0 ? whatsappOrderUrl : whatsappHelpUrl} target="_blank" rel="noopener noreferrer">
                {deliveryZones.length === 0 ? "Commander par WhatsApp" : "Une question ?"} <span aria-hidden="true">↗</span>
              </a>
              <p className="cart-summary-note"><Link href="/livraison-retours">Consulter les informations de livraison et de retour</Link></p>
            </aside>
          </div>
        )}
      </section>
      <SiteFooter />
    </main>
  );
}
