ALTER TABLE store_products
  ADD COLUMN IF NOT EXISTS is_promo boolean NOT NULL DEFAULT false;
