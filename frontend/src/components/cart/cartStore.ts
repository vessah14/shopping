"use client";

import { useSyncExternalStore } from "react";

export type CartLine = { slug: string; quantity: number };
const maxCartQuantity = 50;

export function normalizeCart(value: unknown): CartLine[] {
  if (!Array.isArray(value)) return [];
  const quantities = new Map<string, number>();
  for (const line of value) {
    if (
      !line ||
      typeof line !== "object" ||
      !("slug" in line) ||
      typeof line.slug !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(line.slug) ||
      !("quantity" in line) ||
      !Number.isSafeInteger(line.quantity) ||
      (line.quantity as number) < 1
    ) continue;
    quantities.set(line.slug, Math.min(maxCartQuantity, (quantities.get(line.slug) ?? 0) + (line.quantity as number)));
  }
  return [...quantities].map(([slug, quantity]) => ({ slug, quantity }));
}

const serverSnapshot: CartLine[] = [];
let snapshot: CartLine[] = serverSnapshot;
let isLoaded = false;
const listeners = new Set<() => void>();

function readStorage() {
  if (typeof window === "undefined") return serverSnapshot;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem("esp-cart") ?? "[]");
    return normalizeCart(parsed);
  } catch {
    return serverSnapshot;
  }
}

function getSnapshot() {
  if (!isLoaded && typeof window !== "undefined") {
    snapshot = readStorage();
    isLoaded = true;
  }
  return snapshot;
}

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== "esp-cart") return;
    snapshot = readStorage();
    isLoaded = true;
    notify();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function save(next: CartLine[]) {
  snapshot = next;
  isLoaded = true;
  try {
    window.localStorage.setItem("esp-cart", JSON.stringify(next));
  } catch {
    // Keep this tab's cart usable when browser storage is unavailable.
  }
  notify();
}

export function addCartItem(slug: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return;
  const current = getSnapshot();
  const existing = current.find((line) => line.slug === slug);
  if (existing?.quantity === maxCartQuantity) return;
  save(existing
    ? current.map((line) => line.slug === slug ? { ...line, quantity: Math.min(maxCartQuantity, line.quantity + 1) } : line)
    : [...current, { slug, quantity: 1 }]);
}

export function setCartItemQuantity(slug: string, quantity: number) {
  if (quantity < 1) {
    removeCartItem(slug);
    return;
  }
  if (!Number.isSafeInteger(quantity)) return;
  save(getSnapshot().map((line) => line.slug === slug ? { ...line, quantity: Math.min(maxCartQuantity, quantity) } : line));
}

export function removeCartItem(slug: string) {
  save(getSnapshot().filter((line) => line.slug !== slug));
}

export function clearCart() {
  save([]);
}

export function useCart() {
  const items = useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
  return {
    items,
    itemCount: items.reduce((total, line) => total + line.quantity, 0),
    addItem: addCartItem,
    setQuantity: setCartItemQuantity,
    removeItem: removeCartItem,
    clear: clearCart,
  };
}
