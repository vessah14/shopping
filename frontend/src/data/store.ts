export type Product = {
  slug: string;
  name: string;
  price: string;
  originalPrice?: string;
  image: string;
  images?: string[];
  category: string;
  description: string;
  sizes: string[];
  colors: string[];
  stockQuantity?: number;
  isAvailable?: boolean;
  isPromo?: boolean;
  active?: boolean;
};

export const photo = (id: string, width = 900) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=90`;

export const productImage = (source: string, width = 900) =>
  source.startsWith("/") ? source : photo(source, width);
