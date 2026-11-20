import type { Metadata } from "next";
import { siteUrl } from "../lib/seo";
import { whatsappUrl } from "../data/contact";
import CartToast from "../components/cart/CartToast";
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
      <body className="min-h-full flex flex-col">
        {children}
        <CartToast />
        <a
          className="whatsapp-float"
          href={`${whatsappUrl}?text=${encodeURIComponent("Bonjour Espace Shopping Plus, j’ai une question au sujet de la boutique.")}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Contacter Espace Shopping Plus sur WhatsApp"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.2 11.7a8.2 8.2 0 0 1-12.1 7.2L3 20l1.2-4.8a8.2 8.2 0 1 1 16-3.5Z" />
            <path d="M8.2 8.1c.3-.6.7-.6 1-.6h.5c.2 0 .4.1.5.4l.7 1.7c.1.2.1.4-.1.6l-.6.7c-.2.2-.2.4 0 .7.5.8 1.2 1.4 2 1.9.3.2.5.2.7 0l.8-.9c.2-.2.4-.2.7-.1l1.6.8c.3.1.4.3.4.5 0 .3-.2 1-.6 1.3-.5.4-1.1.6-1.8.5-1.1-.2-2.4-.8-3.7-2-1.2-1-2.1-2.4-2.4-3.3-.3-.8 0-1.7.3-2.2Z" />
          </svg>
          <span>WhatsApp</span>
        </a>
      </body>
    </html>
  );
}
