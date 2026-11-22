import type { Product } from "../data/store";
import { getDatabasePool } from "./auth";

export type StoreCategory = {
  name: string;
  slug: string;
  image: string;
  active: boolean;
  featured: boolean;
  sortOrder?: number;
};

type StoreApiProduct = Omit<Product, "originalPrice" | "images"> & { originalPrice?: string | null; images?: string[] };
type StoreApiResponse = { products: StoreApiProduct[]; categories: StoreCategory[] };

function priceLabel(value: number) {
  return `${new Intl.NumberFormat("fr-FR").format(value)} FCFA`;
}

function getStoreApiUrl() {
  const url = process.env.STORE_API_URL?.trim().replace(/\/+$/, "");
  return url || null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isStoreProduct(value: unknown): value is StoreApiProduct {
  return isRecord(value) &&
    typeof value.slug === "string" &&
    typeof value.name === "string" &&
    typeof value.price === "string" &&
    (value.originalPrice === undefined || value.originalPrice === null || typeof value.originalPrice === "string") &&
    typeof value.image === "string" &&
    (value.images === undefined || isStringArray(value.images)) &&
    typeof value.category === "string" &&
    typeof value.description === "string" &&
    isStringArray(value.sizes) &&
    isStringArray(value.colors) &&
    (value.productType === "single_piece" || value.productType === "set") &&
    typeof value.stockQuantity === "number" &&
    typeof value.isAvailable === "boolean" &&
    (value.isPromo === undefined || typeof value.isPromo === "boolean") &&
    typeof value.active === "boolean";
}

function isStoreCategory(value: unknown): value is StoreCategory {
  return isRecord(value) &&
    typeof value.name === "string" &&
    typeof value.slug === "string" &&
    typeof value.image === "string" &&
    typeof value.active === "boolean" &&
    typeof value.featured === "boolean" &&
    typeof value.sortOrder === "number";
}

function isStoreApiResponse(value: unknown): value is StoreApiResponse {
  return isRecord(value) &&
    Array.isArray(value.products) &&
    value.products.every(isStoreProduct) &&
    Array.isArray(value.categories) &&
    value.categories.every(isStoreCategory);
}

function mapProduct(row: {
  slug: string;
  name: string;
  price_cfa: number;
  original_price_cfa: number | null;
  image: string;
  images: string[];
  category: string;
  description: string;
  sizes: string[];
  colors: string[];
  product_type: Product["productType"];
  stock_quantity: number;
  is_available: boolean;
  is_promo: boolean;
  is_active: boolean;
}): Product {
  return {
    slug: row.slug,
    name: row.name,
    price: priceLabel(row.price_cfa),
    originalPrice: row.original_price_cfa ? priceLabel(row.original_price_cfa) : undefined,
    image: row.image,
    images: row.images?.length ? row.images : [row.image],
    category: row.category,
    description: row.description,
    sizes: row.sizes,
    colors: row.colors,
    productType: row.product_type,
    stockQuantity: row.stock_quantity,
    isAvailable: row.is_available && row.stock_quantity > 0,
    isPromo: row.is_promo,
    active: row.is_active,
  };
}

export async function getStoreData() {
  const storeApiUrl = getStoreApiUrl();
  if (storeApiUrl) {
    const response = await fetch(`${storeApiUrl}/api/store/products`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Store API returned HTTP ${response.status} while loading the catalogue.`);
    }

    const data: unknown = await response.json();
    if (!isStoreApiResponse(data)) {
      throw new Error("Store API returned an invalid catalogue response.");
    }
    return {
      ...data,
      products: data.products.map(normalizeStoreProduct),
    };
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("Configure DATABASE_URL or STORE_API_URL to load the store catalogue.");
  }

  const pool = getDatabasePool();
  const [productResult, categoryResult] = await Promise.all([
    pool.query<Parameters<typeof mapProduct>[0]>(
      `SELECT slug, name, price_cfa, original_price_cfa, image, images, category, description, sizes, colors, product_type,
              stock_quantity, is_available, is_promo, is_active
       FROM store_products
       WHERE is_active = true
         AND EXISTS (SELECT 1 FROM store_categories c WHERE c.name=store_products.category AND c.is_active=true)
       ORDER BY created_at, name`,
    ),
    pool.query<{ name: string; slug: string; image: string; is_active: boolean; is_featured: boolean; sort_order: number }>(
      `SELECT name, slug, image, is_active, is_featured, sort_order
       FROM store_categories
       WHERE is_active = true
       ORDER BY sort_order, name`,
    ),
  ]);

  return {
    products: productResult.rows.map(mapProduct),
    categories: categoryResult.rows.map((category) => ({
      name: category.name,
      slug: category.slug,
      image: category.image,
      active: category.is_active,
      featured: category.is_featured,
      sortOrder: category.sort_order,
    })),
  };
}

export async function getStoreProduct(slug: string) {
  const storeApiUrl = getStoreApiUrl();
  if (storeApiUrl) {
    const response = await fetch(`${storeApiUrl}/api/store/products/${encodeURIComponent(slug)}`, { cache: "no-store" });
    if (response.status === 404) return undefined;
    if (!response.ok) {
      throw new Error(`Store API returned HTTP ${response.status} while loading product "${slug}".`);
    }

    const product: unknown = await response.json();
    if (!isStoreProduct(product)) {
      throw new Error(`Store API returned an invalid response for product "${slug}".`);
    }
    return normalizeStoreProduct(product);
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("Configure DATABASE_URL or STORE_API_URL to load store products.");
  }

  const result = await getDatabasePool().query<Parameters<typeof mapProduct>[0]>(
    `SELECT slug, name, price_cfa, original_price_cfa, image, images, category, description, sizes, colors, product_type,
            stock_quantity, is_available, is_promo, is_active
     FROM store_products
     WHERE slug = $1 AND is_active = true
       AND EXISTS (SELECT 1 FROM store_categories c WHERE c.name=store_products.category AND c.is_active=true)`,
    [slug],
  );
  return result.rows[0] ? mapProduct(result.rows[0]) : undefined;
}

function normalizeStoreProduct({ originalPrice, ...product }: StoreApiProduct): Product {
  return {
    ...product,
    images: product.images?.length ? product.images : [product.image],
    originalPrice: originalPrice ?? undefined,
  };
}

export function getFeaturedCategories(categories: StoreCategory[]) {
  return categories.filter((category) => category.featured);
}

export function getPublicCategories(categories: StoreCategory[]) {
  return categories.filter((category) => category.active && category.featured);
}
