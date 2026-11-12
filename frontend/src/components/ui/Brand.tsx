import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";

export function Brand({ light = false, alternate = false }: { light?: boolean; alternate?: boolean }) {
  return (
    <Link className={`brand${light ? " brand-light" : ""}`} href="/#accueil" aria-label="Espace Shopping Plus, accueil">
      <Image
        className={`brand-symbol${alternate ? " brand-symbol-alternate" : ""}`}
        src={alternate ? "/espace-shopping-plus/logo-alternatif.png" : "/espace-shopping-plus/logo-principal.png"}
        width={248}
        height={246}
        alt=""
      />
    </Link>
  );
}

type IconName = "bag" | "search" | "heart" | "arrow" | "truck" | "lock" | "instagram" | "facebook" | "tiktok" | "user" | "shield" | "medal" | "headphones";

const iconPaths: Record<IconName, ReactNode> = {
  bag: <><path d="M5 8h14l-1 13H6L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></>,
  search: <><circle cx="10.5" cy="10.5" r="6.2"/><path d="m15.2 15.2 5 5"/></>,
  heart: <path d="M20.5 8.7c0 4.3-8.5 9.1-8.5 9.1S3.5 13 3.5 8.7a4.1 4.1 0 0 1 8.5-1 4.1 4.1 0 0 1 8.5 1Z"/>,
  arrow: <><path d="M4 12h15M13 5l7 7-7 7"/></>,
  truck: <><path d="M2 6h12v12H2zM14 10h5l3 3v5h-8z"/><circle cx="6.5" cy="19" r="1.5"/><circle cx="18.5" cy="19" r="1.5"/></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v3"/></>,
  instagram: <><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/></>,
  facebook: <path d="M14 21v-8h3l.5-4H14V7c0-1.2.4-2 2-2h2V1.4C17.3 1.2 16.3 1 15 1c-3.2 0-5 1.9-5 5.3V9H7v4h3v8z"/>,
  tiktok: <path d="M14 3v11.2a4 4 0 1 1-3.5-4V6.7a8 8 0 1 0 7.5 7.5V8.7c1.3 1 2.8 1.6 4.5 1.7V6.8c-3.2-.2-5.7-1.7-6.8-3.8H14Z"/>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
  medal: <><circle cx="12" cy="8" r="6"/><path d="m8.5 13-2 9 5.5-3 5.5 3-2-9"/><path d="m9.5 8 1.7 1.7L15 6"/></>,
  headphones: <><path d="M3 13v-2a9 9 0 0 1 18 0v2"/><rect x="2" y="12" width="5" height="9" rx="2"/><rect x="17" y="12" width="5" height="9" rx="2"/></>,
};

export function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  return <svg className={`icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name]}</svg>;
}
