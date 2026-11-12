"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type MouseEvent } from "react";
import { authClient } from "../../lib/auth-client";

type AccountFormProps = { mode: "login" | "register" };

export default function AccountForm({ mode }: AccountFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const isRegistering = mode === "register";

  function switchMode(event: MouseEvent<HTMLAnchorElement>, target: "connexion" | "inscription") {
    event.preventDefault();
    const requestedDestination = new URLSearchParams(window.location.search).get("redirect");
    const allowedDestinations = target === "connexion"
      ? ["/compte", "/panier", "/superadmin"]
      : ["/compte", "/panier"];
    const query = requestedDestination && allowedDestinations.includes(requestedDestination)
      ? `?redirect=${encodeURIComponent(requestedDestination)}`
      : "";
    router.push(`/${target}${query}`);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");
    setIsSubmitting(true);
    const requestedDestination = new URLSearchParams(window.location.search).get("redirect");
    const destinations = new Set(["/compte", "/panier", "/superadmin"]);
    const destination = isRegistering
      ? "/"
      : requestedDestination && destinations.has(requestedDestination) ? requestedDestination : "/compte";

    try {
      const result = isRegistering
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password, callbackURL: destination })
        : await authClient.signIn.email({ email: email.trim(), password, callbackURL: destination });

      if (result.error) {
        if (result.error.status === 401) {
          setFeedback("E-mail ou mot de passe incorrect.");
        } else if (result.error.status === 409 || result.error.status === 422 || result.error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
          setFeedback("Un compte existe déjà avec cette adresse e-mail. Connectez-vous plutôt.");
        } else if (result.error.status >= 500) {
          setFeedback("Le service de compte a rencontré une erreur. Vérifiez le terminal frontend et la connexion PostgreSQL.");
        } else {
          setFeedback(isRegistering
            ? "Le compte n’a pas pu être créé. Vérifiez les informations et réessayez."
            : "La connexion n’a pas abouti. Vérifiez vos informations et réessayez.");
        }
        return;
      }

      router.replace(destination);
      router.refresh();
    } catch {
      setFeedback("Le service de compte ne répond pas. Vérifiez la connexion à la boutique et réessayez.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="account-form-content">
      <Link className="account-return" href="/">← Retour à la boutique</Link>
      <p className="eyebrow">ESPACE SHOPPING PLUS</p>
      <h1>{isRegistering ? "Créer votre espace client" : "Ravi de vous retrouver."}</h1>
      <p className="account-intro">
        {isRegistering
          ? "Créez votre compte pour retrouver votre espace client."
          : "Connectez-vous pour accéder à votre espace client."}
      </p>
      <nav className="account-switch" aria-label="Choisir une action">
        <Link className={!isRegistering ? "selected" : ""} aria-current={!isRegistering ? "page" : undefined} href="/connexion" onClick={(event) => switchMode(event, "connexion")}>Connexion</Link>
        <Link className={isRegistering ? "selected" : ""} aria-current={isRegistering ? "page" : undefined} href="/inscription" onClick={(event) => switchMode(event, "inscription")}>Créer un compte</Link>
      </nav>
      <form className="account-form" onSubmit={submit}>
        {isRegistering && <div>
          <label htmlFor="account-name">Nom complet</label>
          <input id="account-name" name="name" type="text" autoComplete="name" maxLength={100} value={name} onChange={(event) => setName(event.target.value)} required />
        </div>}
        <div>
          <label htmlFor="account-email">Adresse e-mail</label>
          <input id="account-email" name="email" type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} required />
        </div>
        <div>
          <label htmlFor="account-password">Mot de passe</label>
          <div className="account-password-field">
            <input id="account-password" name="password" type={showPassword ? "text" : "password"} autoComplete={isRegistering ? "new-password" : "current-password"} minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required />
            <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>{showPassword ? "Masquer" : "Afficher"}</button>
          </div>
        </div>
        {feedback && <p className="account-status" role="alert">{feedback}</p>}
        <button className="account-submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Veuillez patienter…" : isRegistering ? "Créer mon compte" : "Me connecter"}
          <span aria-hidden="true">→</span>
        </button>
      </form>
      <p className="account-legal">En continuant, vous acceptez que vos informations soient utilisées pour gérer votre espace client.</p>
    </div>
  );
}
