import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { absoluteSiteUrl } from "../lib/seo";
import { getStoreData } from "../lib/store-data";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();

  const pages: MetadataRoute.Sitemap = [
    { url: absoluteSiteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: absoluteSiteUrl("/boutique"), changeFrequency: "daily", priority: 0.9 },
    { url: absoluteSiteUrl("/contact"), changeFrequency: "monthly", priority: 0.5 },
  ];

  try {
    const { products } = await getStoreData();
    return [
      ...pages,
      ...products
        .filter((product) => product.active !== false)
        .map((product) => ({
          url: absoluteSiteUrl(`/produit/${encodeURIComponent(product.slug)}`),
          lastModified: new Date(),
          changeFrequency: "weekly" as const,
          priority: 0.7,
        })),
    ];
  } catch {
    return pages;
  }
}