"use client";

import { useRouter, useSearchParams } from "next/navigation";
import SiteHeader from "../layout/SiteHeader";
import SiteFooter from "../layout/SiteFooter";
import type { Product } from "../../data/store";
import type { StoreCategory } from "../../lib/store-data";
import ProductCard from "../products/ProductCard";
import { productQuantity, useCart } from "../cart/cartStore";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function numericPrice(price: string) {
  return Number(price.replace(/\D/g, ""));
}

const categoryAliases: Record<string, string[]> = {
  "Produits de beauté": ["Beauté"],
  "Accessoires beauté et capillaires": ["Beauté et cheveux"],
};

const sortOptions = {
  pertinence: "Pertinence",
  nouveautes: "Nouveautés",
  "prix-croissant": "Prix croissant",
  "prix-decroissant": "Prix décroissant",
} as const;
type SortOption = keyof typeof sortOptions;

export default function CatalogPage({ products, categories: storeCategories }: { products: Product[]; categories: StoreCategory[] }) {
  // Every filter lives in the URL so the back button and shared links keep it.
  const searchParams = useSearchParams();
  const router = useRouter();
  const searchQuery = searchParams.get("recherche") ?? "";
  const selectedCategory = searchParams.get("categorie") ?? "";
  const promoOnly = searchParams.get("promo") === "1";
  const sortParam = searchParams.get("tri") ?? "pertinence";
  const sort: SortOption = sortParam in sortOptions ? sortParam as SortOption : "pertinence";
  const { addItem, items } = useCart();
  const categories = storeCategories.filter((category) => category.active).map((category) => category.name);
  const hasPromos = products.some((product) => product.originalPrice || product.isPromo);

  function updateParams(changes: Record<string, string | null>, replace = false) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const query = next.toString();
    const href = query ? `/boutique?${query}` : "/boutique";
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }

  const visibleProducts = products.filter((product) => {
    const matchesCategory = !selectedCategory || product.category === selectedCategory || categoryAliases[selectedCategory]?.includes(product.category);
    const matchesPromo = !promoOnly || Boolean(product.originalPrice || product.isPromo);
    const searchableText = normalize(`${product.name} ${product.category} ${product.description}`);
    return matchesCategory && matchesPromo && (!searchQuery || searchableText.includes(normalize(searchQuery)));
  });
  if (sort === "prix-croissant") visibleProducts.sort((a, b) => numericPrice(a.price) - numericPrice(b.price));
  if (sort === "prix-decroissant") visibleProducts.sort((a, b) => numericPrice(b.price) - numericPrice(a.price));
  if (sort === "nouveautes") visibleProducts.reverse();

  const hasFilters = Boolean(searchQuery.trim() || selectedCategory || promoOnly);

  return (
    <main className="inner-page">
      <SiteHeader />
      <section className="catalog-section catalog-section-compact" id="boutique">
        <div className="catalog-heading" id="catalog-produits">
          <p className="eyebrow">LA BOUTIQUE</p>
          <h1>{selectedCategory || "Mode, beauté et cheveux"}</h1>
        </div>
        <div className="catalog-toolbar">
          <form className="catalog-search" role="search" onSubmit={(event) => event.preventDefault()}>
            <label className="sr-only" htmlFor="catalog-search-input">Rechercher un article</label>
            <input
              id="catalog-search-input"
              type="search"
              placeholder="Rechercher un article…"
              value={searchQuery}
              onChange={(event) => updateParams({ recherche: event.target.value || null }, true)}
            />
          </form>
          <label className="catalog-sort">
            <span>Trier par</span>
            <select value={sort} onChange={(event) => updateParams({ tri: event.target.value === "pertinence" ? null : event.target.value })}>
              {Object.entries(sortOptions).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>
        </div>
        <div className="catalog-filters" role="group" aria-label="Filtrer par catégorie">
          <button className={!selectedCategory ? "catalog-filter active" : "catalog-filter"} type="button" aria-pressed={!selectedCategory} onClick={() => updateParams({ categorie: null })}>Tout voir</button>
          {hasPromos && <button className={promoOnly ? "catalog-filter catalog-filter-promo active" : "catalog-filter catalog-filter-promo"} type="button" aria-pressed={promoOnly} onClick={() => updateParams({ promo: promoOnly ? null : "1" })}>Promos</button>}
          {categories.map((category) => <button className={selectedCategory === category ? "catalog-filter active" : "catalog-filter"} type="button" aria-pressed={selectedCategory === category} onClick={() => updateParams({ categorie: category })} key={category}>{category}</button>)}
        </div>
        <div className="catalog-result-row">
          <p className="catalog-result-count" role="status">{visibleProducts.length} {visibleProducts.length === 1 ? "article" : "articles"}</p>
          {hasFilters && visibleProducts.length > 0 && <button type="button" className="catalog-clear" onClick={() => router.replace("/boutique", { scroll: false })}>Effacer les filtres <span aria-hidden="true">×</span></button>}
        </div>
        {visibleProducts.length ? <div className="product-grid">
          {visibleProducts.map((product) => <ProductCard product={product} cartQuantity={productQuantity(items, product.slug)} onAddToCart={addItem} key={product.slug} />)}
        </div> : <div className="catalog-empty">
          <span aria-hidden="true">⌕</span>
          <h2>{products.length ? "Aucun article trouvé" : "Aucun article disponible pour le moment"}</h2>
          <p>{products.length ? "Essayez un autre mot-clé ou choisissez une autre catégorie." : "Notre sélection sera bientôt disponible. Contactez-nous si vous recherchez un article en particulier."}</p>
          {products.length
            ? <button type="button" className="catalog-reset" onClick={() => router.replace("/boutique", { scroll: false })}>Effacer les filtres</button>
            : <a className="catalog-reset" href="/contact">Contacter la boutique</a>}
        </div>}
      </section>
      <SiteFooter />
    </main>
  );
}
