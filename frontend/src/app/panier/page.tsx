import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import CartPage from "../../components/cart/CartPage";
import { getStoreData } from "../../lib/store-data";
import { getDeliveryZones } from "../../lib/delivery-zones";

export const metadata: Metadata = {
  title: "Mon panier",
  description: "Consultez les articles de votre panier Espace Shopping Plus.",
  robots: { index: false, follow: false },
};

export default function ShoppingCartRoute() {
  return <Suspense fallback={<main className="catalog-loading">Chargement de votre panier…</main>}><ShoppingCartContent /></Suspense>;
}

async function ShoppingCartContent() {
  await connection();
  const { products } = await getStoreData();
  const deliveryZones = await getDeliveryZones();
  return <CartPage products={products} deliveryZones={deliveryZones} />;
}
