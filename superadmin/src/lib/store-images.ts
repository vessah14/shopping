export function productImage(source: string, width = 900) {
  return source.startsWith("/")
    ? `${process.env.NEXT_PUBLIC_FRONTEND_URL ?? "http://localhost:3000"}${source}`
    : `https://images.unsplash.com/${source}?auto=format&fit=crop&w=${width}&q=90`;
}
