import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to create the store tables.");
}

const schemaPath = fileURLToPath(new URL("./store-schema.sql", import.meta.url));
const schema = await readFile(schemaPath, "utf8");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

try {
  await pool.query(schema);
  console.log("Store schema is ready.");
} finally {
  await pool.end();
}
