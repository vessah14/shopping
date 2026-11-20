import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";

export type SuperadminAccess =
  | { kind: "unconfigured" }
  | { kind: "unauthenticated" }
  | { kind: "forbidden" }
  | {
    kind: "authorized";
    isSuperadmin: boolean;
    user: { id: string; name: string; email: string; role: "admin" | "superadmin" };
  };

function isConfigured() {
  return Boolean(
    process.env.DATABASE_URL &&
    (process.env.BETTER_AUTH_SECRET?.length ?? 0) >= 32,
  );
}

/**
 * Resolves the Better Auth session of the current request and only grants access
 * to accounts holding the `admin` or `superadmin` role.
 */
export async function getSuperadminAccess(): Promise<SuperadminAccess> {
  if (!isConfigured()) return { kind: "unconfigured" };

  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return { kind: "unauthenticated" };

  const role = session.user.role;
  if (role !== "admin" && role !== "superadmin") return { kind: "forbidden" };

  return {
    kind: "authorized",
    isSuperadmin: role === "superadmin",
    user: { id: session.user.id, name: session.user.name, email: session.user.email, role },
  };
}
