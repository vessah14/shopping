import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};

export default function SuperadminRedirect() {
  const superadminUrl = process.env.SUPERADMIN_URL ?? "http://localhost:3001";
  redirect(superadminUrl);
}
