import type { Metadata } from "next";
import { Suspense } from "react";
import CatalogPage from "../../components/home/CatalogPage";
import { connection } from "next/server";
import { getStoreData } from "../../lib/store-data";

export const metadata: Metadata = { title: "Boutique | Espace Shopping Plus", description: "Découvrez notre sélection de mode, beauté et accessoires." };

export default function BoutiquePage() {
  return <Suspense fallback={<main className="catalog-loading">Chargement de la boutique…</main>}><BoutiqueContent /></Suspense>;
}

async function BoutiqueContent() {
  await connection();
  const { products, categories } = await getStoreData();
  return <CatalogPage products={products} categories={categories} />;
}
