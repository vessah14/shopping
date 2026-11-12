import type { Metadata } from "next";
import AccountPage from "../../components/auth/AccountPage";
import AccountForm from "../../components/auth/AccountForm";

export const metadata: Metadata = { title: "Espace client | Espace Shopping Plus", description: "Contactez Espace Shopping Plus pour un renseignement ou une commande." };

export default function RegisterPage() {
  return <AccountPage><AccountForm mode="register" /></AccountPage>;
}
