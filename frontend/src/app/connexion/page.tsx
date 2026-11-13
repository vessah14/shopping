import type { Metadata } from "next";
import AccountPage from "../../components/auth/AccountPage";
import AccountForm from "../../components/auth/AccountForm";

export const metadata: Metadata = {
  title: "Connexion",
  description: "Connectez-vous à votre compte Espace Shopping Plus pour consulter vos commandes.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return <AccountPage><AccountForm mode="login" /></AccountPage>;
}
