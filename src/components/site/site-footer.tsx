"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isCockpitSurfaceRoute } from "@/lib/clonestore/cloneos/cloneos-app-shell-contract";

// Footer public du site. Comme SiteHeader, il se masque sur les surfaces console CloneOS
// (cos-root, invariant « pas de scroll de page ») : sur /cockpit, /cockpit/pierre*, /cockpit/room
// il chevaucherait la zone de travail et intercepterait les interactions. Partout ailleurs
// (site public, /mon-clonestore, /profile, /agents/*, /assistant…) il reste strictement inchangé. (P12)
export default function SiteFooter() {
  const pathname = usePathname() || "/";
  if (isCockpitSurfaceRoute(pathname)) return null;

  return (
    <footer className="cs-footer">
      <div className="cs-shell">
        <div className="flex flex-col gap-3 py-6 text-sm text-[var(--cs-ink-3)] md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="cs-mark" aria-hidden="true">
              <svg viewBox="0 0 24 56" className="h-[38px] w-[16px]" fill="none">
                <rect
                  x="3"
                  y="3"
                  width="18"
                  height="50"
                  rx="9"
                  stroke="url(#footerMarkGradient)"
                  strokeWidth="3.5"
                />
                <defs>
                  <linearGradient
                    id="footerMarkGradient"
                    x1="3"
                    y1="3"
                    x2="21"
                    y2="53"
                  >
                    <stop stopColor="#7E97FF" />
                    <stop offset="1" stopColor="#8E7AFF" />
                  </linearGradient>
                </defs>
              </svg>
            </span>

            <p>
              © {new Date().getFullYear()} CloneStore — gagnez du temps et de
              l&apos;argent.
            </p>
          </div>

          <div className="flex items-center gap-5">
            <Link
              href="/legal/confidentialite"
              className="hover:text-[var(--cs-ink-1)]"
            >
              Confidentialité
            </Link>
            <Link href="/questions" className="hover:text-[var(--cs-ink-1)]">
              Support
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
