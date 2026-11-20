/** "Plus que 2 en stock !" when few items remain, nothing otherwise. */
export function stockLabel(stockQuantity: number | undefined, threshold = 5) {
  if (stockQuantity === undefined || stockQuantity < 1 || stockQuantity > threshold) return null;
  return stockQuantity === 1 ? "Dernier article en stock !" : `Plus que ${stockQuantity} en stock !`;
}
