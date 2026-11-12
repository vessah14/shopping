import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Superadmin | Espace Shopping Plus",
  description: "Administration de la boutique Espace Shopping Plus.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}
