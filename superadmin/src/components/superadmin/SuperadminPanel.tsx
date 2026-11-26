"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { productImage } from "@/lib/store-images";
import StoreImage from "@/components/ui/StoreImage";
import { authClient } from "@/lib/auth-client";

type Section = "overview" | "products" | "categories" | "orders" | "payouts" | "customers" | "announcements";
type AnnouncementSettings = {
  id: number;
  message: string;
  enabled: boolean;
  startsAt: string;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
  currentlyActive: boolean;
  isScheduled: boolean;
};
type Product = {
  slug: string; name: string; priceCfa: number; originalPriceCfa: number | null; image: string; images: string[]; category: string; description: string;
  sizes: string[]; colors: string[]; productType: "single_piece" | "set"; stockQuantity: number; isAvailable: boolean; active: boolean;
  isPromo: boolean; sellerName: string;
};
type SellerPayout = {
  id: string;
  orderId: string;
  destination: string | null;
  amountCfa: number | null;
  status: string;
  transactionId: string | null;
  details: string | null;
  createdAt: string;
};
type Category = { name: string; slug: string; image: string; active: boolean; featured: boolean; sortOrder: number };
type OrderItem = { slug: string; name: string; unitPriceCfa: number; quantity: number; lineTotalCfa: number; size?: string; color?: string; image?: string | null };
type Order = {
  id: string; customerName: string; customerEmail: string; phone: string; city: string; deliveryAddress: string;
  deliveryNotes: string; status: string; paymentMethod: string; paymentStatus: string; subtotalCfa: number;
  createdAt: string; items: OrderItem[];
};
type Customer = { id: string; name: string; email: string; createdAt: string };
type Overview = { products: number; categories: number; orders: number; customers: number; pendingOrders: number };

const sections: { id: Section; label: string }[] = [
  { id: "overview", label: "Vue d’ensemble" },
  { id: "products", label: "Produits & stock" },
  { id: "categories", label: "Catégories" },
  { id: "orders", label: "Commandes" },
  { id: "payouts", label: "Versements vendeurs" },
  { id: "customers", label: "Clients" },
  { id: "announcements", label: "Annonces" },
];

const sectionDescriptions: Record<Section, string> = {
  overview: "Suivez les indicateurs importants et accédez rapidement à votre boutique.",
  products: "Gérez votre catalogue, les prix et les quantités disponibles.",
  categories: "Organisez les rayons et choisissez ceux qui apparaissent sur l’accueil.",
  orders: "Consultez les commandes et mettez à jour leur préparation et leur paiement.",
  payouts: "Suivez les décaissements du propriétaire après confirmation du paiement.",
  customers: "Retrouvez les comptes clients inscrits sur la boutique.",
  announcements: "Rédigez une annonce, programmez sa période d’affichage et activez ou désactivez le bandeau.",
};

const orderStatuses = ["pending", "confirmed", "preparing", "shipped", "delivered", "cancelled"];
const paymentStatuses = ["pending", "confirmed", "failed", "refunded"];
const paymentMethods: Record<string, string> = {
  cash_on_delivery: "Paiement à la livraison",
  mtn_money: "MTN Mobile Money",
  orange_money: "Orange Money",
  saspay: "SasPay",
  fapshi: "Fapshi",
};
const statusLabels: Record<string, string> = {
  pending: "À confirmer", confirmed: "Confirmée", preparing: "En préparation",
  shipped: "Expédiée", delivered: "Livrée", cancelled: "Annulée",
};
const paymentLabels: Record<string, string> = {
  pending: "À confirmer", confirmed: "Confirmé", failed: "Échoué", refunded: "Remboursé",
};
const formatPrice = (value: number) => `${new Intl.NumberFormat("fr-FR").format(value)} FCFA`;
const formatDate = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const PAGE_SIZE = 10;

function TablePagination({ page, pageCount, total, onChange }: { page: number; pageCount: number; total: number; onChange: (page: number) => void }) {
  if (pageCount <= 1) return null;
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);
  return <nav className="superadmin-pagination" aria-label="Pagination du tableau"><span>Affichage {first}–{last} sur {total}</span><div><button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>Précédent</button><span className="superadmin-pagination-page">Page {page} sur {pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>Suivant</button></div></nav>;
}

export default function SuperadminPanel({ userName, isSuperadmin, initialOverview, storeUrl }: { userName: string; isSuperadmin: boolean; initialOverview: Overview; storeUrl: string }) {
  const [section, setSection] = useState<Section>("overview");
  const [data, setData] = useState<unknown>(initialOverview);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingAnnouncement, setEditingAnnouncement] = useState<AnnouncementSettings | null>(null);
  const loadSequence = useRef(0);
  const currentSection = useRef<Section>("overview");

  function navigate(target: Section) {
    if (target === currentSection.current && data !== null && !error) return;
    currentSection.current = target;
    setSection(target);
    setFeedback("");
    setData(null);
    void load(target);
  }

  async function load(target: Section) {
    const sequence = ++loadSequence.current;
    setLoading(true);
    setError("");
    setData(null);
    try {
      const response = await fetch(`/api/superadmin?section=${target}`, { cache: "no-store" });
      if (response.status === 401) { router.replace("/connexion"); return false; }
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof result === "object" && result !== null && "error" in result ? String(result.error) : "Impossible de charger cette section.");
      if (target === "announcements"
        ? !Array.isArray(result) || !result.every(isAnnouncementSettings)
        : target === "overview"
          ? (typeof result !== "object" || result === null)
          : !Array.isArray(result)) {
        throw new Error("Les données reçues sont invalides. Actualisez la page.");
      }
      let nextCategories: Category[] | null = null;
      if (target === "categories" || target === "products") {
        const categoryResponse = await fetch("/api/superadmin?section=categories", { cache: "no-store" });
        if (!categoryResponse.ok) {
          const categoryError: unknown = await categoryResponse.json().catch(() => null);
          throw new Error(typeof categoryError === "object" && categoryError !== null && "error" in categoryError ? String(categoryError.error) : "Impossible de charger les catégories.");
        }
        nextCategories = await categoryResponse.json() as Category[];
      }
      if (sequence !== loadSequence.current) return false;
      setData(result);
      if (nextCategories) {
        setCategories(nextCategories);
      }
      return target === currentSection.current;
    } catch (reason) {
      if (sequence === loadSequence.current) {
        setData(null);
        setError(reason instanceof Error ? reason.message : "Le panneau ne répond pas. Réessayez.");
      }
      return false;
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }

  async function mutate(url: string, method: "POST" | "PATCH" | "DELETE", successMessage: string, body?: Record<string, unknown>) {
    if (busy) return false;
    setBusy(true);
    setFeedback("");
    setError("");
    try {
      const response = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (response.status === 401) { router.replace("/connexion"); return false; }
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof result === "object" && result !== null && "error" in result ? String(result.error) : "L’opération a échoué.");
      setFeedback(successMessage);
      await load(currentSection.current);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "L’opération a échoué. Réessayez.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function submitProduct(event: FormEvent<HTMLFormElement>, onSuccess: () => void) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      slug: String(form.get("slug") ?? ""),
      name: String(form.get("name") ?? ""),
      priceCfa: Number(form.get("priceCfa")),
      originalPriceCfa: form.get("originalPriceCfa") ? Number(form.get("originalPriceCfa")) : null,
      image: String(form.get("image") ?? ""),
      images: form.getAll("images").map(String),
      category: String(form.get("category") ?? ""),
      description: String(form.get("description") ?? ""),
      sizes: String(form.get("sizes") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
      colors: String(form.get("colors") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
      productType: String(form.get("productType") ?? "single_piece"),
      stockQuantity: Number(form.get("stockQuantity")),
      isAvailable: form.get("isAvailable") === "on",
      isPromo: form.get("isPromo") === "on",
      sellerName: String(form.get("sellerName") ?? "Espace Shopping Plus"),
    };
    void mutate("/api/superadmin", editingProduct ? "PATCH" : "POST", editingProduct ? "Produit mis à jour." : "Produit ajouté.", { entity: "product", ...payload }).then((success) => {
      if (success) { setEditingProduct(null); onSuccess(); }
    });
  }

  return (
    <main className="superadmin-shell">
      <aside className="superadmin-sidebar">
        <Link className="superadmin-brand" href={storeUrl}>
          <span className="superadmin-brand-logo"><Image src="/brand-logo.png" alt="" width={58} height={58} unoptimized /></span>
          <span className="superadmin-brand-copy">ESPACE<strong>SHOPPING PLUS</strong><small>ESPACE DE GESTION</small></span>
        </Link>
        <nav aria-label="Administration">
          {sections.map((item) => (
            <button type="button" className={section === item.id ? "active" : ""} aria-current={section === item.id ? "page" : undefined} onClick={() => navigate(item.id)} key={item.id}>
              <span className="superadmin-nav-index" aria-hidden="true">{String(sections.indexOf(item) + 1).padStart(2, "0")}</span>
              <span>{item.label}</span>
              {section === item.id && <span className="superadmin-nav-arrow" aria-hidden="true">↗</span>}
            </button>
          ))}
        </nav>
        <div className="superadmin-sidebar-footer">
          <span className="superadmin-user"><span className="superadmin-avatar" aria-hidden="true">{userName.trim().slice(0, 1).toUpperCase()}</span><span>{userName}<small>{isSuperadmin ? "Superadministrateur" : "Administrateur"}</small></span></span>
          <Link href={storeUrl}>Voir la boutique ↗</Link>
          <button type="button" className="superadmin-signout" disabled={signingOut} onClick={async () => {
            setSigningOut(true);
            try { await authClient.signOut(); } finally { router.replace("/connexion"); }
          }}>{signingOut ? "Déconnexion…" : "Se déconnecter"}</button>
        </div>
      </aside>

      <section className="superadmin-main">
        <header className="superadmin-header">
          <div><p className="eyebrow">ESPACE SHOPPING PLUS <span aria-hidden="true">/</span> ADMINISTRATION</p><h1>{sections.find((item) => item.id === section)?.label}</h1><p className="superadmin-header-description">{sectionDescriptions[section]}</p></div>
          <div className="superadmin-header-actions">
            <button className="superadmin-secondary" type="button" onClick={() => void load(section)} disabled={loading || busy}>Actualiser</button>
            <Link className="superadmin-store-link" href={storeUrl}>Voir la boutique <span aria-hidden="true">↗</span></Link>
          </div>
        </header>
        {feedback && <p className="superadmin-feedback" role="status">{feedback}</p>}
        {loading ? <p className="superadmin-loading" role="status">Chargement…</p> : error ? <div className="superadmin-load-error"><p className="superadmin-error" role="alert">{error}</p><button className="superadmin-secondary" type="button" onClick={() => void load(section)}>Réessayer</button></div> : <>
          {section === "overview" && <OverviewSection data={data as Overview | null} userName={userName} busy={busy} onNavigate={navigate} />}
          {section === "products" && <ProductsSection products={data as Product[]} categories={categories} busy={busy} editing={editingProduct} setEditing={setEditingProduct} onSubmit={submitProduct} onArchive={(slug) => void mutate(`/api/superadmin?entity=product&slug=${encodeURIComponent(slug)}`, "DELETE", "Produit archivé.")} onRestore={(slug) => void mutate("/api/superadmin", "PATCH", "Produit restauré.", { entity: "product", slug, active: true })} />}
          {section === "categories" && <CategoriesSection categories={data as Category[]} busy={busy} onCreate={(payload) => mutate("/api/superadmin", "POST", "Catégorie ajoutée.", { entity: "category", ...payload })} onToggle={(category) => {
            if (category.active && !window.confirm("Masquer cette catégorie la retirera de la boutique, ainsi que ses produits. Continuer ?")) return;
            void mutate("/api/superadmin", "PATCH", category.active ? "Catégorie masquée." : "Catégorie activée.", { entity: "category", oldSlug: category.slug, active: !category.active, featured: category.featured, sortOrder: category.sortOrder });
          }} onFeature={(category) => void mutate("/api/superadmin", "PATCH", category.featured ? "Catégorie retirée de l’accueil." : "Catégorie affichée sur l’accueil.", { entity: "category", oldSlug: category.slug, active: category.active, featured: !category.featured, sortOrder: category.sortOrder })} />}
          {section === "orders" && <OrdersSection orders={data as Order[]} busy={busy} onChange={(order, values) => {
            if (values.status === "cancelled" && !window.confirm("Annuler cette commande ? Le stock des articles sera restitué.")) return;
            const message = values.status ? "Statut de la commande mis à jour." : "Statut du paiement mis à jour.";
            void mutate("/api/superadmin", "PATCH", message, { entity: "order", id: order.id, ...values });
          }} />}
          {section === "payouts" && <PayoutsSection payouts={data as SellerPayout[]} />}
          {section === "customers" && <CustomersSection customers={data as Customer[]} />}
          {section === "announcements" && <AnnouncementSection
            announcements={data as AnnouncementSettings[]}
            busy={busy}
            editing={editingAnnouncement}
            setEditing={setEditingAnnouncement}
            onSave={(payload) => void mutate("/api/superadmin", editingAnnouncement ? "PATCH" : "POST", editingAnnouncement ? "Annonce modifiée." : "Annonce publiée.", { entity: "announcement", ...(editingAnnouncement ? { id: editingAnnouncement.id } : {}), ...payload }).then((success) => { if (success) setEditingAnnouncement(null); })}
            onDelete={(announcement) => {
              if (!window.confirm("Supprimer définitivement cette annonce ?")) return;
              void mutate(`/api/superadmin?entity=announcement&id=${announcement.id}`, "DELETE", "Annonce supprimée.");
              if (editingAnnouncement?.id === announcement.id) setEditingAnnouncement(null);
            }}
          />}
        </>}
      </section>
    </main>
  );
}

function isAnnouncementSettings(value: unknown): value is AnnouncementSettings {
  return typeof value === "object" &&
    value !== null &&
    "id" in value && typeof value.id === "number" &&
    "message" in value && typeof value.message === "string" &&
    "enabled" in value && typeof value.enabled === "boolean" &&
    "startsAt" in value && typeof value.startsAt === "string" &&
    "endsAt" in value && (typeof value.endsAt === "string" || value.endsAt === null) &&
    "createdAt" in value && typeof value.createdAt === "string" &&
    "updatedAt" in value && typeof value.updatedAt === "string" &&
    "currentlyActive" in value && typeof value.currentlyActive === "boolean" &&
    "isScheduled" in value && typeof value.isScheduled === "boolean";
}

function toLocalDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function AnnouncementSection({ announcements, busy, editing, setEditing, onSave, onDelete }: {
  announcements: AnnouncementSettings[];
  busy: boolean;
  editing: AnnouncementSettings | null;
  setEditing: (announcement: AnnouncementSettings | null) => void;
  onSave: (payload: { message: string; enabled: boolean; startsAt: string; endsAt: string | null }) => void;
  onDelete: (announcement: AnnouncementSettings) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const message = String(form.get("message") ?? "").trim();
    const startsAt = String(form.get("startsAt") ?? "");
    const endsAt = String(form.get("endsAt") ?? "");
    const startsAtDate = new Date(startsAt);
    const endsAtDate = endsAt ? new Date(endsAt) : null;
    if (!message || !startsAt || Number.isNaN(startsAtDate.getTime()) ||
        (endsAtDate && (Number.isNaN(endsAtDate.getTime()) || endsAtDate.getTime() <= startsAtDate.getTime()))) {
      setDateError("Vérifiez le texte et les dates. La date de fin doit être postérieure à la date de début.");
      return;
    }
    setDateError("");
    onSave({
      message,
      enabled: form.get("enabled") === "on",
      startsAt: startsAtDate.toISOString(),
      endsAt: endsAtDate ? endsAtDate.toISOString() : null,
    });
  }

  const [dateError, setDateError] = useState("");

  return (
    <section className="superadmin-announcement-panel">
      <div className="superadmin-list-heading">
        <div><p className="superadmin-welcome-kicker">COMMUNICATION DE LA BOUTIQUE</p><h2>Annonces <span>{announcements.length}</span></h2></div>
        <button className="superadmin-primary" type="button" disabled={busy} onClick={() => { setEditing(null); setDateError(""); }}>Nouvelle annonce</button>
      </div>
      <p className="superadmin-announcement-intro">Retrouvez, modifiez ou supprimez vos annonces. Les annonces actives défilent ensemble sur la boutique.</p>
      <div className="superadmin-table-wrap">
        <table className="superadmin-table superadmin-announcements-table">
          <thead><tr><th>Annonce</th><th>Statut</th><th>Début</th><th>Fin</th><th>Actions</th></tr></thead>
          <tbody>
            {announcements.map((announcement) => {
              const status = announcement.currentlyActive ? "En ligne" : !announcement.enabled ? "Désactivée" : announcement.isScheduled ? "Programmée" : "Terminée";
              const statusClass = announcement.currentlyActive ? "is-available" : announcement.enabled && status === "Programmée" ? "" : "is-archived";
              return <tr key={announcement.id}>
                <td><span className="superadmin-announcement-message">{announcement.message}</span><small className="superadmin-table-subline">Modifiée le {formatDate(announcement.updatedAt)}</small></td>
                <td><span className={`superadmin-stock-badge ${statusClass}`}>{status}</span></td>
                <td>{formatDate(announcement.startsAt)}</td>
                <td>{announcement.endsAt ? formatDate(announcement.endsAt) : "Sans date de fin"}</td>
                <td><div className="superadmin-row-actions"><button type="button" disabled={busy} onClick={() => { setEditing(announcement); setDateError(""); }}>Modifier</button><button type="button" disabled={busy} onClick={() => onDelete(announcement)}>Supprimer</button></div></td>
              </tr>;
            })}
            {!announcements.length && <tr><td colSpan={5}><p className="superadmin-empty">Aucune annonce enregistrée. Créez votre première annonce ci-dessous.</p></td></tr>}
          </tbody>
        </table>
      </div>
      <form key={editing?.id ?? "new-announcement"} className="superadmin-form superadmin-announcement-form" onSubmit={submit}>
        <h3>{editing ? "Modifier l’annonce" : "Créer une annonce"}</h3>
        <label>Texte de l’annonce
          <textarea name="message" required maxLength={280} rows={3} defaultValue={editing?.message ?? ""} />
          <span className="superadmin-label-hint">280 caractères maximum.</span>
        </label>
        <div className="superadmin-announcement-dates">
          <label>Début d’affichage<input name="startsAt" type="datetime-local" required defaultValue={toLocalDateTime(editing?.startsAt ?? new Date().toISOString())} /></label>
          <label>Fin d’affichage <span>(facultative)</span><input name="endsAt" type="datetime-local" defaultValue={editing?.endsAt ? toLocalDateTime(editing.endsAt) : ""} /></label>
        </div>
        {dateError && <p className="superadmin-error" role="alert">{dateError}</p>}
        <label className="superadmin-checkbox"><input name="enabled" type="checkbox" defaultChecked={editing?.enabled ?? true} /> Publier pendant la période choisie</label>
        <div className="superadmin-form-actions">
          <button className="superadmin-primary" type="submit" disabled={busy}>{busy ? "Enregistrement…" : editing ? "Enregistrer les modifications" : "Publier l’annonce"}</button>
          {editing && <button className="superadmin-secondary" type="button" disabled={busy} onClick={() => { setEditing(null); setDateError(""); }}>Annuler</button>}
        </div>
      </form>
    </section>
  );
}

function OverviewSection({ data, userName, busy, onNavigate }: { data: Overview | null; userName: string; busy: boolean; onNavigate: (section: Section) => void }) {
  if (!data) return <p className="superadmin-empty">Aucune donnée disponible.</p>;
  const cards: { label: string; value: number; section: Section }[] = [
    { label: "Produits en ligne", value: data.products, section: "products" },
    { label: "Catégories actives", value: data.categories, section: "categories" },
    { label: "Commandes", value: data.orders, section: "orders" },
    { label: "Clients", value: data.customers, section: "customers" },
  ];
  return <>
    <section className="superadmin-welcome">
      <div><p className="superadmin-welcome-kicker">TABLEAU DE BORD</p><h2>Bonjour {userName.split(" ")[0]}, bienvenue dans votre boutique.</h2><p>Voici le résumé de votre activité. Que souhaitez-vous gérer aujourd’hui ?</p><button className="superadmin-primary" type="button" disabled={busy} onClick={() => onNavigate("products")}>{"G\u00e9rer les produits"} <span aria-hidden="true">→</span></button></div>
      <span className="superadmin-welcome-decoration" aria-hidden="true"><Image src="/brand-logo.png" alt="" width={220} height={220} unoptimized /></span>
    </section>
    <div className="superadmin-overview">
      <div className="superadmin-overview-heading"><div><p className="superadmin-welcome-kicker">EN UN COUP D’ŒIL</p><h2>Activité de la boutique</h2></div><span>Résumé actualisé à la demande</span></div>
      <div className="superadmin-stats-grid">
        {cards.map((card, index) => <button className="superadmin-stat" type="button" onClick={() => onNavigate(card.section)} key={card.label}><span className="superadmin-stat-index">0{index + 1}</span><span className="superadmin-stat-label">{card.label}</span><strong>{card.value.toLocaleString("fr-FR")}</strong><small>Consulter <span aria-hidden="true">↗</span></small></button>)}
      </div>
      <button className="superadmin-pending" type="button" onClick={() => onNavigate("orders")}><span className="superadmin-pending-dot" aria-hidden="true" /><span><strong>{data.pendingOrders}</strong><span>commande{data.pendingOrders === 1 ? "" : "s"} à confirmer</span></span><span className="superadmin-pending-action">Voir les commandes <span aria-hidden="true">→</span></span></button>
      <aside className="superadmin-notice"><span className="superadmin-notice-mark" aria-hidden="true">i</span><div><strong>À propos des paiements Mobile Money</strong><p>Les paiements MTN et Orange Money sont confirmés manuellement. Vérifiez la transaction avant de préparer la commande.</p></div></aside>
    </div>
  </>;
}

function FormModal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeButton.current?.focus();
    function handleEscape(event: KeyboardEvent) { if (event.key === "Escape") onClose(); }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);
  return <div className="superadmin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="superadmin-modal" role="dialog" aria-modal="true" aria-labelledby="superadmin-modal-title">
      <header className="superadmin-modal-heading"><div><p className="superadmin-welcome-kicker">ESPACE DE GESTION</p><h2 id="superadmin-modal-title">{title}</h2></div><button ref={closeButton} type="button" className="superadmin-modal-close" onClick={onClose} aria-label="Fermer la fenêtre">×</button></header>
      {children}
    </section>
  </div>;
}

function ProductsSection({ products, categories, busy, editing, setEditing, onSubmit, onArchive, onRestore }: {
  products: Product[]; categories: Category[]; busy: boolean; editing: Product | null;
  setEditing: (product: Product | null) => void; onSubmit: (event: FormEvent<HTMLFormElement>, onSuccess: () => void) => void; onArchive: (slug: string) => void; onRestore: (slug: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [productColors, setProductColors] = useState<string[]>([]);
  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const [imageUploadError, setImageUploadError] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const filteredProducts = products.filter((product) => `${product.name} ${product.category} ${product.slug}`.toLocaleLowerCase("fr").includes(query.trim().toLocaleLowerCase("fr")));
  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleProducts = filteredProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const closeModal = () => { setModalOpen(false); setEditing(null); setImagePaths([]); setImageUploadError(""); setProductColors([]); };

  async function uploadProductImage(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    if (!files.length) return;
    if (imagePaths.length + files.length > 10) {
      setImageUploadError("Un produit peut contenir 10 images au maximum.");
      input.value = "";
      return;
    }
    setImageUploadError("");
    setImageUploading(true);
    const uploaded: string[] = [];
    const failures: string[] = [];
    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/superadmin/upload", { method: "POST", body: formData });
        const result: unknown = await response.json().catch(() => null);
        if (!response.ok) throw new Error(typeof result === "object" && result !== null && "error" in result ? String(result.error) : "L’image n’a pas pu être téléversée.");
        if (typeof result !== "object" || result === null || !("path" in result) || typeof result.path !== "string") throw new Error("Le chemin de l’image reçu est invalide.");
        uploaded.push(result.path);
      } catch (reason) {
        failures.push(reason instanceof Error ? reason.message : "Le téléversement a échoué. Réessayez.");
      }
    }
    if (uploaded.length) setImagePaths((current) => [...current, ...uploaded]);
    if (failures.length) setImageUploadError(failures.join(" "));
    setImageUploading(false);
    input.value = "";
  }

  return <>
    <section className="superadmin-list superadmin-full-list">
      <div className="superadmin-list-heading"><div><p className="superadmin-welcome-kicker">GESTION DU CATALOGUE</p><h2>Vos produits <span>{products.length}</span></h2></div><label className="superadmin-product-search"><span className="visually-hidden">Rechercher un produit</span><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Rechercher un produit…" /></label><button className="superadmin-primary" type="button" onClick={() => { setEditing(null); setImagePaths([]); setImageUploadError(""); setProductColors([]); setModalOpen(true); }}>+ Ajouter un produit</button></div>
      <div className="superadmin-table-wrap"><table className="superadmin-table"><thead><tr><th>Produit</th><th>Catégorie</th><th>Type</th><th>Prix</th><th>Stock</th><th>Actions</th></tr></thead><tbody>
        {visibleProducts.map((product) => <tr key={product.slug}><td><span className="superadmin-table-product"><StoreImage className="superadmin-product-thumb" src={productImage(product.image, 180)} alt="" sizes="48px" /><span><strong>{product.name}</strong>{product.isPromo && <small className="superadmin-promo-badge">En promotion</small>}<small>{product.slug}</small></span></span></td><td>{product.category}</td><td>{product.productType === "set" ? "Ensemble" : "Pièce unique"}</td><td>{formatPrice(product.priceCfa)}</td><td><span className={`superadmin-stock-badge${!product.active ? " is-archived" : product.isAvailable ? " is-available" : " is-unavailable"}`}>{!product.active ? "Archivé" : product.isAvailable ? `${product.stockQuantity} en stock` : "Indisponible"}</span></td><td><div className="superadmin-row-actions"><button type="button" disabled={busy} onClick={() => { setEditing(product); setImagePaths(product.images?.length ? product.images : [product.image]); setImageUploadError(""); setProductColors(product.colors); setModalOpen(true); }}>Modifier</button>{product.active ? <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Archiver « ${product.name} » ? Le produit ne sera plus visible dans la boutique.`)) onArchive(product.slug); }}>Archiver</button> : <button type="button" disabled={busy} onClick={() => onRestore(product.slug)}>Restaurer</button>}</div></td></tr>)}
        {filteredProducts.length === 0 && <tr><td colSpan={6}><p className="superadmin-empty">{products.length ? "Aucun produit ne correspond à cette recherche." : "Aucun produit dans le catalogue pour le moment."}</p></td></tr>}
      </tbody></table></div>
      <TablePagination page={currentPage} pageCount={pageCount} total={filteredProducts.length} onChange={setPage} />
    </section>
    {modalOpen && <FormModal title={editing ? "Modifier le produit" : "Ajouter un produit"} onClose={closeModal}>
      <form className="superadmin-form superadmin-modal-form" key={editing?.slug ?? "new-product"} onSubmit={(event) => onSubmit(event, () => setModalOpen(false))}>
        <input type="hidden" name="image" value={imagePaths[0] ?? ""} />
        {imagePaths.map((image) => <input type="hidden" name="images" value={image} key={image} />)}
        <input type="hidden" name="slug" value={editing?.slug ?? ""} />
        <div className="superadmin-form-grid"><label>Nom<input name="name" required maxLength={140} defaultValue={editing?.name ?? ""} /></label><label>Prix actuel en FCFA<input name="priceCfa" type="number" min="1" max="100000000" required defaultValue={editing?.priceCfa ?? ""} /></label><label>Ancien prix en FCFA<input name="originalPriceCfa" type="number" min="1" max="100000000" defaultValue={editing?.originalPriceCfa ?? ""} /><span className="superadmin-label-hint">À renseigner pour une promotion ; il doit dépasser le prix actuel.</span></label><label>Catégorie<select name="category" required defaultValue={editing?.category ?? categories.find((category) => category.active)?.name ?? ""}>{editing && !categories.some((category) => category.active && category.name === editing.category) && <option value={editing.category} disabled>{editing.category} (masquée)</option>}{categories.filter((category) => category.active).map((category) => <option value={category.name} key={category.slug}>{category.name}</option>)}</select></label>
          <label>Vendeur<input name="sellerName" required maxLength={140} defaultValue={editing?.sellerName ?? "Espace Shopping Plus"} /></label>
          <label className="superadmin-form-wide superadmin-image-upload">Images du produit<input name="imageFile" type="file" accept="image/jpeg,image/png,image/webp" multiple required={!imagePaths.length} onChange={(event) => void uploadProductImage(event)} disabled={imageUploading || imagePaths.length >= 10} /><span className="superadmin-label-hint">JPG, PNG ou WebP · 8 Mo par photo · 10 photos maximum. La première image sera la photo principale.</span>{imageUploading && <span className="superadmin-label-hint">Téléversement des images…</span>}{imagePaths.length > 0 && <span className="superadmin-product-gallery-preview">{imagePaths.map((image, index) => <span className="superadmin-upload-preview" key={image}><StoreImage className="superadmin-product-thumb" src={productImage(image, 240)} alt={`Aperçu ${index + 1} du produit`} sizes="84px" /><span>{index === 0 ? "Principale" : `Photo ${index + 1}`}<button className="superadmin-image-remove" type="button" onClick={() => setImagePaths((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Retirer la photo ${index + 1}`}>Retirer</button></span></span>)}</span>}{imageUploadError && <span className="superadmin-upload-error" role="alert">{imageUploadError}</span>}</label>
          <label className="superadmin-form-wide">Description<textarea name="description" rows={3} required maxLength={3000} defaultValue={editing?.description ?? ""} /></label><label>Type de vêtement<select name="productType" required defaultValue={editing?.productType ?? "single_piece"}><option value="single_piece">Pièce unique</option><option value="set">Ensemble</option></select><span className="superadmin-label-hint">Le choix de couleur est proposé uniquement pour les ensembles avec plusieurs couleurs.</span></label><label>Tailles / formats (facultatif)<input name="sizes" placeholder="Ex. S, M, L" defaultValue={editing?.sizes.join(", ") ?? ""} /></label><ProductColorsField colors={productColors} onChange={setProductColors} /><label>Quantité disponible<input name="stockQuantity" type="number" min="0" max="1000000" required defaultValue={editing?.stockQuantity ?? 0} /></label><label className="superadmin-checkbox"><input name="isAvailable" type="checkbox" defaultChecked={editing?.isAvailable ?? false} /> Marquer comme disponible</label><label className="superadmin-checkbox"><input name="isPromo" type="checkbox" defaultChecked={editing?.isPromo ?? false} /> Mettre ce produit en promotion</label></div>
        <span className="superadmin-label-hint">Un produit disponible doit avoir au moins une unité en stock.</span><div className="superadmin-form-actions"><button className="superadmin-primary" type="submit" disabled={busy || imageUploading || categories.every((category) => !category.active)}>{imageUploading ? "Téléversement des images…" : editing ? "Enregistrer les modifications" : "Ajouter le produit"}</button><button className="superadmin-secondary" type="button" disabled={busy || imageUploading} onClick={closeModal}>Annuler</button></div>
      </form>
    </FormModal>}
  </>;
}

const namedColorValues: Record<string, string> = {
  noir: "#25211f", blanc: "#ffffff", beige: "#d9c5a7", marron: "#75442f", rouge: "#b84036",
  rose: "#d98da2", bleu: "#527da8", vert: "#688264", jaune: "#e0c65c", orange: "#d98240",
  violet: "#8970a2", dore: "#c8a34e", argent: "#aeb2b7", argente: "#aeb2b7",
};

function ProductColorsField({ colors, onChange }: { colors: string[]; onChange: (colors: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const addColor = () => {
    const color = draft.trim().replace(/,$/, "").trim();
    if (color && !colors.some((existing) => existing.toLocaleLowerCase("fr") === color.toLocaleLowerCase("fr"))) {
      onChange([...colors, color]);
    }
    setDraft("");
  };

  return <div className="superadmin-color-field">
    <label htmlFor="superadmin-product-color">Couleurs</label>
    <div className="superadmin-color-entry">
      <input id="superadmin-product-color" type="text" value={draft} maxLength={40} placeholder="Ex. Noir, beige, rouge" onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); addColor(); } }} />
      <button type="button" onClick={addColor} disabled={!draft.trim()}>Ajouter</button>
    </div>
    {colors.length > 0 && <div className="superadmin-color-chips" aria-label="Couleurs sélectionnées">{colors.map((color) => {
      const swatch = namedColorValues[color.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr")];
      return <span className="superadmin-color-chip" key={color}><span className="superadmin-color-swatch" style={{ backgroundColor: swatch ?? "#e6ddd3" }} aria-hidden="true" />{color}<button type="button" aria-label={`Retirer ${color}`} onClick={() => onChange(colors.filter((existing) => existing !== color))}>×</button></span>;
    })}</div>}
    <span className="superadmin-label-hint">Ajoutez chaque couleur séparément, puis retirez-la avec ×.</span>
    <input type="hidden" name="colors" value={colors.join(", ")} />
  </div>;
}

function CategoriesSection({ categories, busy, onCreate, onToggle, onFeature }: {
  categories: Category[]; busy: boolean;
  onCreate: (payload: Record<string, unknown>) => Promise<boolean>;
  onToggle: (category: Category) => void; onFeature: (category: Category) => void;
}) {
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [imagePath, setImagePath] = useState("");
  const [imageUploadError, setImageUploadError] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const pageCount = Math.max(1, Math.ceil(categories.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleCategories = categories.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const success = await onCreate({
      name: String(form.get("name") ?? "").trim(),
      image: imagePath,
      featured: form.get("featured") === "on",
      sortOrder: Number(form.get("sortOrder")),
    });
    if (success) { setModalOpen(false); setImagePath(""); setImageUploadError(""); }
  }
  async function uploadCategoryImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    setImageUploadError("");
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/superadmin/upload", { method: "POST", body: formData });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof result === "object" && result !== null && "error" in result ? String(result.error) : "L’image n’a pas pu être téléversée.");
      if (typeof result !== "object" || result === null || !("path" in result) || typeof result.path !== "string") throw new Error("Le chemin de l’image reçu est invalide.");
      setImagePath(result.path);
    } catch (reason) {
      setImageUploadError(reason instanceof Error ? reason.message : "Le téléversement a échoué. Réessayez.");
    } finally {
      setImageUploading(false);
    }
  }
  const closeModal = () => { setModalOpen(false); setImagePath(""); setImageUploadError(""); };
  return <>
    <section className="superadmin-list superadmin-full-list">
    <div className="superadmin-list-heading"><div><p className="superadmin-welcome-kicker">RAYONS DU CATALOGUE</p><h2>Catégories <span>{categories.length}</span></h2></div><button className="superadmin-primary" type="button" onClick={() => setModalOpen(true)}>+ Ajouter une catégorie</button></div>
      <div className="superadmin-table-wrap"><table className="superadmin-table"><thead><tr><th>Catégorie</th><th>État</th><th>Accueil</th><th>Ordre</th><th>Actions</th></tr></thead><tbody>
        {visibleCategories.map((category) => <tr key={category.slug}><td><span className="superadmin-table-product"><StoreImage className="superadmin-product-thumb" src={productImage(category.image, 180)} alt="" sizes="48px" /><span><strong>{category.name}</strong><small>{category.slug}</small></span></span></td><td><span className={`superadmin-stock-badge${category.active ? " is-available" : " is-archived"}`}>{category.active ? "Active" : "Masquée"}</span></td><td>{category.featured ? "Affichée" : "Non affichée"}</td><td>{category.sortOrder}</td><td><div className="superadmin-row-actions"><button type="button" disabled={busy || !category.active} onClick={() => onFeature(category)}>{category.featured ? "Retirer de l’accueil" : "Afficher"}</button><button type="button" disabled={busy} onClick={() => onToggle(category)}>{category.active ? "Masquer" : "Activer"}</button></div></td></tr>)}
        {!categories.length && <tr><td colSpan={5}><p className="superadmin-empty">Aucune catégorie pour le moment.</p></td></tr>}
      </tbody></table></div><TablePagination page={currentPage} pageCount={pageCount} total={categories.length} onChange={setPage} />
    </section>
    {modalOpen && <FormModal title="Ajouter une catégorie" onClose={closeModal}>
      <form className="superadmin-form superadmin-modal-form" onSubmit={(event) => void submitCategory(event)}>
        <input type="hidden" name="image" value={imagePath} />
        <div className="superadmin-form-grid">
          <label className="superadmin-form-wide">Nom de la catégorie<input name="name" required maxLength={100} placeholder="Ex. Accessoires" /></label>
          <label className="superadmin-form-wide superadmin-image-upload">Image de la catégorie<input name="imageFile" type="file" accept="image/jpeg,image/png,image/webp" required={!imagePath} onChange={(event) => void uploadCategoryImage(event)} disabled={imageUploading} /><span className="superadmin-label-hint">JPG, PNG ou WebP · 8 Mo maximum. L’image est téléversée dès sa sélection.</span>{imagePath && <span className="superadmin-upload-preview"><StoreImage className="superadmin-product-thumb" src={productImage(imagePath, 240)} alt="Aperçu de l’image de la catégorie" sizes="84px" /><span>Image prête à enregistrer</span></span>}{imageUploadError && <span className="superadmin-upload-error" role="alert">{imageUploadError}</span>}</label>
          <label>Ordre d’affichage<input name="sortOrder" type="number" min="0" max="10000" defaultValue={categories.length + 1} /></label>
          <label className="superadmin-checkbox"><input name="featured" type="checkbox" /> Afficher sur l’accueil</label>
        </div>
        <div className="superadmin-form-actions"><button className="superadmin-primary" type="submit" disabled={busy || imageUploading || !imagePath}>{imageUploading ? "Téléversement de l’image…" : "Ajouter la catégorie"}</button><button className="superadmin-secondary" type="button" disabled={busy || imageUploading} onClick={closeModal}>Annuler</button></div>
      </form>
    </FormModal>}
  </>;
}

function OrdersSection({ orders, busy, onChange }: { orders: Order[]; busy: boolean; onChange: (order: Order, values: { status?: string; paymentStatus?: string }) => void }) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleOrders = orders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  return <section className="superadmin-list superadmin-full-list"><div className="superadmin-list-heading"><div><p className="superadmin-welcome-kicker">SUIVI DES VENTES</p><h2>Commandes <span>{orders.length}</span></h2></div><span className="superadmin-list-meta">Les plus récentes en premier</span></div>
    <div className="superadmin-table-wrap"><table className="superadmin-table superadmin-orders-table"><thead><tr><th>Commande</th><th>Produit commandé</th><th>Client</th><th>Total</th><th>Paiement</th><th>Préparation</th></tr></thead><tbody>
      {visibleOrders.map((order) => <tr key={order.id}><td><strong className="superadmin-order-number">#{order.id.slice(0, 8).toUpperCase()}</strong><small className="superadmin-table-subline">{formatDate(order.createdAt)}</small></td><td>{order.items.map((item, index) => <span className="superadmin-order-product" key={`${item.slug}-${index}`}>{item.image ? <StoreImage className="superadmin-product-thumb" src={productImage(item.image, 180)} alt="" sizes="44px" /> : <span className="superadmin-product-thumb" aria-hidden="true" />}<span><strong>{item.name}</strong><small>Qté {item.quantity}{item.size ? ` · Taille ${item.size}` : ""}{item.color ? ` · ${item.color}` : ""} · {formatPrice(item.lineTotalCfa)}</small></span></span>)}</td><td><span className="superadmin-table-primary">{order.customerName}</span><small className="superadmin-table-subline">{order.customerEmail}<br />{order.phone}</small><small className="superadmin-table-subline">{order.city} · {order.deliveryAddress}</small></td><td><strong>{formatPrice(order.subtotalCfa)}</strong></td><td><small className="superadmin-table-subline">{paymentMethods[order.paymentMethod] ?? order.paymentMethod}</small><select className="superadmin-table-select" aria-label={`Paiement ${order.id}`} disabled={busy} value={order.paymentStatus} onChange={(event) => onChange(order, { paymentStatus: event.target.value })}>{paymentStatuses.map((status) => <option value={status} key={status}>{paymentLabels[status]}</option>)}</select></td><td><select className="superadmin-table-select" aria-label={`Statut commande ${order.id}`} disabled={busy || ["delivered", "cancelled"].includes(order.status)} value={order.status} onChange={(event) => onChange(order, { status: event.target.value })}>{[order.status, ...(orderStatuses.filter((status) => {
          const validTransitions: Record<string, string[]> = {
            pending: ["confirmed", "cancelled"],
            confirmed: ["preparing", "cancelled"],
            preparing: ["shipped", "cancelled"],
            shipped: ["delivered"],
            delivered: [],
            cancelled: [],
          };
          return validTransitions[order.status]?.includes(status);
        }))].map((status) => <option value={status} key={status}>{statusLabels[status] ?? status}</option>)}</select></td></tr>)}
      {!orders.length && <tr><td colSpan={6}><p className="superadmin-empty">Aucune commande pour le moment.</p></td></tr>}
    </tbody></table></div><TablePagination page={currentPage} pageCount={pageCount} total={orders.length} onChange={setPage} />
  </section>;
}

function PayoutsSection({ payouts }: { payouts: SellerPayout[] }) {
  const statusLabels: Record<string, string> = {
    disabled: "Désactivé",
    queued: "En attente",
    submitting: "En cours d’envoi",
    submitted: "Envoyé à Fapshi",
    successful: "Réussi",
    failed: "Échoué",
    manual_review: "Vérification manuelle",
  };
  return <section className="superadmin-list superadmin-full-list">
    <div className="superadmin-list-heading"><div><p className="superadmin-welcome-kicker">SUIVI FAPSHI</p><h2>Décaissements propriétaire <span>{payouts.length}</span></h2><p>Les montants sont nets des frais Fapshi. Un statut « Envoyé à Fapshi » n’est pas encore une confirmation de réception.</p></div></div>
    <div className="superadmin-table-wrap"><table className="superadmin-table"><thead><tr><th>Commande</th><th>Bénéficiaire</th><th>Destination Mobile Money</th><th>Montant net</th><th>Date</th><th>État</th></tr></thead><tbody>
      {payouts.map((payout) => <tr key={payout.id}><td>#{payout.orderId.slice(0, 8).toUpperCase()}</td><td>Propriétaire</td><td>{payout.destination ?? "À configurer"}</td><td><strong>{payout.amountCfa === null ? "À vérifier" : formatPrice(payout.amountCfa)}</strong></td><td>{formatDate(payout.createdAt)}</td><td><span className="superadmin-stock-badge">{statusLabels[payout.status] ?? payout.status}</span>{payout.transactionId && <small>{payout.transactionId}</small>}{payout.details && <small>{payout.details}</small>}</td></tr>)}
      {!payouts.length && <tr><td colSpan={6}><p className="superadmin-empty">Aucun décaissement enregistré.</p></td></tr>}
    </tbody></table></div>
  </section>;
}

function CustomersSection({ customers }: { customers: Customer[] }) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(customers.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleCustomers = customers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  return <section className="superadmin-list superadmin-full-list"><div className="superadmin-list-heading"><div><p className="superadmin-welcome-kicker">ESPACE CLIENT</p><h2>Clients <span>{customers.length}</span></h2></div></div><div className="superadmin-table-wrap"><table className="superadmin-table"><thead><tr><th>Nom</th><th>Adresse e-mail</th><th>Inscription</th></tr></thead><tbody>{visibleCustomers.map((customer) => <tr key={customer.id}><td><strong>{customer.name}</strong></td><td>{customer.email}</td><td>{formatDate(customer.createdAt)}</td></tr>)}{!customers.length && <tr><td colSpan={3}><p className="superadmin-empty">Aucun compte client pour le moment.</p></td></tr>}</tbody></table></div><TablePagination page={currentPage} pageCount={pageCount} total={customers.length} onChange={setPage} /></section>;
}
