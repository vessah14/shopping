import { getDatabasePool } from "./auth";

export type DeliveryZone = { id: number; name: string; feeCfa: number; delay: string };

/** Active delivery zones configured in the admin, in display order. */
export async function getDeliveryZones(): Promise<DeliveryZone[]> {
  if (!process.env.DATABASE_URL) return [];
  try {
    const result = await getDatabasePool().query<DeliveryZone>(
      `SELECT id::integer AS id, name, fee_cfa AS "feeCfa", delay
       FROM store_delivery_zones
       WHERE is_active = true
       ORDER BY sort_order, name`,
    );
    return result.rows;
  } catch (error) {
    // The table appears with `npm run db:migrate`; until then the cart explains it.
    console.error("Unable to load delivery zones.", error);
    return [];
  }
}

export function formatCfa(value: number) {
  return `${new Intl.NumberFormat("fr-FR").format(value)} FCFA`;
}
