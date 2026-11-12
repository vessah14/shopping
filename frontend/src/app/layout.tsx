import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Espace Shopping Plus | Mode, beauté et cheveux",
  description: "Découvrez la sélection mode, beauté et cheveux d’Espace Shopping Plus au Cameroun. Renseignements et commandes sur WhatsApp.",
  icons: {
    icon: "/icon.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
