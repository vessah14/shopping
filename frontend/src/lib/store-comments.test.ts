import { describe, expect, it } from "vitest";
import { isStoreComment, parseNewStoreComment } from "./store-comments";

describe("store comments", () => {
  it("trims and accepts valid comment fields", () => {
    expect(parseNewStoreComment({ name: "  Awa  ", message: "  Très belle boutique !  " })).toEqual({
      name: "Awa",
      message: "Très belle boutique !",
    });
  });

  it("rejects missing, blank, and overlong fields", () => {
    expect(parseNewStoreComment(null)).toBeNull();
    expect(parseNewStoreComment({ name: "  ", message: "Bonjour" })).toBeNull();
    expect(parseNewStoreComment({ name: "Awa", message: "x" })).toBeNull();
    expect(parseNewStoreComment({ name: "A".repeat(81), message: "Bonjour" })).toBeNull();
    expect(parseNewStoreComment({ name: "Awa", message: "B".repeat(1001) })).toBeNull();
  });

  it("rejects comments containing links", () => {
    expect(parseNewStoreComment({ name: "Awa", message: "Promo sur https://spam.example" })).toBeNull();
    expect(parseNewStoreComment({ name: "Awa", message: "Allez sur www.spam.fr" })).toBeNull();
    expect(parseNewStoreComment({ name: "cheap-pills.com", message: "Bonjour" })).toBeNull();
    expect(parseNewStoreComment({ name: "Awa", message: "Livraison rapide. Merci !" })).not.toBeNull();
  });

  it("checks data returned by the comments API", () => {
    expect(isStoreComment({
      id: "1",
      name: "Awa",
      message: "Très belle boutique !",
      createdAt: "2026-11-07T12:00:00.000Z",
    })).toBe(true);
    expect(isStoreComment({ id: "1", name: "Awa", message: "Salut", createdAt: "invalid" })).toBe(false);
  });
});
