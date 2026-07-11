"use client";

// src/components/cloneos/CloneOsAppShell.tsx
// P12 §12A — Coquille console CloneOS RÉUTILISABLE. Invariant « pas de scroll de page » :
// racine .cos-root en 100dvh, seuls les panneaux internes défilent. Trois panneaux desktop
// (rail | zone de travail | contexte) → rail en icônes + tiroir contexte sur tablette → bottom
// nav + une surface + bottom-sheet contexte sur mobile. Styled avec les tokens cs-* existants.
// CloneOS = coquille/routeur/coordination — n'exécute JAMAIS la logique RH (c'est Pierre).

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid, MessagesSquare, Bot, ClipboardList, ShieldCheck, FileText, Users, Building2,
  PanelRight, Command, CircleUser, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { COCKPIT_RAIL_NAV, COCKPIT_BOTTOM_NAV, type CloneOsNavItem } from "./cloneos-nav";
import { CLONEOS_ROUTES } from "@/lib/clonestore/cloneos/cloneos-app-shell-contract";

const ICONS: Record<string, typeof LayoutGrid> = {
  LayoutGrid, MessagesSquare, Bot, ClipboardList, ShieldCheck, FileText, Users, Building2,
};
function Icon({ name, className }: { name: string; className?: string }) {
  const C = ICONS[name] ?? LayoutGrid;
  return <C className={className} aria-hidden="true" />;
}

function isActive(pathname: string, item: CloneOsNavItem): boolean {
  if (item.href === CLONEOS_ROUTES.cockpit) return pathname === "/cockpit";
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

export interface CloneOsAppShellProps {
  /** Libellé humain de l'entreprise (contexte), ou null. */
  readonly companyLabel?: string | null;
  /** Contenu de la zone de travail centrale (le composant décide de son scroll interne). */
  readonly main: ReactNode;
  /** Contenu du panneau de contexte droit (validations/mission/preuves/activité). */
  readonly context?: ReactNode;
  /** Titre du panneau de contexte. */
  readonly contextTitle?: string;
  /** data-testid racine (pour les preuves). */
  readonly surfaceTestId?: string;
}

/**
 * Console CloneOS. Ne défile pas en page (cos-root). Le rail navigue entre les surfaces cockpit ;
 * le panneau de contexte est inline en desktop et en tiroir/bottom-sheet en dessous de 1280px.
 */
export function CloneOsAppShell({ companyLabel, main, context, contextTitle = "Contexte", surfaceTestId }: CloneOsAppShellProps) {
  const pathname = usePathname() ?? "/cockpit";
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Garde client de readiness (routage fin fiable) : un utilisateur connecté MAIS non-client → achat ;
  // onboarding incomplet → setup. Le gate CONNECTÉ est déjà assuré par le middleware. Best-effort.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/cloneos/landing", { headers: { accept: "application/json" }, cache: "no-store" });
        const t = (await res.json()) as { kind?: string; route?: string };
        if (alive && t?.route && t.kind && t.kind !== "cockpit") router.replace(t.route);
      } catch { /* best-effort ; le middleware couvre le cas non connecté */ }
    })();
    return () => { alive = false; };
  }, [router]);

  return (
    <div className="cos-root" data-cloneos-shell="true" data-testid={surfaceTestId ?? "cloneos-shell"}>
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="cos-topbar" data-testid="cos-topbar">
        <Link href={CLONEOS_ROUTES.cockpit} className="flex items-center gap-2 shrink-0" aria-label="CloneOS — Global Cockpit">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--cs-violet)]/12 text-[var(--cs-violet)]">
            <Command className="h-4 w-4" />
          </span>
          <span className="text-[0.95rem] font-semibold tracking-[-0.02em] text-[var(--cs-ink-1)]">CloneOS</span>
        </Link>
        {companyLabel ? (
          <span className="hidden sm:inline text-[0.8rem] text-[var(--cs-ink-3)] truncate">· {companyLabel}</span>
        ) : null}

        {/* Quick command hint (recherche / commande rapide) */}
        <button
          type="button"
          data-testid="cos-quick-command"
          className="ml-auto hidden items-center gap-2 rounded-full border border-[var(--cs-line-soft)] bg-white/50 px-3 py-1.5 text-[0.78rem] text-[var(--cs-ink-3)] md:inline-flex"
        >
          <Command className="h-3.5 w-3.5" /> Commande rapide
        </button>

        {/* Context drawer toggle (visible < xl où le panneau contexte n'est pas inline) */}
        {context ? (
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Ouvrir le contexte"
            data-testid="cos-context-toggle"
            className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--cs-line-soft)] bg-white/50 text-[var(--cs-ink-2)] xl:hidden"
          >
            <PanelRight className="h-4 w-4" />
          </button>
        ) : null}

        <Link href={CLONEOS_ROUTES.monClonestore} aria-label="Mon CloneStore" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--cs-line-soft)] bg-white/50 text-[var(--cs-ink-2)]">
          <CircleUser className="h-4 w-4" />
        </Link>
      </header>

      {/* ── Body : rail | main | context ────────────────────────────────────── */}
      <div className="cos-body">
        <nav className="cos-rail" aria-label="Navigation CloneOS" data-testid="cos-rail">
          {COCKPIT_RAIL_NAV.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              data-tour-id={item.tourId}
              data-active={isActive(pathname, item)}
              aria-current={isActive(pathname, item) ? "page" : undefined}
              className="cos-nav"
            >
              <Icon name={item.icon} className="h-4 w-4 shrink-0" />
              <span className="cos-nav-label">{item.label}</span>
            </Link>
          ))}
          <Link href={CLONEOS_ROUTES.monClonestore} data-active={pathname.startsWith("/mon-clonestore")} className="cos-nav mt-auto">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="cos-nav-label">Mon CloneStore</span>
          </Link>
        </nav>

        <main className="cos-main" data-testid="cos-main">{main}</main>

        {context ? (
          <aside className="cos-context" aria-label={contextTitle} data-testid="cos-context">
            <p className="cs-eyebrow mb-2">{contextTitle}</p>
            {context}
          </aside>
        ) : null}
      </div>

      {/* ── Bottom nav (mobile) ─────────────────────────────────────────────── */}
      <nav className="cos-bottomnav" aria-label="Navigation mobile" data-testid="cos-bottomnav">
        {COCKPIT_BOTTOM_NAV.map((item) => (
          <Link key={item.key} href={item.href} data-active={isActive(pathname, item)} className="cos-bottomnav-item">
            <Icon name={item.icon} className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* ── Context drawer (tablette/mobile) ────────────────────────────────── */}
      {context && drawerOpen ? (
        <>
          <div className="cos-drawer-backdrop" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <aside className="cos-drawer" role="dialog" aria-label={contextTitle} data-testid="cos-context-drawer">
            <div className="flex items-center justify-between border-b border-[var(--cs-line-soft)] px-4 py-3">
              <p className="cs-eyebrow">{contextTitle}</p>
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Fermer" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--cs-ink-3)]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4">{context}</div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
