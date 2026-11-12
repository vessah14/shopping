BEGIN;

-- Keep the existing product assignments while folding legacy duplicate rays into the fixed catalog.
UPDATE store_products SET category = 'Produits de beauté', updated_at = now() WHERE category = 'Beauté';
UPDATE store_products SET category = 'Accessoires beauté et capillaires', updated_at = now() WHERE category IN ('Accessoires', 'Beauté et cheveux');
DELETE FROM store_categories WHERE name IN ('Beauté', 'Accessoires', 'Beauté et cheveux');

UPDATE store_categories
SET name = 'Vêtements femmes', slug = 'vetements-femmes', image = '/espace-shopping-plus/category-vetements-femmes.jpg', is_active = true, is_featured = true, sort_order = 2
WHERE slug = 'vetements-femme';
UPDATE store_categories
SET name = 'Vêtements hommes', slug = 'vetements-hommes', image = '/espace-shopping-plus/mode-homme.jpg', is_active = true, is_featured = true, sort_order = 4
WHERE slug = 'vetements-homme';
UPDATE store_categories
SET name = 'Accessoires de beauté et capillaires', image = '/espace-shopping-plus/category-produits-capillaires.jpg', is_active = true, is_featured = true, sort_order = 7
WHERE slug = 'accessoires-beaute-capillaires';
UPDATE store_categories
SET image = '/espace-shopping-plus/beaute-cheveux.jpg', is_active = true, is_featured = true, sort_order = 1
WHERE slug = 'produits-de-beaute';
UPDATE store_categories
SET image = '/espace-shopping-plus/category-chaussures.webp', is_active = true, is_featured = true, sort_order = 5
WHERE slug = 'chaussures';
UPDATE store_categories
SET image = '/espace-shopping-plus/category-sacs.webp', is_active = true, is_featured = true, sort_order = 6
WHERE slug = 'sacs-a-main';

INSERT INTO store_categories (name, slug, image, is_active, is_featured, sort_order) VALUES
  ('Vêtements enfants', 'vetements-enfants', '/espace-shopping-plus/category-vetements-enfants.jpg', true, true, 3),
  ('Perruques, mèches et greffes', 'perruques-meches-greffes', '/espace-shopping-plus/category-perruques.jpg', true, true, 8),
  ('Bijoux', 'bijoux', '/espace-shopping-plus/category-accessories.jpg', true, true, 9),
  ('Accessoires', 'accessoires', '/espace-shopping-plus/category-new.jpg', true, true, 10)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  image = EXCLUDED.image,
  is_active = true,
  is_featured = true,
  sort_order = EXCLUDED.sort_order;

COMMIT;
