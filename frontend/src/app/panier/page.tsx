import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import CartPage from "../../components/cart/CartPage";
import { getStoreData } from "../../lib/store-data";

export const metadata: Metadata = { title: "Mon panier | Espace Shopping Plus", description: "Consultez les articles de votre panier Espace Shopping Plus." };

export default function ShoppingCartRoute() {
  return <Suspense fallback={<main className="catalog-loading">Chargement de votre panier…</main>}><ShoppingCartContent /></Suspense>;
}

async function ShoppingCartContent() {
  await connection();
  const { products } = await getStoreData();
  return <CartPage products={products} />;
}
