export async function getSuperadminAccess() {
  if (!process.env.DATABASE_URL) {
    return { kind: "unconfigured" as const };
  }
  return {
    kind: "authorized" as const,
    isSuperadmin: true,
    user: { name: "Administration", role: "superadmin" as const },
  };
}
