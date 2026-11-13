import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import AccountDashboard from "../../components/auth/AccountDashboard";
import AccountPage from "../../components/auth/AccountPage";
import { getAuth } from "../../lib/auth";

export const metadata: Metadata = {
  title: "Mon espace client",
  description: "Gérez votre espace client Espace Shopping Plus.",
  robots: { index: false, follow: false },
};

export default function AccountOverviewPage() {
  return (
    <Suspense fallback={<AccountPage><p className="account-status">Vérification de votre session…</p></AccountPage>}>
      <AccountContent />
    </Suspense>
  );
}

async function AccountContent() {
  await connection();
  if (!process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET.length < 32) {
    redirect("/connexion");
  }

  const session = await getAuth().api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/connexion");
  }

  return (
    <AccountPage>
      <AccountDashboard name={session.user.name} email={session.user.email} isAdmin={session.user.role === "admin" || session.user.role === "superadmin"} />
    </AccountPage>
  );
}
