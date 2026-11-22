"use client";

import { useEffect, useState } from "react";

type Order = {
  id: string;
  paymentStatus: string;
};

function isOrderStatus(value: unknown): value is Order {
  return typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "paymentStatus" in value &&
    typeof value.paymentStatus === "string";
}

export default function PaymentStatusPoller({ orderId, accessToken }: { orderId: string; accessToken: string }) {
  const [message, setMessage] = useState("Nous attendons la confirmation sécurisée de Fapshi…");

  useEffect(() => {
    if (!accessToken) return;

    let active = true;
    let timeout: ReturnType<typeof setTimeout>;
    let attempts = 0;

    async function checkStatus() {
      try {
        const response = await fetch(
          `/api/orders/${encodeURIComponent(orderId)}/status?token=${encodeURIComponent(accessToken)}`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          const result: unknown = await response.json().catch(() => null);
          const error = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
            ? result.error
            : "Le statut du paiement est indisponible.";
          throw new Error(response.status === 404 ? "Ce lien de suivi est invalide ou expiré." : error);
        }

        const result: unknown = await response.json();
        if (!isOrderStatus(result) || result.id !== orderId) {
          throw new Error("La réponse de suivi de commande est invalide.");
        }

        if (!active) return;
        if (result.paymentStatus === "confirmed") {
          setMessage("Paiement confirmé. Merci pour votre commande !");
          return;
        }
        if (result.paymentStatus === "failed") {
          setMessage("Le paiement n’a pas abouti. Votre commande est enregistrée comme non payée.");
          return;
        }

        attempts += 1;
        setMessage(
          attempts < 40
            ? "Nous attendons la confirmation sécurisée de Fapshi…"
            : "La confirmation prend plus de temps que prévu. Revenez sur cette page dans quelques instants.",
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
  }, [orderId, accessToken]);

  return <p role="status" aria-live="polite">{accessToken ? message : "Le lien de suivi est incomplet. Contactez-nous si votre paiement a été débité."}</p>;
}
