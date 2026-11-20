import { describe, expect, it } from "vitest";
import { lineKey, normalizeCart, productQuantity } from "./cartStore";

describe("cart persistence", () => {
  it("merges duplicate lines and caps their combined quantity at 50", () => {
    expect(normalizeCart([
      { slug: "robe-ete", quantity: 30 },
      { slug: "robe-ete", quantity: 40 },
    ])).toEqual([{ slug: "robe-ete", size: "", color: "", quantity: 50 }]);
  });

  it("keeps different sizes and colours as separate lines", () => {
    const cart = normalizeCart([
      { slug: "robe-ete", size: "M", color: "Rouge", quantity: 1 },
      { slug: "robe-ete", size: "L", color: "Rouge", quantity: 2 },
      { slug: "robe-ete", size: "M", color: "Rouge", quantity: 1 },
    ]);
    expect(cart).toEqual([
      { slug: "robe-ete", size: "M", color: "Rouge", quantity: 2 },
      { slug: "robe-ete", size: "L", color: "Rouge", quantity: 2 },
    ]);
    expect(productQuantity(cart, "robe-ete")).toBe(4);
    expect(lineKey(cart[0])).toBe("robe-ete|M|Rouge");
  });

  it("reads carts saved before sizes and colours existed", () => {
    expect(normalizeCart([{ slug: "robe-ete", quantity: 2 }])).toEqual([{ slug: "robe-ete", size: "", color: "", quantity: 2 }]);
  });

  it("ignores malformed lines, invalid slugs, options and non-positive quantities", () => {
    expect(normalizeCart([
      null,
      { slug: "../bad", quantity: 1 },
      { slug: "robe-ete", quantity: 0 },
      { slug: "robe-ete", quantity: 1.5 },
      { slug: "robe-ete", size: "X".repeat(41), quantity: 1 },
      { slug: "robe-ete", size: 3, quantity: 1 },
      { slug: "robe-ete", quantity: 2 },
    ])).toEqual([{ slug: "robe-ete", size: "", color: "", quantity: 2 }]);
  });

  it("returns an empty cart for invalid storage values", () => {
    expect(normalizeCart(null)).toEqual([]);
    expect(normalizeCart({ slug: "robe-ete", quantity: 1 })).toEqual([]);
  });
});
