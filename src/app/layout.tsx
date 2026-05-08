import "./globals.css";
import "@/styles/liquid-glass.css";

import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "../components/site/site-header";
import { LiquidGlassFilters } from "@/components/ui/LiquidGlassFilters";

export const metadata: Metadata = {
  title: "CloneStore",
  description:
    "CloneStore — gagnez du temps et de l’argent avec des employés IA premium pour entreprises.",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

const ORG_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "CloneStore",
  url: "https://clonestore.pro",
  logo: "https://clonestore.pro/icon-512.png",
  description:
    "CloneStore aide les entreprises à gagner du temps et de l’argent avec des employés IA premium.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSON_LD) }}
        />
      </head>

      <body>
        <LiquidGlassFilters />

        <div className="cs-backdrop" aria-hidden="true">
          <div className="cs-backdrop__halo cs-backdrop__halo--a" />
          <div className="cs-backdrop__halo cs-backdrop__halo--b" />
          <div className="cs-backdrop__halo cs-backdrop__halo--c" />
          <div className="cs-backdrop__arc" />
          <div className="cs-backdrop__film" />
        </div>

        <div className="cs-vignette" aria-hidden="true" />

        <SiteHeader />

        <div className="cs-main">{children}</div>

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
      </body>
    </html>
  );
}