import { afterEach, describe, expect, it, vi } from "vitest";
import { getStoreData, getStoreProduct } from "./store-data";

describe("store catalogue data source", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not display a hardcoded catalogue when the database and store API are unconfigured", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("STORE_API_URL", "");

    await expect(getStoreData()).rejects.toThrow("Configure DATABASE_URL or STORE_API_URL");
    await expect(getStoreProduct("hoodie-signature-pink")).rejects.toThrow("Configure DATABASE_URL or STORE_API_URL");
  });

  it("accepts nullable original prices returned by the store API", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("STORE_API_URL", "http://localhost:5277");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      products: [{
        slug: "robe",
        name: "Robe",
        price: "2 000 FCFA",
        originalPrice: null,
        image: "/robe.jpg",
        images: ["/robe.jpg", "/robe-detail.jpg"],
        category: "Mode",
        description: "Robe",
        sizes: ["M"],
        colors: ["Noir"],
        stockQuantity: 2,
        isAvailable: true,
        isPromo: false,
        active: true,
      }, {
        slug: "robe-ancienne",
        name: "Robe ancienne",
        price: "3 000 FCFA",
        originalPrice: null,
        image: "/robe-ancienne.jpg",
        category: "Mode",
        description: "Ancien produit sans galerie",
        sizes: ["M"],
        colors: ["Noir"],
        stockQuantity: 1,
        isAvailable: true,
        isPromo: false,
        active: true,
      }],
      categories: [{
        name: "Mode",
        slug: "mode",
        image: "/mode.jpg",
        active: true,
        featured: true,
        sortOrder: 1,
      }],
    }), { status: 200 })));

    await expect(getStoreData()).resolves.toMatchObject({
      products: [
        { slug: "robe", originalPrice: undefined, images: ["/robe.jpg", "/robe-detail.jpg"] },
        { slug: "robe-ancienne", images: ["/robe-ancienne.jpg"] },
      ],
      categories: [{ slug: "mode" }],
    });
  });
});
