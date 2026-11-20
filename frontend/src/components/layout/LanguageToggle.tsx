"use client";

import { useEffect, useSyncExternalStore } from "react";

// The language only changes via a full page reload, so there is nothing to subscribe to.
const subscribe = () => () => {};

type Language = "fr" | "en";

const SCRIPT_ID = "google-translate-script";
const COOKIE = "googtrans";

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: { translate?: { TranslateElement: new (options: Record<string, unknown>, elementId: string) => unknown } };
  }
}

function readLanguage(): Language {
  const match = document.cookie.match(/(?:^|;\s*)googtrans=([^;]*)/);
  return match && decodeURIComponent(match[1]).endsWith("/en") ? "en" : "fr";
}

function writeCookie(value: string | null) {
  const expires = value ? "" : "; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  const content = value ? encodeURIComponent(value) : "";
  const host = window.location.hostname;
  document.cookie = `${COOKIE}=${content}; path=/${expires}`;
  // Google Translate may also set the cookie on the parent domain.
  if (host.includes(".")) document.cookie = `${COOKIE}=${content}; path=/; domain=.${host}${expires}`;
}

// Google Translate rewrites text nodes, which can make React fail when it later
// removes or inserts nodes. Make those operations tolerant while translation is active.
function patchDomForTranslation() {
  const proto = Node.prototype as Node & { __translatePatched?: boolean };
  if (proto.__translatePatched) return;
  proto.__translatePatched = true;
  const removeChild = proto.removeChild;
  proto.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) return child;
    return removeChild.call(this, child) as T;
  };
  const insertBefore = proto.insertBefore;
  proto.insertBefore = function <T extends Node>(this: Node, node: T, reference: Node | null): T {
    if (reference && reference.parentNode !== this) return node;
    return insertBefore.call(this, node, reference) as T;
  };
}

function loadTranslator() {
  if (document.getElementById(SCRIPT_ID)) return;
  patchDomForTranslation();
  window.googleTranslateElementInit = () => {
    const TranslateElement = window.google?.translate?.TranslateElement;
    if (TranslateElement) new TranslateElement({ pageLanguage: "fr", includedLanguages: "en,fr", autoDisplay: false }, "google_translate_element");
  };
  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
  script.async = true;
  document.body.appendChild(script);
}

export default function LanguageToggle() {
  const language = useSyncExternalStore<Language>(subscribe, readLanguage, () => "fr");

  useEffect(() => {
    if (language === "en") loadTranslator();
  }, [language]);

  function toggle() {
    writeCookie(language === "fr" ? "/fr/en" : null);
    window.location.reload();
  }

  const next = language === "fr" ? "EN" : "FR";
  return (
    <>
      <button
        type="button"
        className="language-toggle notranslate"
        translate="no"
        onClick={toggle}
        aria-label={language === "fr" ? "Translate the site into English" : "Afficher le site en français"}
        title={language === "fr" ? "English" : "Français"}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" /></svg>
        <span>{next}</span>
      </button>
      <div id="google_translate_element" hidden />
    </>
  );
}
