import type { ProductType } from "../data/store";

export function hasSizeChoices(sizes: readonly string[]) {
  return sizes.length > 1;
}

export function hasColorChoices(productType: ProductType, colors: readonly string[]) {
  return productType === "set" && colors.length > 1;
}
