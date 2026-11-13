"use client";

import { useEffect, useState } from "react";

type StoreAnnouncement = {
  id: number;
  message: string;
  updatedAt: string;
  startsAt: string;
  endsAt: string | null;
};

function isAnnouncement(value: unknown): value is StoreAnnouncement {
  return typeof value === "object" && value !== null &&
    "id" in value && typeof value.id === "number" &&
    "message" in value && typeof value.message === "string" &&
    "updatedAt" in value && typeof value.updatedAt === "string" &&
    "startsAt" in value && typeof value.startsAt === "string" && Number.isFinite(Date.parse(value.startsAt)) &&
    "endsAt" in value && (value.endsAt === null || typeof value.endsAt === "string" && Number.isFinite(Date.parse(value.endsAt)));
}

function dismissalKey(announcement: StoreAnnouncement) {
  return `store-announcement-dismissed:${announcement.id}:${announcement.updatedAt}`;
}

export default function StoreAnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<StoreAnnouncement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadAnnouncements() {
      try {
        const response = await fetch("/api/announcements", { cache: "no-store" });
        if (!response.ok) throw new Error(`Impossible de charger les annonces (HTTP ${response.status}).`);
        const result: unknown = await response.json();
        if (!Array.isArray(result) || !result.every(isAnnouncement)) {
          throw new Error("La réponse des annonces est invalide.");
        }
        if (!active) return;
        setAnnouncements(result);
        setNow(Date.now());
      } catch (error) {
        console.error("Store announcements could not be loaded.", error);
      }
    }

    void loadAnnouncements();
    const refreshTimer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
    };
  }, []);

  const visibleAnnouncements = announcements.filter((announcement) => {
    const startsAt = Date.parse(announcement.startsAt);
    const endsAt = announcement.endsAt ? Date.parse(announcement.endsAt) : Number.POSITIVE_INFINITY;
    const key = dismissalKey(announcement);
    let dismissedInSession = dismissed.has(key);
    try {
      dismissedInSession ||= Boolean(sessionStorage.getItem(key));
    } catch (error) {
      console.error("Store announcement dismissal could not be read.", error);
    }
    return startsAt <= now && endsAt > now && !dismissedInSession;
  });

  if (!visibleAnnouncements.length) return null;
  const message = visibleAnnouncements.map(({ message: text }) => text).join("   •   ");

  function dismiss() {
    const nextDismissed = new Set(dismissed);
    for (const announcement of visibleAnnouncements) {
      const key = dismissalKey(announcement);
      nextDismissed.add(key);
      try {
        sessionStorage.setItem(key, "true");
      } catch (error) {
        console.error("Store announcement dismissal could not be saved.", error);
      }
    }
    setDismissed(nextDismissed);
  }

  return (
    <aside className="store-announcement" aria-label="Annonces de la boutique" role="status">
      <div className="store-announcement-viewport" aria-label={message}>
        <p className="store-announcement-track">
          <span>{message}</span>
          <span aria-hidden="true">{message}</span>
        </p>
      </div>
      <button type="button" onClick={dismiss} aria-label="Fermer les annonces">×</button>
    </aside>
  );
}
