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
  return typeof value === "object" &&
    value !== null &&
    "id" in value && typeof value.id === "number" &&
    "message" in value && typeof value.message === "string" &&
    "updatedAt" in value && typeof value.updatedAt === "string" &&
    "startsAt" in value && typeof value.startsAt === "string" && Number.isFinite(Date.parse(value.startsAt)) &&
    "endsAt" in value && (typeof value.endsAt === "string" && Number.isFinite(Date.parse(value.endsAt)) || value.endsAt === null);
}

export default function StoreAnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<StoreAnnouncement | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadAnnouncement() {
      try {
        const response = await fetch("/api/announcements", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Impossible de charger l’annonce (HTTP ${response.status}).`);
        }

        const result: unknown = await response.json();
        if (result === null) return;
        if (!isAnnouncement(result)) {
          throw new Error("La réponse de l’annonce est invalide.");
        }

        const dismissalKey = `store-announcement-dismissed:${result.id}:${result.updatedAt}`;
        if (!active) return;
        try {
          if (sessionStorage.getItem(dismissalKey)) return;
        } catch (error) {
          console.error("Store announcement dismissal could not be read.", error);
        }
        setHasStarted(new Date(result.startsAt).getTime() <= Date.now());
        setAnnouncement(result);
      } catch (error) {
        console.error("Store announcement could not be loaded.", error);
      }
    }

    void loadAnnouncement();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!announcement) return;
    let clearStart: (() => void) | undefined;
    let clearEnd: (() => void) | undefined;

    function schedule(timestamp: number, callback: () => void) {
      let timeout: number;
      function checkTime() {
        const remaining = timestamp - Date.now();
        if (remaining <= 0) {
          callback();
          return;
        }
        timeout = window.setTimeout(checkTime, Math.min(remaining, 2_147_000_000));
      }
      timeout = window.setTimeout(checkTime, Math.min(Math.max(timestamp - Date.now(), 0), 2_147_000_000));
      return () => window.clearTimeout(timeout);
    }

    const startsAt = new Date(announcement.startsAt).getTime();
    if (startsAt > Date.now()) clearStart = schedule(startsAt, () => setHasStarted(true));
    if (announcement.endsAt) {
      clearEnd = schedule(new Date(announcement.endsAt).getTime(), () => setAnnouncement(null));
    }
    return () => {
      clearStart?.();
      clearEnd?.();
    };
  }, [announcement]);

  if (!announcement || !hasStarted) return null;
  const visibleAnnouncement = announcement;

  function dismiss() {
    try {
      sessionStorage.setItem(
        `store-announcement-dismissed:${visibleAnnouncement.id}:${visibleAnnouncement.updatedAt}`,
        "true",
      );
    } catch (error) {
      console.error("Store announcement dismissal could not be saved.", error);
    }
    setAnnouncement(null);
  }

  return (
    <aside className="store-announcement" aria-label="Annonce de la boutique" role="status">
      <p>{visibleAnnouncement.message}</p>
      <button type="button" onClick={dismiss} aria-label="Fermer l’annonce">×</button>
    </aside>
  );
}
