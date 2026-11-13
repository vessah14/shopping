import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import ProductDetail from "../../../components/products/ProductDetail";
import { getStoreProduct } from "../../../lib/store-data";
import { absoluteSiteUrl, serializeJsonLd } from "../../../lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  await connection();
  const product = await getStoreProduct(slug);
  if (!product) {
    return { title: "Produit introuvable", robots: { index: false, follow: false } };
  }

  const title = product.name;
  const description = product.description.slice(0, 160);
  const url = absoluteSiteUrl(`/produit/${encodeURIComponent(product.slug)}`);
  const image = product.image;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  return <Suspense fallback={<main className="catalog-loading">Chargement du produit…</main>}><ProductPageContent params={params} /></Suspense>;
}

async function ProductPageContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await connection();
  const product = await getStoreProduct(slug);
  if (!product) notFound();

  const images = (product.images?.length ? product.images : [product.image])
    .map((image) => absoluteSiteUrl(image));
  const productStructuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: images,
    sku: product.slug,
    category: product.category,
    offers: {
      "@type": "Offer",
      url: absoluteSiteUrl(`/produit/${encodeURIComponent(product.slug)}`),
      priceCurrency: "XAF",
      price: Number(product.price.replace(/\D/g, "")),
      availability: product.isAvailable && (product.stockQuantity ?? 0) > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: "Espace Shopping Plus" },
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(productStructuredData) }} />
      <ProductDetail product={product} />
    </>
  );
}
