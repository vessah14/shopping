"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function SuperadminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL ?? "http://localhost:3000";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");
    setIsSubmitting(true);

    try {
      const result = await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) {
        setFeedback(result.error.status === 401
          ? "E-mail ou mot de passe incorrect."
          : "La connexion n’a pas abouti. Vérifiez vos informations et réessayez.");
        return;
      }

      const accessResponse = await fetch("/api/superadmin?section=overview", { cache: "no-store" });
      if (accessResponse.status === 403) {
        await authClient.signOut();
        setFeedback("Ce compte n’a pas le rôle administrateur. Utilisez le compte superadmin configuré.");
        return;
      }
      if (!accessResponse.ok) {
        const accessError: unknown = await accessResponse.json().catch(() => null);
        setFeedback(typeof accessError === "object" && accessError !== null && "error" in accessError
          ? String(accessError.error)
          : "Impossible de vérifier les droits de ce compte. Réessayez.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setFeedback("Le service de compte ne répond pas. Vérifiez la connexion à la boutique et réessayez.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="superadmin-login">
      <section className="superadmin-login-card">
        <p className="eyebrow">ESPACE SHOPPING PLUS</p>
        <h1>Administration</h1>
        <p className="superadmin-login-intro">Connectez-vous avec votre compte administrateur pour gérer la boutique.</p>
        <form className="superadmin-login-form" onSubmit={submit}>
          <label htmlFor="superadmin-email">
            Adresse e-mail
            <input id="superadmin-email" name="email" type="email" autoComplete="username" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label htmlFor="superadmin-password">
            Mot de passe
            <input id="superadmin-password" name="password" type="password" autoComplete="current-password" minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          {feedback && <p className="superadmin-login-error" role="alert">{feedback}</p>}
          <button className="superadmin-primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Connexion…" : "Se connecter"}
          </button>
        </form>
        <Link className="superadmin-login-store-link" href={frontendUrl}>Retour à la boutique</Link>
      </section>
    </main>
  );
}
