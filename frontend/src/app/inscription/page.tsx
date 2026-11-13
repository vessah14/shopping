import type { Metadata } from "next";
import AccountPage from "../../components/auth/AccountPage";
import AccountForm from "../../components/auth/AccountForm";

export const metadata: Metadata = {
  title: "Créer un compte",
  description: "Créez un compte Espace Shopping Plus pour suivre vos commandes et retrouver votre espace client.",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return <AccountPage><AccountForm mode="register" /></AccountPage>;
}
