"use client";

import { useSyncExternalStore } from "react";

/** One cart line = one product in one size and one colour ("" when the product has none). */
export type CartLine = { slug: string; size: string; color: string; quantity: number };
export type CartOptions = { size?: string; color?: string; name?: string };
export type CartAddition = CartLine & { name: string };

const maxCartQuantity = 50;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function lineKey(line: { slug: string; size?: string; color?: string }) {
  return `${line.slug}|${line.size ?? ""}|${line.color ?? ""}`;
}

/** Total quantity of a product in the cart, all sizes and colours included. */
export function productQuantity(items: CartLine[], slug: string) {
  return items.reduce((total, line) => line.slug === slug ? total + line.quantity : total, 0);
}

function readOption(value: unknown) {
  return typeof value === "string" && value.trim().length <= 40 ? value.trim() : null;
}

export function normalizeCart(value: unknown): CartLine[] {
  if (!Array.isArray(value)) return [];
  const lines = new Map<string, CartLine>();
  for (const line of value) {
    if (
      !line ||
      typeof line !== "object" ||
      !("slug" in line) ||
      typeof line.slug !== "string" ||
      !slugPattern.test(line.slug) ||
      !("quantity" in line) ||
      !Number.isSafeInteger(line.quantity) ||
      (line.quantity as number) < 1
    ) continue;
    const size = "size" in line ? readOption(line.size) : "";
    const color = "color" in line ? readOption(line.color) : "";
    if (size === null || color === null) continue;
    const key = lineKey({ slug: line.slug, size, color });
    const quantity = Math.min(maxCartQuantity, (lines.get(key)?.quantity ?? 0) + (line.quantity as number));
    lines.set(key, { slug: line.slug, size, color, quantity });
  }
  return [...lines.values()];
}

const serverSnapshot: CartLine[] = [];
let snapshot: CartLine[] = serverSnapshot;
let isLoaded = false;
const listeners = new Set<() => void>();
const addListeners = new Set<(addition: CartAddition) => void>();

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

/** Lets the "added to cart" notification react to every addition. */
export function subscribeToCartAdditions(listener: (addition: CartAddition) => void) {
  addListeners.add(listener);
  return () => { addListeners.delete(listener); };
}

export function addCartItem(slug: string, options: CartOptions = {}) {
  if (!slugPattern.test(slug)) return;
  const size = options.size?.trim() ?? "";
  const color = options.color?.trim() ?? "";
  const current = getSnapshot();
  if (productQuantity(current, slug) >= maxCartQuantity) return;
  const key = lineKey({ slug, size, color });
  const existing = current.find((line) => lineKey(line) === key);
  const added: CartLine = { slug, size, color, quantity: (existing?.quantity ?? 0) + 1 };
  save(existing
    ? current.map((line) => lineKey(line) === key ? added : line)
    : [...current, added]);
  addListeners.forEach((listener) => listener({ ...added, name: options.name ?? slug }));
}

export function setCartItemQuantity(key: string, quantity: number) {
  if (quantity < 1) {
    removeCartItem(key);
    return;
  }
  if (!Number.isSafeInteger(quantity)) return;
  save(getSnapshot().map((line) => lineKey(line) === key ? { ...line, quantity: Math.min(maxCartQuantity, quantity) } : line));
}

export function removeCartItem(key: string) {
  save(getSnapshot().filter((line) => lineKey(line) !== key));
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
