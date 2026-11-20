CREATE TABLE IF NOT EXISTS store_categories (
  name text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  image text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS store_products (
  slug text PRIMARY KEY,
  name text NOT NULL,
  price_cfa integer NOT NULL CHECK (price_cfa >= 0),
  original_price_cfa integer CHECK (original_price_cfa IS NULL OR original_price_cfa > price_cfa),
  image text NOT NULL,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  category text NOT NULL REFERENCES store_categories(name) ON UPDATE CASCADE,
  description text NOT NULL,
  sizes jsonb NOT NULL DEFAULT '[]'::jsonb,
  colors jsonb NOT NULL DEFAULT '[]'::jsonb,
  stock_quantity integer NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  is_available boolean NOT NULL DEFAULT false,
  is_promo boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_products_available_has_stock CHECK (NOT is_available OR stock_quantity > 0)
);

ALTER TABLE store_products ADD COLUMN IF NOT EXISTS original_price_cfa integer;
ALTER TABLE store_products ADD COLUMN IF NOT EXISTS images jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE store_products ADD COLUMN IF NOT EXISTS seller_name text NOT NULL DEFAULT 'Espace Shopping Plus';
ALTER TABLE store_products ADD COLUMN IF NOT EXISTS seller_mobile_money text;
UPDATE store_products SET images = jsonb_build_array(image) WHERE images = '[]'::jsonb;

CREATE TABLE IF NOT EXISTS store_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  phone text NOT NULL,
  city text NOT NULL,
  delivery_address text NOT NULL,
  delivery_notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled')),
  payment_method text NOT NULL
    CONSTRAINT store_orders_payment_method_check
    CHECK (payment_method IN ('cash_on_delivery', 'mtn_money', 'orange_money', 'saspay')),
  payment_status text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'confirmed', 'failed', 'refunded')),
  saspay_checkout_session_id text UNIQUE,
  saspay_checkout_url text,
  subtotal_cfa integer NOT NULL CHECK (subtotal_cfa >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE store_orders
  ADD COLUMN IF NOT EXISTS saspay_checkout_session_id text UNIQUE;
ALTER TABLE store_orders
  ADD COLUMN IF NOT EXISTS saspay_checkout_url text;
ALTER TABLE store_orders
  ADD COLUMN IF NOT EXISTS saspay_payment_id text;
CREATE INDEX IF NOT EXISTS store_orders_pending_saspay_idx
  ON store_orders (created_at)
  WHERE payment_method = 'saspay' AND payment_status = 'pending';
ALTER TABLE store_orders
  DROP CONSTRAINT IF EXISTS store_orders_payment_method_check;
ALTER TABLE store_orders
  ADD CONSTRAINT store_orders_payment_method_check
  CHECK (payment_method IN ('cash_on_delivery', 'mtn_money', 'orange_money', 'saspay'));

CREATE TABLE IF NOT EXISTS store_order_items (
  id bigserial PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES store_orders(id) ON DELETE CASCADE,
  product_slug text NOT NULL REFERENCES store_products(slug) ON DELETE RESTRICT,
  product_name text NOT NULL,
  unit_price_cfa integer NOT NULL CHECK (unit_price_cfa >= 0),
  quantity integer NOT NULL CHECK (quantity > 0),
  line_total_cfa integer NOT NULL CHECK (line_total_cfa >= 0)
);

-- Simulation-only seller ledger. No money is transferred by this table.
CREATE TABLE IF NOT EXISTS store_seller_payouts (
  id bigserial PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES store_orders(id) ON DELETE RESTRICT,
  seller_name text NOT NULL,
  destination text NOT NULL,
  amount_cfa integer NOT NULL CHECK (amount_cfa > 0),
  status text NOT NULL DEFAULT 'simulated' CHECK (status IN ('simulated', 'ready', 'paid', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, seller_name, destination)
);

CREATE INDEX IF NOT EXISTS store_seller_payouts_status_created_idx
  ON store_seller_payouts (status, created_at DESC);

CREATE TABLE IF NOT EXISTS store_comments (
  id bigserial PRIMARY KEY,
  author_name text NOT NULL CHECK (char_length(btrim(author_name)) BETWEEN 2 AND 80),
  message text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 2 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS store_announcements (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  message text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 280),
  is_enabled boolean NOT NULL DEFAULT false,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_announcements_valid_schedule CHECK (ends_at IS NULL OR ends_at > starts_at)
);

INSERT INTO store_announcements (id, message, is_enabled)
VALUES (1, 'Bienvenue chez Espace Shopping Plus.', false)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS store_announcement_posts (
  id bigserial PRIMARY KEY,
  message text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 280),
  is_enabled boolean NOT NULL DEFAULT false,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  legacy_source_id smallint UNIQUE,
  CONSTRAINT store_announcement_posts_valid_schedule CHECK (ends_at IS NULL OR ends_at > starts_at)
);

INSERT INTO store_announcement_posts (message, is_enabled, starts_at, ends_at, created_at, updated_at, legacy_source_id)
SELECT message, is_enabled, starts_at, ends_at, updated_at, updated_at, id
FROM store_announcements
WHERE id = 1
ON CONFLICT (legacy_source_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS store_orders_customer_created_idx
  ON store_orders (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS store_orders_status_created_idx
  ON store_orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS store_products_active_category_idx
  ON store_products (is_active, category);
CREATE INDEX IF NOT EXISTS store_comments_created_idx
  ON store_comments (created_at DESC);

INSERT INTO store_categories (name, slug, image, is_active, is_featured, sort_order) VALUES
  ('Produits de beauté', 'produits-de-beaute', '/espace-shopping-plus/beaute-cheveux.jpg', true, true, 1),
  ('Vêtements femmes', 'vetements-femmes', '/espace-shopping-plus/category-vetements-femmes.jpg', true, true, 2),
  ('Vêtements enfants', 'vetements-enfants', '/espace-shopping-plus/category-vetements-enfants.jpg', true, true, 3),
  ('Vêtements hommes', 'vetements-hommes', '/espace-shopping-plus/mode-homme.jpg', true, true, 4),
  ('Chaussures', 'chaussures', '/espace-shopping-plus/category-chaussures.webp', true, true, 5),
  ('Sacs à main', 'sacs-a-main', '/espace-shopping-plus/category-sacs.webp', true, true, 6),
  ('Accessoires de beauté et capillaires', 'accessoires-beaute-capillaires', '/espace-shopping-plus/category-produits-capillaires.jpg', true, true, 7),
  ('Perruques, mèches et greffes', 'perruques-meches-greffes', '/espace-shopping-plus/category-perruques.jpg', true, true, 8),
  ('Bijoux', 'bijoux', '/espace-shopping-plus/category-accessories.jpg', true, true, 9),
  ('Accessoires', 'accessoires', '/espace-shopping-plus/category-new.jpg', true, true, 10)
ON CONFLICT (name) DO UPDATE SET
  slug = EXCLUDED.slug,
  image = EXCLUDED.image,
  is_active = true,
  is_featured = true,
  sort_order = EXCLUDED.sort_order;

-- Delivery zones managed from the admin. The fee of the chosen zone is added to the
-- amount paid online.
CREATE TABLE IF NOT EXISTS store_delivery_zones (
  id bigserial PRIMARY KEY,
  name text NOT NULL UNIQUE CHECK (char_length(btrim(name)) BETWEEN 2 AND 80),
  fee_cfa integer NOT NULL CHECK (fee_cfa BETWEEN 0 AND 1000000),
  delay text NOT NULL DEFAULT '' CHECK (char_length(delay) <= 80),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Guest checkout: orders may exist without a customer account. Guests follow their
-- order with a secret link whose SHA-256 hash is stored here.
ALTER TABLE store_orders ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS access_token_hash text;
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS delivery_zone text;
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS delivery_fee_cfa integer NOT NULL DEFAULT 0;
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS total_cfa integer;
UPDATE store_orders SET total_cfa = subtotal_cfa + delivery_fee_cfa WHERE total_cfa IS NULL;
ALTER TABLE store_orders ALTER COLUMN total_cfa SET NOT NULL;
ALTER TABLE store_orders DROP CONSTRAINT IF EXISTS store_orders_total_check;
ALTER TABLE store_orders
  ADD CONSTRAINT store_orders_total_check CHECK (total_cfa = subtotal_cfa + delivery_fee_cfa AND delivery_fee_cfa >= 0);

-- Size and colour chosen by the customer for each line.
ALTER TABLE store_order_items ADD COLUMN IF NOT EXISTS size text NOT NULL DEFAULT '';
ALTER TABLE store_order_items ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '';
