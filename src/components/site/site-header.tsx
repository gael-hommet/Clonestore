"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import TopbarAuthSlot from "./topbar-auth-slot";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { isConnectedRoute } from "@/lib/nav/connected-routes";

const navItems = [
  { href: "/", label: "Accueil" },
  { href: "/agents", label: "Employés IA" },
  { href: "/demo", label: "Démo" },
  { href: "/#technologies", label: "Technologies" },
  { href: "/profile/agents", label: "Cockpit" },
  { href: "/profile", label: "Mon CloneStore" },
  { href: "/questions", label: "Support" },
];

function Brand() {
  return (
    <Link href="/" className="cs-mark-wrap shrink-0" aria-label="Accueil CloneStore">
      <span className="cs-mark" aria-hidden="true">
        <svg viewBox="0 0 24 56" className="h-[54px] w-[22px]" fill="none">
          <rect
            x="3"
            y="3"
            width="18"
            height="50"
            rx="9"
            stroke="url(#markGradientHeader)"
            strokeWidth="3.5"
          />
          <defs>
            <linearGradient id="markGradientHeader" x1="3" y1="3" x2="21" y2="53">
              <stop stopColor="#7E97FF" />
              <stop offset="1" stopColor="#8E7AFF" />
            </linearGradient>
          </defs>
        </svg>
      </span>

      <span className="flex flex-col leading-none">
        <span className="cs-brand-text">CloneStore</span>
        <span className="mt-1 hidden text-[0.58rem] font-semibold uppercase tracking-[0.22em] text-[var(--cs-ink-4)] sm:block">
          OS d’employés IA
        </span>
      </span>
    </Link>
  );
}

export default function SiteHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentPath = useMemo(() => pathname || "/", [pathname]);

  // Sur l'espace connecté, l'app shell est la seule navigation : le header public
  // se masque entièrement (un seul drawer, un seul menu, pas de double navigation).
  if (isConnectedRoute(currentPath)) {
    return null;
  }
  // Démonstration immersive : /demo apporte sa propre coque minimale (DemoShellHeader). Le header
  // global complet (7 destinations + CloneChat) parasiterait l'expérience — il disparaît ici.
  if (currentPath === "/demo") {
    return null;
  }

  return (
    <header className="cs-header">
      <div className="cs-shell">
        <LiquidGlass
          variant="nav"
          intensity="medium"
          refractive
          className="px-4 py-3"
        >
          <div className="flex min-w-0 items-center justify-between gap-3">
            <Brand />

            <nav className="hidden min-w-0 flex-1 items-center justify-center xl:flex">
              <div className="cs-nav-rail">
                {navItems.map((item) => {
                  const isHashLink = item.href.includes("#");
                  const active =
                    !isHashLink &&
                    (item.href === "/"
                      ? currentPath === "/"
                      : currentPath === item.href ||
                        currentPath.startsWith(`${item.href}/`));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn("cs-nav-link", active && "cs-nav-link--active")}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </nav>

            <div className="hidden shrink-0 items-center gap-2 xl:flex">
              <Link
                href="/reserver/pierre"
                className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full border border-[rgba(107,99,232,0.32)] bg-[rgba(107,99,232,0.06)] px-4 text-sm font-semibold text-[#4f48b8] transition hover:bg-[rgba(107,99,232,0.12)]"
              >
                Réserver Pierre
              </Link>
              <Link href="/assistant" className="clone-liquid-button min-h-11 px-5">
                CloneChat
              </Link>

              <TopbarAuthSlot variant="desktop" />
            </div>

            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/50 bg-white/45 text-[var(--cs-ink-1)] shadow-[var(--cs-shadow-soft)] backdrop-blur-xl xl:hidden"
              aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={mobileOpen}
              aria-controls="site-mobile-menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          <div
            id="site-mobile-menu"
            className={cn(
              "overflow-hidden transition-all duration-[var(--cs-speed-slow)] ease-[var(--cs-ease-premium)] xl:hidden",
              mobileOpen ? "max-h-[80vh] pt-4 opacity-100" : "max-h-0 pt-0 opacity-0"
            )}
          >
            <div className="grid gap-4">
              <div className="grid gap-2">
                {navItems.map((item) => {
                  const isHashLink = item.href.includes("#");
                  const active =
                    !isHashLink &&
                    (item.href === "/"
                      ? currentPath === "/"
                      : currentPath === item.href ||
                        currentPath.startsWith(`${item.href}/`));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center justify-between rounded-[1.1rem] border px-4 py-3 text-sm font-semibold transition backdrop-blur-xl",
                        active
                          ? "border-white/60 bg-white/58 text-[var(--cs-ink-1)]"
                          : "border-white/42 bg-white/34 text-[var(--cs-ink-2)]"
                      )}
                    >
                      <span>{item.label}</span>
                      <span className="text-[var(--cs-ink-4)]">→</span>
                    </Link>
                  );
                })}

                <Link
                  href="/reserver/pierre"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-between rounded-[1.1rem] border border-[rgba(107,99,232,0.3)] bg-[rgba(107,99,232,0.08)] px-4 py-3 text-sm font-semibold text-[#4f48b8]"
                >
                  <span>Réserver Pierre</span>
                  <span>→</span>
                </Link>

                <Link
                  href="/assistant"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-between rounded-[1.1rem] border border-white/42 bg-white/34 px-4 py-3 text-sm font-semibold text-[var(--cs-ink-2)] backdrop-blur-xl"
                >
                  <span>CloneChat</span>
                  <span className="text-[var(--cs-ink-4)]">→</span>
                </Link>
              </div>

              <TopbarAuthSlot variant="mobile" />
            </div>
          </div>
        </LiquidGlass>
      </div>
    </header>
  );
}