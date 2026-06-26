"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  BriefcaseBusiness,
  Building2,
  ChevronRight,
  Cpu,
  ExternalLink,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  MessagesSquare,
  Settings2,
  Sparkles,
  Users,
  Waypoints,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getSessionClient } from "@/lib/auth/session-client";

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavGroup = { title: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Organisation",
    items: [
      { href: "/profile", label: "Vue générale", icon: LayoutDashboard },
      { href: "/profile/agents", label: "Mes employés", icon: BriefcaseBusiness },
      { href: "/profile/onboarding", label: "Empreinte Entreprise", icon: Building2 },
    ],
  },
  {
    title: "Opérations",
    items: [
      { href: "/agents/pierre/use", label: "Cockpit Pierre", icon: Waypoints },
      { href: "/profile/messages", label: "Messagerie", icon: MessagesSquare },
      { href: "/agents/pierre/employees", label: "Employé 360", icon: Users },
      { href: "/assistant", label: "CloneChat", icon: Bot },
    ],
  },
  {
    title: "Configuration",
    items: [
      { href: "/agents/pierre/setup", label: "Configuration Pierre", icon: Settings2 },
      { href: "/profile/technologies", label: "Technologies", icon: Cpu },
    ],
  },
  {
    title: "Compte",
    items: [
      { href: "/agents", label: "Boutique", icon: Sparkles },
      { href: "/questions", label: "Support", icon: LifeBuoy },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/profile") return pathname === "/profile";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() || "/profile";

  return (
    <nav className="flex flex-col gap-5" aria-label="Navigation de l'espace connecté">
      {NAV_GROUPS.map((group) => (
        <div key={group.title} className="space-y-1.5">
          <p className="px-3 text-[0.66rem] font-bold uppercase tracking-[0.18em] text-[var(--cs-ink-4)]">
            {group.title}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all",
                    active
                      ? "bg-[rgba(111,99,246,0.12)] text-[var(--cs-violet)] shadow-[inset_0_0_0_1px_rgba(111,99,246,0.16)]"
                      : "text-[var(--cs-ink-3)] hover:bg-white/60 hover:text-[var(--cs-ink-1)]",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {active ? <ChevronRight className="h-3.5 w-3.5 shrink-0" /> : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function SidebarHeader() {
  return (
    <Link
      href="/profile"
      className="flex items-center gap-2 px-2 py-1"
      aria-label="Mon CloneStore"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--cs-line)] bg-white/55 shadow-[var(--cs-shadow-soft)]">
        <svg viewBox="0 0 24 56" className="h-[26px] w-[11px]" fill="none" aria-hidden="true">
          <rect x="3" y="3" width="18" height="50" rx="9" stroke="url(#appShellMark)" strokeWidth="3.5" />
          <defs>
            <linearGradient id="appShellMark" x1="3" y1="3" x2="21" y2="53">
              <stop stopColor="#7E97FF" />
              <stop offset="1" stopColor="#8E7AFF" />
            </linearGradient>
          </defs>
        </svg>
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-semibold tracking-[-0.02em] text-[var(--cs-ink-1)]">
          Mon CloneStore
        </span>
        <span className="text-[0.66rem] text-[var(--cs-ink-4)]">Espace connecté</span>
      </span>
    </Link>
  );
}

function SidebarFooter() {
  async function signOut() {
    try {
      const client = getSessionClient();
      await client?.auth.signOut();
    } catch {
      // ignore
    } finally {
      window.location.href = "/";
    }
  }

  return (
    <div className="mt-4 space-y-1 border-t border-[var(--cs-line-soft)] pt-3">
      <Link
        href="/"
        className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-[var(--cs-ink-3)] transition-all hover:bg-white/60 hover:text-[var(--cs-ink-1)]"
      >
        <ExternalLink className="h-4 w-4 shrink-0" />
        <span>Retour au site</span>
      </Link>
      <button
        type="button"
        onClick={signOut}
        className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-medium text-[var(--cs-ink-3)] transition-all hover:bg-white/60 hover:text-[var(--cs-ink-1)]"
      >
        <LogOut className="h-4 w-4 shrink-0" />
        <span>Se déconnecter</span>
      </button>
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => setMounted(true), []);

  // Fermeture du drawer à chaque changement de route.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Échap + verrouillage du scroll arrière-plan + focus sur le bouton fermer.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [drawerOpen]);

  return (
    <div className="cs-app">
      {/* Barre mobile (déclencheur du drawer) */}
      <div className="cs-app-mobilebar lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--cs-line)] bg-white/55 text-[var(--cs-ink-1)] shadow-[var(--cs-shadow-soft)] backdrop-blur-xl"
          aria-label="Ouvrir le menu"
          aria-expanded={drawerOpen}
          aria-controls="app-drawer"
        >
          <Menu className="h-5 w-5" />
        </button>
        <SidebarHeader />
      </div>

      <div className="cs-app-grid">
        {/* Sidebar desktop permanente (sticky, hauteur viewport, scroll interne) */}
        <aside className="cs-app-sidebar hidden lg:block">
          <div className="cs-app-sidebar-inner">
            <SidebarHeader />
            <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
              <NavLinks />
            </div>
            <SidebarFooter />
          </div>
        </aside>

        <div className="cs-app-main min-w-0">{children}</div>
      </div>

      {/* Drawer mobile — porté sur document.body pour échapper au contexte
          d'empilement de .cs-main (z-index:2) et passer au-dessus du header. */}
      {mounted && drawerOpen
        ? createPortal(
            <div
              className="cs-app-drawer-root lg:hidden"
              role="dialog"
              aria-modal="true"
              id="app-drawer"
            >
              <button
                type="button"
                aria-label="Fermer le menu"
                className="cs-app-drawer-overlay"
                onClick={() => setDrawerOpen(false)}
              />
              <div className="cs-app-drawer-panel">
                <div className="flex items-center justify-between gap-2 pb-4">
                  <SidebarHeader />
                  <button
                    ref={closeBtnRef}
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--cs-line)] bg-white/55 text-[var(--cs-ink-1)] shadow-[var(--cs-shadow-soft)]"
                    aria-label="Fermer le menu"
                  >
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <NavLinks onNavigate={() => setDrawerOpen(false)} />
                  <SidebarFooter />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
