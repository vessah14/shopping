import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import SuperadminPanel from "@/components/superadmin/SuperadminPanel";
import { getSuperadminAccess } from "@/lib/superadmin-access";
import { getSuperadminOverview } from "@/lib/superadmin-data";

export const metadata = { title: "Superadmin | Espace Shopping Plus" };

export default function SuperadminPage() {
  return <Suspense fallback={<main className="superadmin-setup"><p>Chargement de l’administration…</p></main>}><SuperadminContent /></Suspense>;
}

async function SuperadminContent() {
  await connection();
  const access = await getSuperadminAccess();

  if (access.kind === "unconfigured") {
    return (
      <main className="superadmin-setup">
        <p className="eyebrow">ESPACE SHOPPING PLUS</p>
        <h1>Configuration requise</h1>
        <p>Configurez PostgreSQL et les variables DATABASE_URL, BETTER_AUTH_SECRET et SUPERADMIN_EMAIL, puis suivez les étapes du README pour créer votre compte superadmin.</p>
      </main>
    );
  }
  if (access.kind !== "authorized") redirect("/connexion");

  const overview = await getSuperadminOverview();
  const storeUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
  return <SuperadminPanel userName={access.user.name} isSuperadmin={access.isSuperadmin} initialOverview={overview} storeUrl={storeUrl} />;
}
