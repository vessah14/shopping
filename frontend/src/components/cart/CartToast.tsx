"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { subscribeToCartAdditions, type CartAddition } from "./cartStore";

/** Confirmation shown after each "Ajouter au panier", with a shortcut to the cart. */
export default function CartToast() {
  const [addition, setAddition] = useState<CartAddition | null>(null);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const unsubscribe = subscribeToCartAdditions((next) => {
      setAddition(next);
      clearTimeout(timeout);
      timeout = setTimeout(() => setAddition(null), 4500);
    });
    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const details = addition ? [addition.size, addition.color].filter(Boolean).join(" · ") : "";
  return (
    <div className="cart-toast-region" role="status" aria-live="polite">
      {addition && <div className="cart-toast">
        <span className="cart-toast-check" aria-hidden="true">✓</span>
        <p><strong>Ajouté au panier</strong><span>{addition.name}{details && ` — ${details}`}</span></p>
        <Link className="cart-toast-link" href="/panier" onClick={() => setAddition(null)}>Voir le panier</Link>
        <button className="cart-toast-close" type="button" onClick={() => setAddition(null)} aria-label="Fermer la notification">×</button>
      </div>}
    </div>
  );
}
