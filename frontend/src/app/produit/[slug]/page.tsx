import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import ProductDetail from "../../../components/products/ProductDetail";
import { getStoreProduct } from "../../../lib/store-data";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  await connection();
  const product = await getStoreProduct(slug);
  return product ? { title: `${product.name} | Espace Shopping Plus`, description: product.description } : { title: "Produit introuvable | Espace Shopping Plus" };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  return <Suspense fallback={<main className="catalog-loading">Chargement du produit…</main>}><ProductPageContent params={params} /></Suspense>;
}

async function ProductPageContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await connection();
  const product = await getStoreProduct(slug);
  if (!product) notFound();
  return <ProductDetail product={product} />;
}
