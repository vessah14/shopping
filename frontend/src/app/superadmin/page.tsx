import { redirect } from "next/navigation";

export default function SuperadminRedirect() {
  const superadminUrl = process.env.SUPERADMIN_URL ?? "http://localhost:3001";
  redirect(superadminUrl);
}
