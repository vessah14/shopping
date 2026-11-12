import type { ReactNode } from "react";
import Link from "next/link";
import { Brand } from "../ui/Brand";

export default function AccountPage({ children }: { children: ReactNode }) {
  return (
    <main className="account-page">
      <section className="account-shell">
        <div className="account-visual">
          <div className="account-brand"><Brand /></div>
          <div className="account-visual-copy">
            <span className="account-visual-kicker">ESPACE SHOPPING PLUS</span>
            <p>Mode.<br />Beauté.<br /><em>Vos envies.</em></p>
            <span className="account-visual-note">Retrouvez votre espace boutique.</span>
          </div>
          <span className="account-visual-edition" aria-hidden="true">ESPACE SHOPPING PLUS · CAMEROUN</span>
          <Link className="account-visual-back" href="/">← Découvrir la boutique</Link>
        </div>
        <div className="account-form-panel">{children}</div>
      </section>
    </main>
  );
}
