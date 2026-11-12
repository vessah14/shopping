import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { adminAc, userAc } from "better-auth/plugins/admin/access";
import { Pool } from "pg";

const globalForAuth = globalThis as typeof globalThis & { authPool?: Pool };

export function getDatabasePool() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be set before using database features.");
  }

  const pool = globalForAuth.authPool ?? new Pool({ connectionString: databaseUrl, max: 5 });

  if (process.env.NODE_ENV !== "production") {
    globalForAuth.authPool = pool;
  }

  return pool;
}

function authEnvironment() {
  const databaseUrl = process.env.DATABASE_URL;
  const secret = process.env.BETTER_AUTH_SECRET;
  const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be set before using account features.");
  }

  if (!secret || secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must be set to a random value of at least 32 characters.");
  }

  return { secret, baseURL };
}

function createAuth() {
  const { secret, baseURL } = authEnvironment();
  return betterAuth({
    baseURL,
    secret,
    trustedOrigins: [baseURL, process.env.SUPERADMIN_URL ?? "http://localhost:3001"],
    database: getDatabasePool(),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    plugins: [admin({
      defaultRole: "user",
      adminRoles: ["admin", "superadmin"],
      roles: {
        user: userAc,
        admin: adminAc,
        superadmin: adminAc,
      },
    })],
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
  });
}

export const auth = process.env.DATABASE_URL && (process.env.BETTER_AUTH_SECRET?.length ?? 0) >= 32
  ? createAuth()
  : null;

export function getAuth() {
  authEnvironment();
  if (!auth) {
    throw new Error("Authentication was not initialized. Restart the application after configuring .env.");
  }
  return auth;
}
