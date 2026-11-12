import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
const superadminEmail = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();

if (!databaseUrl || !superadminEmail) {
  throw new Error("Set DATABASE_URL and SUPERADMIN_EMAIL in frontend/.env first.");
}

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });

try {
  const result = await pool.query(
    'UPDATE "user" SET role = $1 WHERE lower(email) = $2 RETURNING id',
    ["superadmin", superadminEmail],
  );

  if (result.rowCount !== 1) {
    throw new Error("No matching account found. Register that address at /inscription, then run this command again.");
  }

  console.log("The configured account now has the superadmin role.");
} finally {
  await pool.end();
}
