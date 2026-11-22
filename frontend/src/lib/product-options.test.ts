import { describe, expect, it } from "vitest";
import { hasColorChoices, hasSizeChoices } from "./product-options";

describe("product option choices", () => {
  it("offers a size choice only when multiple sizes are configured", () => {
    expect(hasSizeChoices([])).toBe(false);
    expect(hasSizeChoices(["M"])).toBe(false);
    expect(hasSizeChoices(["S", "M"])).toBe(true);
  });

  it("offers color choices only for ensembles with multiple colors", () => {
    expect(hasColorChoices("single_piece", ["Noir", "Beige"])).toBe(false);
    expect(hasColorChoices("set", ["Noir"])).toBe(false);
    expect(hasColorChoices("set", ["Noir", "Beige"])).toBe(true);
  });
});
