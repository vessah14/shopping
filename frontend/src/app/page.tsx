import { Suspense } from "react";
import { connection } from "next/server";
import { contactPhone, storeAddress, storeMapUrl } from "../data/contact";
import HomePage from "../components/home/HomePage";
import { absoluteSiteUrl, serializeJsonLd } from "../lib/seo";
import { getStoreData } from "../lib/store-data";

export default function Home() {
  return <Suspense fallback={<main className="home-page" aria-busy="true">Chargement de la boutique…</main>}><HomeContent /></Suspense>;
}

async function HomeContent() {
  await connection();
  const { products, categories } = await getStoreData();
  const storeStructuredData = {
    "@context": "https://schema.org",
    "@type": "ClothingStore",
    name: "Espace Shopping Plus",
    url: absoluteSiteUrl("/"),
    image: absoluteSiteUrl("/espace-shopping-plus/logo-principal.png"),
    telephone: `+${contactPhone.international}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: storeAddress,
      addressLocality: "Douala",
      addressCountry: "CM",
    },
    hasMap: storeMapUrl,
    areaServed: { "@type": "Country", name: "Cameroun" },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(storeStructuredData) }} />
      <HomePage products={products} categories={categories} />
    </>
  );
}
