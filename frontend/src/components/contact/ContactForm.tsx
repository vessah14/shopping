"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { whatsappUrl } from "../../data/contact";

export default function ContactForm() {
  const searchParams = useSearchParams();
  const initialProduct = searchParams.get("produit") ?? "";
  const [message, setMessage] = useState(initialProduct ? `Bonjour, je souhaite en savoir plus sur ${initialProduct}.` : "");

  function sendToWhatsApp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const subject = String(form.get("subject") ?? "");
    const message = String(form.get("message") ?? "").trim();
    const text = `Bonjour Espace Shopping Plus, je m’appelle ${name}.\nSujet : ${subject}\n\n${message}`;
    window.open(`${whatsappUrl}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <form className="contact-form" onSubmit={sendToWhatsApp}>
      <div className="contact-form-heading">
        <span className="contact-form-overline">NOUS VOUS RÉPONDONS SUR WHATSAPP</span>
        <h2>Écrivez-nous</h2>
        <p>Quelques détails nous aideront à mieux vous conseiller.</p>
      </div>
      <label htmlFor="contact-name">Votre prénom</label>
      <input id="contact-name" name="name" autoComplete="given-name" required placeholder="Ex. Aïcha" />
      <label htmlFor="contact-subject">Votre question concerne</label>
      <select id="contact-subject" name="subject" defaultValue="" required>
        <option value="" disabled>Choisir un sujet</option>
        <option>Coupe ou coiffure</option><option>Taille ou disponibilité</option><option>Une commande</option><option>Conseil mode ou beauté</option><option>Autre question</option>
      </select>
      <label htmlFor="contact-message">Votre message</label>
      <textarea id="contact-message" name="message" rows={4} required value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Bonjour, j’aimerais en savoir plus sur…" />
      <button className="whatsapp-submit" type="submit">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 11.8a8.2 8.2 0 0 1-12.1 7.1L3 20l1.2-4.8a8.2 8.2 0 1 1 16-3.4Z" /><path d="M8.7 8.1c.2-.5.4-.5.7-.5h.5c.2 0 .4 0 .5.4l.7 1.7c.1.3.1.4 0 .6l-.5.6c-.2.2-.3.3-.1.6a7 7 0 0 0 1.4 1.6c.7.6 1.2.8 1.5.9.2.1.4.1.6-.1l.7-.9c.2-.2.4-.2.6-.1l1.7.8c.3.1.4.2.4.4 0 .3-.2 1.2-.8 1.7-.5.4-1.1.6-1.8.5-.7-.1-1.6-.4-2.7-.9-1.8-.8-3-2.2-3.4-2.7-.4-.5-1.2-1.6-1.2-2.8 0-1 .5-1.5.7-1.8Z" /></svg>
        Continuer sur WhatsApp <span aria-hidden="true">→</span>
      </button>
      <small>WhatsApp s’ouvrira avec votre message prêt à être envoyé.</small>
    </form>
  );
}
