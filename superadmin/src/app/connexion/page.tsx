import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import SuperadminLoginForm from "@/components/superadmin/SuperadminLoginForm";
import { getSuperadminAccess } from "@/lib/superadmin-access";

export const metadata: Metadata = { title: "Connexion administrateur | Espace Shopping Plus" };

export default function SuperadminLoginPage() {
  return <Suspense fallback={null}><LoginContent /></Suspense>;
}

async function LoginContent() {
  await connection();
  const access = await getSuperadminAccess();
  if (access.kind === "authorized" || access.kind === "unconfigured") redirect("/");
  return <SuperadminLoginForm />;
}
