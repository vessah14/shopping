"use client";

import { useEffect, useState, type FormEvent } from "react";
import { isStoreComment, type StoreComment } from "../../lib/store-comments";

export default function TestimonialsSection() {
  const [comments, setComments] = useState<StoreComment[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [formStatus, setFormStatus] = useState("");
  const [activeCommentIndex, setActiveCommentIndex] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadComments() {
      try {
        const response = await fetch("/api/comments", { cache: "no-store", signal: controller.signal });
        const result: unknown = await response.json();
        if (!response.ok) {
          const error = result && typeof result === "object" && "error" in result &&
            typeof result.error === "string" ? result.error : "Impossible de charger les commentaires.";
          throw new Error(error);
        }
        if (!Array.isArray(result) || !result.every(isStoreComment)) {
          throw new Error("La liste des commentaires reçue est invalide.");
        }
        setComments(result);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setLoadError(error instanceof Error ? error.message : "Impossible de charger les commentaires.");
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void loadComments();
    return () => controller.abort();
  }, []);

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setFormStatus("");

    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, message }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const error = result && typeof result === "object" && "error" in result &&
          typeof result.error === "string" ? result.error : "Impossible d’ajouter votre commentaire.";
        throw new Error(error);
      }
      if (!isStoreComment(result)) throw new Error("Le commentaire enregistré est invalide.");

      setComments((current) => [result, ...current.filter((comment) => comment.id !== result.id)].slice(0, 50));
      setActiveCommentIndex(0);
      setMessage("");
      setFormStatus("Merci, votre commentaire a bien été ajouté.");
    } catch (error) {
      setFormStatus(error instanceof Error ? error.message : "Impossible d’ajouter votre commentaire.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function showComment(offset: number) {
    setActiveCommentIndex((current) => (current + offset + comments.length) % comments.length);
  }

  const activeComment = comments[activeCommentIndex];

  return (
    <section className="comments-section" id="commentaires">
      <div className="comments-intro">
        <p className="eyebrow">VOTRE BOUTIQUE, À VOTRE ÉCOUTE</p>
        <h2>Partagez votre avis.</h2>
        <p>Votre expérience compte. Laissez un commentaire et découvrez les retours de notre communauté.</p>
        <form className="comment-form" onSubmit={submitComment}>
          <h3>Laissez-nous un mot</h3>
          <label htmlFor="comment-name">Votre nom</label>
          <input
            id="comment-name"
            name="name"
            autoComplete="name"
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex. Awa"
            required
          />
          <label htmlFor="comment-message">Votre commentaire</label>
          <textarea
            id="comment-message"
            name="message"
            rows={5}
            maxLength={1000}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Partagez votre expérience avec la boutique…"
            required
          />
          <div className="comment-form-footer">
            <span>{message.length}/1 000</span>
            <button className="comments-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Envoi en cours…" : "Publier mon commentaire"}
            </button>
          </div>
          {formStatus && <p className="comment-form-status" role="status">{formStatus}</p>}
        </form>
      </div>
      <div className="comments-board">
        <div className="comments-board-heading">
          <p className="eyebrow">LA COMMUNAUTÉ</p>
          <h3>Vos commentaires <span>{comments.length}</span></h3>
        </div>
        {isLoading ? (
          <p className="comments-feedback" role="status">Chargement des commentaires…</p>
        ) : loadError ? (
          <p className="comments-feedback comments-feedback-error" role="alert">{loadError}</p>
        ) : comments.length === 0 ? (
          <p className="comments-feedback">Aucun commentaire pour le moment. Soyez la première personne à partager votre avis !</p>
        ) : (
          <div className="comments-carousel" aria-roledescription="carrousel">
            <article className="comments-carousel-slide" key={activeComment.id} aria-live="polite">
              <span className="comments-carousel-quote" aria-hidden="true">“</span>
              <p>{activeComment.message}</p>
              <div className="comments-list-meta">
                <strong>{activeComment.name}</strong>
                <time dateTime={activeComment.createdAt}>
                  {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(activeComment.createdAt))}
                </time>
              </div>
            </article>
            {comments.length > 1 && (
              <div className="comments-carousel-controls" aria-label="Navigation des commentaires">
                <button type="button" aria-label="Commentaire précédent" onClick={() => showComment(-1)}>←</button>
                <span aria-live="polite">{activeCommentIndex + 1} / {comments.length}</span>
                <button type="button" aria-label="Commentaire suivant" onClick={() => showComment(1)}>→</button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
