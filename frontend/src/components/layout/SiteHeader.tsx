"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Brand, Icon } from "../ui/Brand";
import { productImage, type Product } from "../../data/store";
import { useCart } from "../cart/cartStore";
import { authClient } from "../../lib/auth-client";
import StoreAnnouncementBanner from "./StoreAnnouncementBanner";
import LanguageToggle from "./LanguageToggle";

const links = [
  { label: "Accueil", href: "/#accueil", section: "accueil" },
  { label: "Boutique", href: "/boutique", section: null },
  { label: "Contact", href: "/contact", section: null },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { itemCount: cartCount } = useCart();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchProducts, setSearchProducts] = useState<Product[]>([]);
  const [searchError, setSearchError] = useState("");
  const [searchLoaded, setSearchLoaded] = useState(false);
  const [activeSection, setActiveSection] = useState("accueil");
  const searchInput = useRef<HTMLInputElement>(null);
  const searchToggle = useRef<HTMLButtonElement>(null);
  const searchDialog = useRef<HTMLElement>(null);
  const menuToggle = useRef<HTMLButtonElement>(null);
  const normalizedQuery = searchQuery.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const searchResults = (normalizedQuery
    ? searchProducts.filter((product) => `${product.name} ${product.category} ${product.description}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(normalizedQuery))
    : searchProducts
  ).slice(0, 4);

  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    let active = true;
    fetch("/api/store/products", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("La recherche des articles est indisponible pour le moment.");
        return response.json();
      })
      .then((result: unknown) => {
        if (!Array.isArray(result)) throw new Error("La liste des articles reçue est invalide.");
        if (active) {
          setSearchProducts(result);
          setSearchError("");
          setSearchLoaded(true);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setSearchError(error instanceof Error ? error.message : "La recherche des articles est indisponible.");
          setSearchLoaded(true);
        }
      });
    return () => { active = false; };
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSearchOpen(false);
        searchToggle.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = searchDialog.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])",
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [searchOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function closeMenuOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuToggle.current?.focus();
      }
    }
    window.addEventListener("keydown", closeMenuOnEscape);
    return () => window.removeEventListener("keydown", closeMenuOnEscape);
  }, [menuOpen]);

  useEffect(() => {
    if (pathname !== "/") return;
    const observed = ["accueil", "nouveautes", "collections", "apropos"]
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    const visibleSections = new Set<string>();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visibleSections.add(entry.target.id);
        else visibleSections.delete(entry.target.id);
      });
      const current = [...visibleSections]
        .map((id) => document.getElementById(id))
        .filter((element): element is HTMLElement => element !== null)
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
      if (current) setActiveSection(current.id);
    }, { rootMargin: "-18% 0px -68% 0px", threshold: 0 });
    observed.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [pathname]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!searchQuery.trim()) {
      searchInput.current?.focus();
      return;
    }
    setSearchOpen(false);
    searchToggle.current?.focus();
    router.push(`/boutique?recherche=${encodeURIComponent(searchQuery.trim())}`);
  }

  function isActive(href: string, section: string | null) {
    if (pathname === "/" && section) return activeSection === section;
    return !section && pathname === href;
  }

  return (
    <>
      <StoreAnnouncementBanner />
      <div className="announcement">
        <span><Icon name="headphones" /> Commandez sur WhatsApp</span>
        <span className="social-follow">Suivez-nous <a href="https://www.instagram.com/espaceshopping.cmr/" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><Icon name="instagram" /></a><a href="https://www.facebook.com/share/1CiY4wF8zN/" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><Icon name="facebook" /></a><a href="https://www.tiktok.com/@espace.shopping.c" target="_blank" rel="noopener noreferrer" aria-label="TikTok"><Icon name="tiktok" /></a><a href="https://www.snapchat.com/add/espace_shopping" target="_blank" rel="noopener noreferrer" aria-label="Snapchat"><Icon name="snapchat" /></a></span>
      </div>
      <header className="site-header">
        <Brand alternate />
        <nav id="primary-navigation" className={menuOpen ? "main-nav nav-open" : "main-nav"} aria-label="Navigation principale">
          {links.map(({ label, href, section }) => {
            const active = isActive(href, section);
            return <Link className={active ? "active" : ""} aria-current={active ? "page" : undefined} href={href} onClick={() => { if (section) setActiveSection(section); setMenuOpen(false); }} key={label}>{label}</Link>;
          })}
          <div className="mobile-account-links">
            {session
              ? <Link className="header-account-badge" href="/compte" onClick={() => setMenuOpen(false)}><span className="header-account-initial">{session.user.name.trim().charAt(0).toUpperCase()}</span><span>{session.user.name.trim().split(/\s+/)[0]}</span></Link>
              : !sessionPending && <><Link className="header-login-link" href="/connexion" onClick={() => setMenuOpen(false)}>Connexion</Link><Link className="header-register-link" href="/inscription" onClick={() => setMenuOpen(false)}>Inscription</Link></>}
          </div>
        </nav>
        <div className="header-actions">
          <LanguageToggle />
          <button ref={searchToggle} className="icon-button" type="button" aria-label="Rechercher un produit" aria-expanded={searchOpen} aria-controls={searchOpen ? "search-dialog" : undefined} onClick={() => { setSearchProducts([]); setSearchError(""); setSearchLoaded(false); setSearchOpen(true); }}><Icon name="search" /></button>
          <div className="header-account-links">
            {session
              ? <Link className="header-account-badge" href="/compte" aria-label={`Compte de ${session.user.name}`}><span className="header-account-initial">{session.user.name.trim().charAt(0).toUpperCase()}</span><span>{session.user.name.trim().split(/\s+/)[0]}</span></Link>
              : !sessionPending && <><Link className="header-login-link" href="/connexion">Connexion</Link><Link className="header-register-link" href="/inscription">Inscription</Link></>}
          </div>
          <Link className="icon-button cart-button" href="/panier" aria-label={`Panier, ${cartCount} article${cartCount === 1 ? "" : "s"}`}><Icon name="bag" /><span className="cart-count">{cartCount}</span></Link>
        </div>
        <button ref={menuToggle} className="menu-toggle" aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={menuOpen} aria-controls="primary-navigation" onClick={() => setMenuOpen(!menuOpen)}><span /><span /><span /></button>
      </header>
      {searchOpen && <div className="search-layer" onMouseDown={() => { setSearchOpen(false); searchToggle.current?.focus(); }}>
        <section ref={searchDialog} id="search-dialog" className="search-dialog" role="dialog" aria-modal="true" aria-labelledby="search-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
          <div className="search-dialog-top"><p id="search-dialog-title">QUE RECHERCHEZ-VOUS ?</p><button type="button" onClick={() => { setSearchOpen(false); searchToggle.current?.focus(); }} aria-label="Fermer la recherche">×</button></div>
          <form className="search-form" onSubmit={submitSearch}>
            <Icon name="search" />
            <input ref={searchInput} required value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Un article, une catégorie…" aria-label="Votre recherche" />
            {searchQuery && <button type="button" className="search-clear" onClick={() => setSearchQuery("")}>Effacer</button>}
            <button type="submit" className="search-submit">Rechercher</button>
          </form>
          <p className="search-suggestions-title">{normalizedQuery ? "RÉSULTATS RAPIDES" : "QUELQUES IDÉES"}</p>
          {searchError ? <p className="search-no-results" role="status">{searchError}</p> : !searchLoaded ? <p className="search-no-results" role="status">Chargement des produits…</p> : searchResults.length ? <div className="search-suggestions">
            {searchResults.map((product) => <Link href={`/produit/${product.slug}`} onClick={() => setSearchOpen(false)} key={product.slug}>
              <span className="search-product-image" style={{ backgroundImage: `url("${productImage(product.image, 120)}")` }} />
              <span className="search-product-copy"><strong>{product.name}</strong><small>{product.category}</small></span>
              <span className="search-product-price">{product.price}</span>
            </Link>)}
          </div> : <p className="search-no-results">Aucun produit ne correspond. Essayez un autre mot-clé.</p>}
        </section>
      </div>}
    </>
  );
}
