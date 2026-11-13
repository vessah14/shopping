import type { Metadata } from "next";
import { Suspense } from "react";
import CatalogPage from "../../components/home/CatalogPage";
import { connection } from "next/server";
import { getStoreData } from "../../lib/store-data";
import { absoluteSiteUrl } from "../../lib/seo";

export const metadata: Metadata = {
  title: "Boutique",
  description: "Découvrez les vêtements, chaussures, accessoires et produits de beauté disponibles chez Espace Shopping Plus à Douala.",
  alternates: { canonical: absoluteSiteUrl("/boutique") },
  openGraph: {
    title: "Boutique de mode et beauté à Douala",
    description: "Parcourez les vêtements, chaussures, accessoires et produits de beauté d’Espace Shopping Plus.",
    url: absoluteSiteUrl("/boutique"),
  },
};

export default function BoutiquePage() {
  return <Suspense fallback={<main className="catalog-loading">Chargement de la boutique…</main>}><BoutiqueContent /></Suspense>;
}

async function BoutiqueContent() {
  await connection();
  const { products, categories } = await getStoreData();
  return <CatalogPage products={products} categories={categories} />;
}
