"use client";

import Link from "next/link";
import type { Product } from "../../data/store";
import ProductCard from "../products/ProductCard";
import { productQuantity, useCart, type CartOptions } from "../cart/cartStore";

type ProductSectionProps = { products: Product[]; onAddToCart: (slug: string, options?: CartOptions) => void };

export default function ProductSection({ products, onAddToCart }: ProductSectionProps) {
  const { items } = useCart();
  return (
    <section className="products-section" id="boutique">
      <div className="section-heading" id="nouveautes">
        <div>
          <p className="eyebrow">À DÉCOUVRIR EN BOUTIQUE</p>
          <h2>Nouveautés</h2>
        </div>
        <p className="section-index">SÉLECTION 01 <span>·</span> {products.length} PIÈCES</p>
      </div>
      <div className="product-grid">
        {products.map((product) => <ProductCard product={product} cartQuantity={productQuantity(items, product.slug)} onAddToCart={onAddToCart} key={product.slug} />)}
      </div>
      {products.length === 0 && <p className="catalog-empty">Aucun produit n’est actuellement disponible dans la base de données.</p>}
      <div className="products-more"><Link className="products-more-link" href="/boutique">Voir tous nos produits <span aria-hidden="true">↗</span></Link></div>
    </section>
  );
}
