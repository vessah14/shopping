import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Connexion administrateur | Espace Shopping Plus" };

export default function SuperadminLoginPage() {
  redirect("/");
}
