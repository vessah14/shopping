import { Suspense } from "react";
import { connection } from "next/server";
import HomePage from "../components/home/HomePage";
import { getStoreData } from "../lib/store-data";

export default function Home() {
  return <Suspense fallback={<main className="home-page" aria-busy="true">Chargement de la boutique…</main>}><HomeContent /></Suspense>;
}

async function HomeContent() {
  await connection();
  const { products, categories } = await getStoreData();
  return <HomePage products={products} categories={categories} />;
}
