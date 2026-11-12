import { describe, expect, it } from "vitest";
import { normalizeCart } from "./cartStore";

describe("cart persistence", () => {
  it("merges duplicate product lines and caps their combined quantity at 50", () => {
    expect(normalizeCart([
      { slug: "robe-ete", quantity: 30 },
      { slug: "robe-ete", quantity: 40 },
    ])).toEqual([{ slug: "robe-ete", quantity: 50 }]);
  });

  it("ignores malformed lines, invalid slugs, and non-positive quantities", () => {
    expect(normalizeCart([
      null,
      { slug: "../bad", quantity: 1 },
      { slug: "robe-ete", quantity: 0 },
      { slug: "robe-ete", quantity: 1.5 },
      { slug: "robe-ete", quantity: 2 },
    ])).toEqual([{ slug: "robe-ete", quantity: 2 }]);
  });

  it("returns an empty cart for invalid storage values", () => {
    expect(normalizeCart(null)).toEqual([]);
    expect(normalizeCart({ slug: "robe-ete", quantity: 1 })).toEqual([]);
  });
});
