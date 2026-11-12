"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SiteHeader from "../layout/SiteHeader";
import SiteFooter from "../layout/SiteFooter";
import type { Product } from "../../data/store";
import type { StoreCategory } from "../../lib/store-data";
import ProductCard from "../products/ProductCard";
import { useCart } from "../cart/cartStore";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

const categoryAliases: Record<string, string[]> = {
  "Produits de beauté": ["Beauté"],
  "Accessoires beauté et capillaires": ["Beauté et cheveux"],
};

function CatalogContent({ initialSearch, initialCategory, products, categories: storeCategories }: { initialSearch: string; initialCategory: string; products: Product[]; categories: StoreCategory[] }) {
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const { addItem, items } = useCart();
  const router = useRouter();
  const categories = storeCategories.filter((category) => category.active).map((category) => category.name);

  const visibleProducts = products.filter((product) => {
    const matchesCategory = !selectedCategory || product.category === selectedCategory || categoryAliases[selectedCategory]?.includes(product.category);
    const searchableText = normalize(`${product.name} ${product.category} ${product.description}`);
    return matchesCategory && (!searchQuery || searchableText.includes(normalize(searchQuery)));
  });

  function clearFilters() {
    setSearchQuery("");
    setSelectedCategory("");
    router.replace("/boutique", { scroll: false });
  }

  return (
    <main className="inner-page">
      <SiteHeader />
      <section className="catalog-hero" aria-label="La boutique Espace Shopping Plus">
        <div className="catalog-hero-copy">
          <p className="eyebrow">VOTRE BOUTIQUE AU CAMEROUN</p>
          <h1>Mode, beauté<br /><em>et cheveux.</em></h1>
          <p>Parcourez notre sélection, choisissez vos articles et contactez-nous pour confirmer leur disponibilité.</p>
          <a className="catalog-hero-button" href="#catalog-produits">Voir les articles <span aria-hidden="true">↓</span></a>
        </div>
        <div className="catalog-hero-image" role="img" aria-label="Portrait de mode au Cameroun" />
      </section>
      <section className="catalog-section" id="boutique">
        <div className="catalog-heading" id="catalog-produits">
          <p className="eyebrow">LA SÉLECTION ESPACE SHOPPING PLUS</p>
          <h2>Des articles pour vos envies.</h2>
          <p>Mode, beauté et cheveux : découvrez les articles disponibles.</p>
        </div>
        <div className="catalog-toolbar">
          <div className="catalog-filters" aria-label="Filtrer par catégorie">
            <button className={!selectedCategory ? "catalog-filter active" : "catalog-filter"} type="button" aria-pressed={!selectedCategory} onClick={() => setSelectedCategory("")}>Tout voir</button>
            {categories.map((category) => <button className={selectedCategory === category ? "catalog-filter active" : "catalog-filter"} type="button" aria-pressed={selectedCategory === category} onClick={() => setSelectedCategory(category)} key={category}>{category}</button>)}
          </div>
          <p className="catalog-result-count">{visibleProducts.length} {visibleProducts.length === 1 ? "article" : "articles"}</p>
        </div>
        {visibleProducts.length ? <div className="product-grid">
          {visibleProducts.map((product) => <ProductCard product={product} cartQuantity={items.find((item) => item.slug === product.slug)?.quantity ?? 0} onAddToCart={addItem} key={product.slug} />)}
        </div> : <div className="catalog-empty">
          <span aria-hidden="true">⌕</span>
          <h2>{products.length ? "Aucun article trouvé" : "Aucun article disponible pour le moment"}</h2>
          <p>{products.length ? "Essayez un autre mot-clé ou choisissez une autre catégorie." : "Notre sélection sera bientôt disponible. Contactez-nous si vous recherchez un article en particulier."}</p>
          {products.length
            ? <button type="button" className="catalog-reset" onClick={clearFilters}>Effacer les filtres</button>
            : <a className="catalog-reset" href="/contact">Contacter la boutique</a>}
        </div>}
        {(searchQuery || selectedCategory) && visibleProducts.length > 0 && <button type="button" className="catalog-clear" onClick={clearFilters}>Effacer les filtres <span aria-hidden="true">×</span></button>}
      </section>
      <SiteFooter />
    </main>
  );
}

export default function CatalogPage({ products, categories }: { products: Product[]; categories: StoreCategory[] }) {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("recherche") ?? "";
  const initialCategory = searchParams.get("categorie") ?? "";
  return <CatalogContent key={`${initialSearch}:${initialCategory}`} initialSearch={initialSearch} initialCategory={initialCategory} products={products} categories={categories} />;
}
