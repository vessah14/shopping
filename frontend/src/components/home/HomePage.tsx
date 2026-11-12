"use client";

import { useEffect } from "react";
import CategorySection from "./CategorySection";
import HeroSection from "./HeroSection";
import ProductSection from "./ProductSection";
import SiteFooter from "../layout/SiteFooter";
import SiteHeader from "../layout/SiteHeader";
import AboutSection from "./AboutSection";
import StyleContactSection from "./StyleContactSection";
import TestimonialsSection from "./TestimonialsSection";
import ServiceBenefits from "./ServiceBenefits";
import { useCart } from "../cart/cartStore";
import type { Product } from "../../data/store";
import type { StoreCategory } from "../../lib/store-data";

export default function HomePage({ products, categories }: { products: Product[]; categories: StoreCategory[] }) {
  const { addItem } = useCart();

  useEffect(() => {
    const home = document.querySelector<HTMLElement>(".home-page");
    if (!home) return;

    const sections = Array.from(home.querySelectorAll<HTMLElement>(":scope > section:not(.hero)"));
    home.classList.add("has-scroll-reveal");

    if (!("IntersectionObserver" in window)) {
      sections.forEach((section) => section.classList.add("is-visible"));
      return () => home.classList.remove("has-scroll-reveal");
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.12, rootMargin: "0px 0px -36px 0px" });

    sections.forEach((section) => observer.observe(section));
    return () => {
      observer.disconnect();
      home.classList.remove("has-scroll-reveal");
    };
  }, []);

  return (
    <main className="home-page">
      <SiteHeader />
      <HeroSection />
      <ServiceBenefits />
      <CategorySection categories={categories} />
      <ProductSection products={products} onAddToCart={addItem} />
      <AboutSection />
      <StyleContactSection />
      <TestimonialsSection />
      <SiteFooter />
    </main>
  );
}
