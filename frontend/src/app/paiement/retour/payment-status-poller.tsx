"use client";

import { useEffect, useState } from "react";

type Order = {
  id: string;
  paymentStatus: string;
};

function isOrder(value: unknown): value is Order {
  return typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "paymentStatus" in value &&
    typeof value.paymentStatus === "string";
}

export default function PaymentStatusPoller({ orderId }: { orderId: string }) {
  const [message, setMessage] = useState("Nous attendons la confirmation sécurisée de SasPay…");

  useEffect(() => {
    let active = true;
    let timeout: ReturnType<typeof setTimeout>;
    let attempts = 0;

    async function checkStatus() {
      try {
        const response = await fetch("/api/orders", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Connectez-vous pour consulter le statut de votre commande.");
        }

        const result: unknown = await response.json();
        const order = Array.isArray(result)
          ? result.find((item): item is Order => isOrder(item) && item.id === orderId)
          : undefined;
        if (!order) {
          throw new Error("Cette commande est introuvable dans votre compte.");
        }

        if (!active) return;
        if (order.paymentStatus === "confirmed") {
          setMessage("Paiement confirmé. Merci pour votre commande !");
          return;
        }
        if (order.paymentStatus === "failed") {
          setMessage("Le paiement n’a pas abouti. Votre commande est enregistrée comme non payée.");
          return;
        }

        attempts += 1;
        setMessage(
          attempts < 40
            ? "Nous attendons la confirmation sécurisée de SasPay…"
            : "La confirmation prend plus de temps que prévu. Consultez vos commandes dans votre compte.",
        );
        if (attempts < 40) {
          timeout = setTimeout(checkStatus, 3000);
        }
      } catch (error) {
        if (active) {
          setMessage(error instanceof Error ? error.message : "Le statut du paiement est indisponible.");
        }
      }
    }

    void checkStatus();
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [orderId]);

  return <p role="status" aria-live="polite">{message}</p>;
}
