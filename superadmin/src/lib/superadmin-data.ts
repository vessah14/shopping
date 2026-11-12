import { getDatabasePool } from "./auth";

export type SuperadminOverview = {
  products: number;
  categories: number;
  orders: number;
  customers: number;
  pendingOrders: number;
};

export async function getSuperadminOverview(): Promise<SuperadminOverview> {
  const pool = getDatabasePool();
  const [products, categories, orders, customers, pendingOrders] = await Promise.all([
    pool.query<{ count: string }>("SELECT count(*)::text AS count FROM store_products WHERE is_active = true"),
    pool.query<{ count: string }>("SELECT count(*)::text AS count FROM store_categories WHERE is_active = true"),
    pool.query<{ count: string }>("SELECT count(*)::text AS count FROM store_orders"),
    pool.query<{ count: string }>(`SELECT count(*)::text AS count FROM "user" WHERE COALESCE(role, 'user') IN ('user', 'customer')`),
    pool.query<{ count: string }>("SELECT count(*)::text AS count FROM store_orders WHERE status = 'pending'"),
  ]);
  return {
    products: Number(products.rows[0].count),
    categories: Number(categories.rows[0].count),
    orders: Number(orders.rows[0].count),
    customers: Number(customers.rows[0].count),
    pendingOrders: Number(pendingOrders.rows[0].count),
  };
}
