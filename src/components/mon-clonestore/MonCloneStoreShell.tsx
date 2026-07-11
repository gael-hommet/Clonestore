// src/components/mon-clonestore/MonCloneStoreShell.tsx
// P12 §9 — « Mon CloneStore » : centre de CONTRÔLE / compte / admin. Distinct du Cockpit (gérer,
// pas travailler). Layout calme et structuré (peut défiler), avec un accès clair au Cockpit. Chaque
// section pointe vers la fonctionnalité existante (compte/entreprise/abonnement/employés/empreinte…).

import Link from "next/link";
import {
  Building2, CreditCard, Globe2, Bot, Users, Fingerprint, ShieldCheck, Settings2, LifeBuoy,
  LayoutGrid, ArrowRight, Receipt,
} from "lucide-react";
import { CLONEOS_ROUTES } from "@/lib/clonestore/cloneos/cloneos-app-shell-contract";

interface AdminSection { key: string; label: string; desc: string; href: string; icon: typeof Building2 }

const SECTIONS: readonly AdminSection[] = [
  { key: "company", label: "Entreprise", desc: "Profil, pays d'immatriculation, identité légale.", href: "/profile", icon: Building2 },
  { key: "subscription", label: "Abonnement", desc: "Votre offre CloneStore et son statut.", href: "/mon-clonestore/facturation", icon: Receipt },
  { key: "billing", label: "Facturation", desc: "Paiements, factures, moyen de paiement (Stripe).", href: "/mon-clonestore/facturation", icon: CreditCard },
  { key: "pricing", label: "Pays & tarif", desc: "FR/BE/LU 449 € · CH 499 CHF — pays de facturation.", href: CLONEOS_ROUTES.purchase, icon: Globe2 },
  { key: "employees", label: "Employés IA achetés", desc: "Pierre et vos futurs employés IA, accès.", href: "/profile/agents", icon: Bot },
  { key: "users", label: "Utilisateurs & permissions", desc: "Membres de l'entreprise et rôles.", href: "/profile", icon: Users },
  { key: "footprint", label: "Empreinte Entreprise", desc: "Contexte, documents et sources de l'entreprise.", href: "/profile/technologies", icon: Fingerprint },
  { key: "security", label: "Sécurité", desc: "Accès, session, protection du compte.", href: "/profile", icon: ShieldCheck },
  { key: "settings", label: "Réglages", desc: "Préférences globales du CloneStore.", href: "/profile", icon: Settings2 },
  { key: "support", label: "Support", desc: "Aide, messages et suivi.", href: "/profile/messages", icon: LifeBuoy },
];

export function MonCloneStoreShell({ setup = false }: { setup?: boolean }) {
  return (
    <main className="cs-page" data-testid="mon-clonestore-shell">
      <div className="cs-page-shell space-y-6 py-6">
        {/* Header distinct du cockpit (calme, admin) */}
        <header className="cs-panel flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--cs-line-soft)] bg-white/58 text-[var(--cs-ink-2)]"><Building2 className="h-5 w-5" /></span>
            <div>
              <h1 className="text-[1.3rem] font-semibold tracking-[-0.03em] text-[var(--cs-ink-1)]">Mon CloneStore</h1>
              <p className="text-[0.84rem] text-[var(--cs-ink-3)]">Gérez votre compte, votre entreprise et vos employés IA. Le travail se fait dans le Cockpit.</p>
            </div>
          </div>
          <Link href={CLONEOS_ROUTES.cockpit} className="cs-liquid-button cs-liquid-button--primary" data-testid="mon-clonestore-open-cockpit">
            <LayoutGrid className="h-4 w-4" /> Ouvrir le Cockpit
          </Link>
        </header>

        {setup ? (
          <section className="cs-panel p-5" data-testid="mon-clonestore-setup">
            <p className="cs-eyebrow mb-1">Mise en route</p>
            <h2 className="text-[1.05rem] font-semibold text-[var(--cs-ink-1)]">Finalisez la configuration de votre CloneStore</h2>
            <p className="mt-1 text-[0.86rem] leading-6 text-[var(--cs-ink-3)]">Complétez l'empreinte de votre entreprise et l'onboarding pour que Pierre puisse opérer.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/profile/onboarding" className="cs-liquid-button cs-liquid-button--primary">Continuer l'onboarding <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/agents/pierre/setup" className="cs-liquid-button">Configurer Pierre</Link>
            </div>
          </section>
        ) : null}

        {/* Grille de sections admin (calme, structurée) */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="mon-clonestore-sections">
          {SECTIONS.map((s) => {
            const I = s.icon;
            return (
              <Link key={s.key} href={s.href} className="cs-card cs-hover-lift flex items-start gap-3 text-left" data-section={s.key}>
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--cs-line-soft)] bg-white/58 text-[var(--cs-ink-2)]"><I className="h-4 w-4" /></span>
                <span className="min-w-0">
                  <span className="block text-[0.94rem] font-semibold text-[var(--cs-ink-1)]">{s.label}</span>
                  <span className="block text-[0.8rem] leading-5 text-[var(--cs-ink-3)]">{s.desc}</span>
                </span>
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  );
}
