import type { Metadata } from "next";
import { siteUrl } from "../lib/seo";
import "./globals.css";

const siteName = "Espace Shopping Plus";
const description = "Boutique de mode, beauté et cheveux à Douala, Cameroun. Découvrez nos nouveautés et commandez facilement sur WhatsApp.";
const socialImage = "/espace-shopping-plus/logo-principal.png";

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: "Espace Shopping Plus | Mode et beauté à Douala",
    template: "%s | Espace Shopping Plus",
  },
  description,
  applicationName: siteName,
  openGraph: {
    type: "website",
    locale: "fr_CM",
    url: siteUrl,
    siteName,
    title: "Espace Shopping Plus | Mode et beauté à Douala",
    description,
    images: [{ url: socialImage, alt: siteName }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Espace Shopping Plus | Mode et beauté à Douala",
    description,
    images: [socialImage],
  },
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
