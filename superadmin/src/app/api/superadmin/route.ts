import { NextResponse, type NextRequest } from "next/server";
import { getDatabasePool } from "@/lib/auth";
import { getSuperadminAccess } from "@/lib/superadmin-access";
import { getSuperadminOverview } from "@/lib/superadmin-data";

type JsonRecord = Record<string, unknown>;
type ProductType = "single_piece" | "set";

function isProductType(value: unknown): value is ProductType {
  return value === "single_piece" || value === "set";
}

const orderStatuses = ["pending", "confirmed", "preparing", "shipped", "delivered", "cancelled"] as const;
const paymentStatuses = ["pending", "confirmed", "failed", "refunded"] as const;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(body: JsonRecord, key: string, maxLength: number) {
  const value = body[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maxLength ? trimmed : null;
}

function readInteger(body: JsonRecord, key: string, min: number, max: number) {
  const value = body[key];
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

function readStringArray(body: JsonRecord, key: string) {
  const value = body[key];
  if (!Array.isArray(value) || value.length > 30 || value.some((entry) => typeof entry !== "string" || entry.trim().length > 40)) return null;
  return value.map((entry) => entry.trim()).filter(Boolean);
}

function validImage(value: string) {
  return /^photo-[a-zA-Z0-9-]{5,100}$/.test(value) || /^\/(?:espace-shopping-plus\/[a-zA-Z0-9._-]{1,120}|uploads\/products\/[0-9a-f-]{36}\.(?:jpg|png|webp))$/.test(value);
}

function readProductImages(body: JsonRecord, image: string) {
  const value = body.images === undefined ? [image] : body.images;
  if (!Array.isArray(value) || value.length < 1 || value.length > 10 ||
      value.some((entry) => typeof entry !== "string" || !validImage(entry)) ||
      value[0] !== image || new Set(value).size !== value.length) {
    return null;
  }
  return value;
}

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 100);
}

async function guard() {
  const access = await getSuperadminAccess();
  const noStore = { "Cache-Control": "no-store" };
  if (access.kind === "unconfigured") {
    return { response: NextResponse.json({ error: "Configure DATABASE_URL, BETTER_AUTH_SECRET et SUPERADMIN_EMAIL." }, { status: 503, headers: noStore }) };
  }
  if (access.kind === "unauthenticated") {
    return { response: NextResponse.json({ error: "Connectez-vous avec un compte administrateur." }, { status: 401, headers: noStore }) };
  }
  if (access.kind === "forbidden") {
    return { response: NextResponse.json({ error: "Ce compte n’a pas le rôle administrateur." }, { status: 403, headers: noStore }) };
  }
  return { access };
}

export async function GET(request: NextRequest) {
  const section = request.nextUrl.searchParams.get("section") ?? "overview";
  const auth = await guard();
  if ("response" in auth) return auth.response;

  const pool = getDatabasePool();
  if (section === "overview") {
    return NextResponse.json(await getSuperadminOverview());
  }

  if (section === "products") {
    const result = await pool.query(
      `SELECT slug, name, price_cfa AS "priceCfa", original_price_cfa AS "originalPriceCfa", image, images, category, description, sizes, colors, product_type AS "productType",
              seller_name AS "sellerName",
              stock_quantity AS "stockQuantity", is_available AS "isAvailable", is_active AS active, is_promo AS "isPromo"
       FROM store_products ORDER BY updated_at DESC, name`,
    );
    return NextResponse.json(result.rows);
  }

  if (section === "categories") {
    const result = await pool.query(
      `SELECT name, slug, image, is_active AS active, is_featured AS featured, sort_order AS "sortOrder"
       FROM store_categories ORDER BY sort_order, name`,
    );
    return NextResponse.json(result.rows);
  }

  if (section === "orders") {
    const result = await pool.query(
      `SELECT o.id, o.customer_name AS "customerName", o.customer_email AS "customerEmail",
              o.phone, o.city, o.delivery_address AS "deliveryAddress", o.delivery_notes AS "deliveryNotes",
              o.status, o.payment_method AS "paymentMethod", o.payment_status AS "paymentStatus",
              o.subtotal_cfa AS "subtotalCfa", o.created_at AS "createdAt",
              COALESCE(json_agg(json_build_object(
                'slug', i.product_slug, 'name', i.product_name, 'unitPriceCfa', i.unit_price_cfa,
                'quantity', i.quantity, 'lineTotalCfa', i.line_total_cfa,
                'size', i.size, 'color', i.color, 'image', p.image
              )) FILTER (WHERE i.id IS NOT NULL), '[]'::json) AS items
       FROM store_orders o
       LEFT JOIN store_order_items i ON i.order_id = o.id
       LEFT JOIN store_products p ON p.slug = i.product_slug
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT 250`,
    );
    return NextResponse.json(result.rows);
  }

  if (section === "payouts") {
    const result = await pool.query(
      `SELECT order_id AS id, order_id AS "orderId", destination,
              amount_cfa AS "amountCfa", status, fapshi_trans_id AS "transactionId",
              details, created_at AS "createdAt"
       FROM store_owner_payouts ORDER BY created_at DESC LIMIT 500`,
    );
    return NextResponse.json(result.rows);
  }

  if (section === "customers") {
    const result = await pool.query(
      `SELECT id, name, email, "createdAt" AS "createdAt"
       FROM "user"
       WHERE COALESCE(role, 'user') IN ('user', 'customer')
       ORDER BY "createdAt" DESC
       LIMIT 500`,
    );
    return NextResponse.json(result.rows);
  }

  if (section === "announcements") {
    const result = await pool.query(
      `SELECT id::integer AS id, message, is_enabled AS enabled, starts_at AS "startsAt",
              ends_at AS "endsAt", created_at AS "createdAt", updated_at AS "updatedAt",
              (is_enabled AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now())) AS "currentlyActive",
              (is_enabled AND starts_at > now()) AS "isScheduled"
       FROM store_announcement_posts
       ORDER BY created_at DESC, id DESC`,
    );
    return NextResponse.json(result.rows);
  }

  return NextResponse.json({ error: "Section inconnue." }, { status: 404 });
}

export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body)) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const entity = body.entity;
  const auth = await guard();
  if ("response" in auth) return auth.response;
  const pool = getDatabasePool();

  if (entity === "announcement") {
    const message = readString(body, "message", 280);
    const startsAt = readString(body, "startsAt", 40);
    const endsAt = body.endsAt === null ? null : readString(body, "endsAt", 40);
    const startsAtDate = startsAt ? new Date(startsAt) : null;
    const endsAtDate = endsAt ? new Date(endsAt) : null;
    if (!message || typeof body.enabled !== "boolean" ||
        !startsAtDate || Number.isNaN(startsAtDate.getTime()) ||
        (body.endsAt !== null && !endsAtDate) ||
        (endsAtDate && (Number.isNaN(endsAtDate.getTime()) || endsAtDate.getTime() <= startsAtDate.getTime()))) {
      return NextResponse.json({ error: "Vérifiez le texte et les dates de l’annonce. La date de fin doit être postérieure à la date de début." }, { status: 400 });
    }
    const result = await pool.query(
      `INSERT INTO store_announcement_posts (message, is_enabled, starts_at, ends_at)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [message, body.enabled, startsAtDate, endsAtDate],
    );
    return NextResponse.json({ id: result.rows[0].id }, { status: 201 });
  }

  if (entity === "category") {
    const name = readString(body, "name", 100);
    const image = readString(body, "image", 180);
    const sortOrder = body.sortOrder === undefined ? null : readInteger(body, "sortOrder", 0, 10000);
    const featured = body.featured === undefined ? false : body.featured;
    if (!name || !image || !validImage(image) || (body.sortOrder !== undefined && sortOrder === null) || typeof featured !== "boolean") {
      return NextResponse.json({ error: "Vérifiez le nom, l’image et l’ordre d’affichage de la catégorie." }, { status: 400 });
    }
    const slug = slugify(name);
    if (!slug) return NextResponse.json({ error: "Le nom de la catégorie doit contenir des lettres ou des chiffres." }, { status: 400 });
    const result = await pool.query(
      `INSERT INTO store_categories (name, slug, image, is_active, is_featured, sort_order)
       VALUES ($1, $2, $3, true, $4, COALESCE($5, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM store_categories)))
       ON CONFLICT DO NOTHING RETURNING slug`,
      [name, slug, image, featured, sortOrder],
    );
    if (!result.rowCount) return NextResponse.json({ error: "Une catégorie avec ce nom existe déjà." }, { status: 409 });
    return NextResponse.json({ slug: result.rows[0].slug }, { status: 201 });
  }

  if (entity === "product") {
    const name = readString(body, "name", 140);
    const image = readString(body, "image", 180);
    const images = image ? readProductImages(body, image) : null;
    const category = readString(body, "category", 100);
    const description = readString(body, "description", 3000);
    const priceCfa = readInteger(body, "priceCfa", 1, 100_000_000);
    const originalPriceCfa = body.originalPriceCfa === null ? null : readInteger(body, "originalPriceCfa", 1, 100_000_000);
    const stockQuantity = readInteger(body, "stockQuantity", 0, 1_000_000);
    const sizes = body.sizes === undefined ? [] : readStringArray(body, "sizes");
    const colors = readStringArray(body, "colors");
    const productType = body.productType === undefined ? "single_piece" : body.productType;
    const sellerName = readString(body, "sellerName", 140);
    if (!name || !image || !images || !category || !description || !sellerName || priceCfa === null || (body.originalPriceCfa !== null && originalPriceCfa === null) || stockQuantity === null || !sizes || !colors || !isProductType(productType) || typeof body.isPromo !== "boolean") {
      return NextResponse.json({ error: "Vérifiez les champs du produit et ses images (10 maximum)." }, { status: 400 });
    }
    if (body.isPromo ? originalPriceCfa === null || originalPriceCfa <= priceCfa : originalPriceCfa !== null) return NextResponse.json({ error: "Une promotion exige un ancien prix supérieur au prix actuel. Sans promotion, laissez ce champ vide." }, { status: 400 });
    if (body.isAvailable === true && stockQuantity === 0) {
      return NextResponse.json({ error: "Ajoutez du stock avant de marquer cet article disponible." }, { status: 400 });
    }
    const activeCategory = await pool.query<{ is_active: boolean }>(
      "SELECT is_active FROM store_categories WHERE name=$1",
      [category],
    );
    if (!activeCategory.rows[0]?.is_active) return NextResponse.json({ error: "Choisissez une catégorie active." }, { status: 400 });
    const slug = readString(body, "slug", 100) ?? slugify(name);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return NextResponse.json({ error: "Identifiant produit invalide." }, { status: 400 });
    const existing = await pool.query("SELECT 1 FROM store_products WHERE slug=$1", [slug]);
    if (existing.rowCount) return NextResponse.json({ error: "Un produit utilise déjà cet identifiant URL." }, { status: 409 });
    const isAvailable = body.isAvailable === true && stockQuantity > 0;
    const result = await pool.query(
      `INSERT INTO store_products
        (slug, name, price_cfa, original_price_cfa, image, images, category, description, sizes, colors, product_type, stock_quantity, is_available, is_promo, seller_name)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13,$14,$15)
       RETURNING slug`,
      [slug, name, priceCfa, originalPriceCfa, image, JSON.stringify(images), category, description, JSON.stringify(sizes), JSON.stringify(colors), productType, stockQuantity, isAvailable, body.isPromo, sellerName],
    );
    return NextResponse.json({ slug: result.rows[0].slug }, { status: 201 });
  }

  return NextResponse.json({ error: "Type de création inconnu." }, { status: 400 });
}

export async function PATCH(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body)) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const entity = body.entity;
  const auth = await guard();
  if ("response" in auth) return auth.response;
  const pool = getDatabasePool();

  if (entity === "announcement") {
    const id = readInteger(body, "id", 1, 2_147_483_647);
    const message = readString(body, "message", 280);
    const startsAt = readString(body, "startsAt", 40);
    const endsAt = body.endsAt === null ? null : readString(body, "endsAt", 40);
    const startsAtDate = startsAt ? new Date(startsAt) : null;
    const endsAtDate = endsAt ? new Date(endsAt) : null;
    if (id === null || !message || typeof body.enabled !== "boolean" ||
        !startsAtDate || Number.isNaN(startsAtDate.getTime()) ||
        (body.endsAt !== null && !endsAtDate) ||
        (endsAtDate && (Number.isNaN(endsAtDate.getTime()) || endsAtDate.getTime() <= startsAtDate.getTime()))) {
      return NextResponse.json({ error: "Vérifiez le texte et les dates de l’annonce. La date de fin doit être postérieure à la date de début." }, { status: 400 });
    }
    const result = await pool.query(
      `UPDATE store_announcement_posts
       SET message=$2, is_enabled=$3, starts_at=$4, ends_at=$5, updated_at=now()
       WHERE id=$1
       RETURNING id`,
      [id, message, body.enabled, startsAtDate, endsAtDate],
    );
    if (!result.rowCount) return NextResponse.json({ error: "Annonce introuvable." }, { status: 404 });
    return NextResponse.json({ success: true });
  }

  if (entity === "product") {
    if (body.active === true) {
      const slug = readString(body, "slug", 100);
      if (!slug) return NextResponse.json({ error: "Produit invalide." }, { status: 400 });
      const result = await pool.query("UPDATE store_products SET is_active=true, updated_at=now() WHERE slug=$1 RETURNING slug", [slug]);
      if (!result.rowCount) return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
      return NextResponse.json({ success: true });
    }
    const slug = readString(body, "slug", 100);
    const name = readString(body, "name", 140);
    const image = readString(body, "image", 180);
    const images = image ? readProductImages(body, image) : null;
    const category = readString(body, "category", 100);
    const description = readString(body, "description", 3000);
    const priceCfa = readInteger(body, "priceCfa", 1, 100_000_000);
    const originalPriceCfa = body.originalPriceCfa === null ? null : readInteger(body, "originalPriceCfa", 1, 100_000_000);
    const stockQuantity = readInteger(body, "stockQuantity", 0, 1_000_000);
    const sizes = body.sizes === undefined ? [] : readStringArray(body, "sizes");
    const colors = readStringArray(body, "colors");
    const productType = body.productType;
    const sellerName = readString(body, "sellerName", 140);
    if (!slug || !name || !image || !images || !category || !description || !sellerName || priceCfa === null || (body.originalPriceCfa !== null && originalPriceCfa === null) || stockQuantity === null || !sizes || !colors || !isProductType(productType) || typeof body.isAvailable !== "boolean" || typeof body.isPromo !== "boolean") {
      return NextResponse.json({ error: "Vérifiez les champs du produit et ses images (10 maximum)." }, { status: 400 });
    }
    if (body.isAvailable && stockQuantity === 0) return NextResponse.json({ error: "Ajoutez du stock avant de marquer cet article disponible." }, { status: 400 });
    const activeCategory = await pool.query<{ is_active: boolean }>(
      "SELECT is_active FROM store_categories WHERE name=$1",
      [category],
    );
    if (!activeCategory.rows[0]?.is_active) return NextResponse.json({ error: "Choisissez une catégorie active." }, { status: 400 });
    const result = await pool.query(
      `UPDATE store_products SET name=$2, price_cfa=$3, original_price_cfa=$4, image=$5, images=$6::jsonb, category=$7, description=$8,
        sizes=$9::jsonb, colors=$10::jsonb, product_type=$11, stock_quantity=$12, is_available=$13, is_promo=$14,
        seller_name=$15, updated_at=now()
       WHERE slug=$1 RETURNING slug`,
      [slug, name, priceCfa, originalPriceCfa, image, JSON.stringify(images), category, description, JSON.stringify(sizes), JSON.stringify(colors), productType, stockQuantity, body.isAvailable, body.isPromo, sellerName],
    );
    if (!result.rowCount) return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
    return NextResponse.json({ success: true });
  }

  if (entity === "category") {
    const oldSlug = readString(body, "oldSlug", 100);
    const sortOrder = readInteger(body, "sortOrder", 0, 10000);
    if (!oldSlug || sortOrder === null || typeof body.active !== "boolean" || typeof body.featured !== "boolean") {
      return NextResponse.json({ error: "Vérifiez les informations de la catégorie." }, { status: 400 });
    }
    const result = await pool.query(
      `UPDATE store_categories SET is_active=$2, is_featured=$3, sort_order=$4 WHERE slug=$1 RETURNING slug`,
      [oldSlug, body.active, body.featured, sortOrder],
    );
    if (!result.rowCount) return NextResponse.json({ error: "Catégorie introuvable." }, { status: 404 });
    return NextResponse.json({ success: true });
  }

  if (entity === "order") {
    const id = readString(body, "id", 100);
    const status = orderStatuses.find((candidate) => candidate === body.status);
    const paymentStatus = paymentStatuses.find((candidate) => candidate === body.paymentStatus);
    if (!id || (body.status !== undefined && !status) ||
        (body.paymentStatus !== undefined && !paymentStatus) ||
        (status === undefined && paymentStatus === undefined)) {
      return NextResponse.json({ error: "Statut de commande invalide." }, { status: 400 });
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query<{ status: typeof orderStatuses[number] }>(
        "SELECT status FROM store_orders WHERE id=$1 FOR UPDATE",
        [id],
      );
      if (!current.rows[0]) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
      }
      const oldStatus = current.rows[0].status;
      if (status !== undefined) {
        const validTransitions: Record<string, string[]> = {
          pending: ["confirmed", "cancelled"],
          confirmed: ["preparing", "cancelled"],
          preparing: ["shipped", "cancelled"],
          shipped: ["delivered"],
          delivered: [],
          cancelled: [],
        };
        if (status !== oldStatus && !validTransitions[oldStatus].includes(status)) {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: "Cette transition de commande n’est pas autorisée." }, { status: 409 });
        }
        if (status === "cancelled" && oldStatus !== "cancelled") {
          await client.query(
            `UPDATE store_products p SET stock_quantity=p.stock_quantity+i.quantity,
              is_available=true, updated_at=now()
             FROM store_order_items i WHERE i.order_id=$1 AND p.slug=i.product_slug`,
            [id],
          );
        }
      }
      await client.query(
        `UPDATE store_orders SET status=COALESCE($2,status), payment_status=COALESCE($3,payment_status), updated_at=now()
         WHERE id=$1`,
        [id, status ?? null, paymentStatus ?? null],
      );
      await client.query("COMMIT");
      return NextResponse.json({ success: true });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  return NextResponse.json({ error: "Type de modification inconnu." }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  const entity = request.nextUrl.searchParams.get("entity");
  const slug = request.nextUrl.searchParams.get("slug");
  const auth = await guard();
  if ("response" in auth) return auth.response;
  if (entity === "announcement") {
    const id = Number(request.nextUrl.searchParams.get("id"));
    if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: "Annonce invalide." }, { status: 400 });
    const result = await getDatabasePool().query("DELETE FROM store_announcement_posts WHERE id=$1 RETURNING id", [id]);
    if (!result.rowCount) return NextResponse.json({ error: "Annonce introuvable." }, { status: 404 });
    return NextResponse.json({ success: true });
  }
  if (!slug || entity !== "product") {
    return NextResponse.json({ error: "Ressource invalide." }, { status: 400 });
  }

  const result = await getDatabasePool().query(
    "UPDATE store_products SET is_active=false WHERE slug=$1 RETURNING slug",
    [slug],
  );
  if (!result.rowCount) return NextResponse.json({ error: "Ressource introuvable." }, { status: 404 });
  return NextResponse.json({ success: true });
}
