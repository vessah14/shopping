import Link from "next/link";
import { photo } from "../../data/store";
import type { StoreCategory } from "../../lib/store-data";
import StoreImage from "../ui/StoreImage";

export default function CategorySection({ categories }: { categories: StoreCategory[] }) {
  return (
    <section className="category-section" id="collections" aria-label="Nos univers">
      <div className="category-heading">
        <div>
          <p className="eyebrow">EXPLOREZ NOS UNIVERS</p>
          <h2>Nos catégories</h2>
        </div>
        <span className="category-index"><span className="category-index-desktop">DÉFILER POUR EXPLORER</span><span className="category-index-mobile">GLISSER</span> <b aria-hidden="true">↓</b></span>
      </div>
      <div className="category-rail">
        {categories.filter((category) => category.featured).map((category) => (
          <Link href={`/boutique?categorie=${encodeURIComponent(category.name)}`} className="category-card" key={category.name}>
            <StoreImage className="category-image" src={category.image.startsWith("/") ? category.image : photo(category.image, 900)} alt={category.name} sizes="(max-width: 420px) 45vw, (max-width: 700px) 30vw, (max-width: 1000px) 22vw, 12vw">
            </StoreImage>
            <span className="category-name">{category.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
