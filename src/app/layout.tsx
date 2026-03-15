import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CloneStore",
  description: "Vos employés IA, clé en main.",
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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* Favicon + iOS */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        {/* Logo “officiel” pour Google */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSON_LD) }}
        />
      </head>

      <body className="min-h-screen bg-background text-foreground antialiased">
        {/* Backdrop global subtil */}
        <div className="cs-bg" aria-hidden="true" />

        {/* HEADER */}
        <header className="sticky top-0 z-50 border-b bg-background/75 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link
              href="/"
              className="group inline-flex items-center gap-3 text-base font-semibold tracking-tight hover:opacity-90"
            >
              <span className="cs-mark" aria-hidden="true" />
              <span>CloneStore</span>
            </Link>

            <div className="flex items-center gap-6 text-sm">
              <Link href="/agents" className="hover:opacity-80">
                Boutique
              </Link>
              <Link href="/profile/agents" className="hover:opacity-80">
                Mes clones
              </Link>
              <Link href="/profile" className="hover:opacity-80">
                Mon compte
              </Link>

              <Link
                href="/assistant"
                className="ml-2 inline-flex h-9 w-9 items-center justify-center rounded-full border bg-card text-xs font-semibold shadow-soft hover:bg-muted transition"
                aria-label="Questions"
                title="Questions"
              >
                ?
              </Link>
            </div>
          </nav>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>

        <footer className="border-t py-8 text-xs">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 opacity-70">
            <span>© {new Date().getFullYear()} CloneStore</span>
            <div className="flex items-center gap-4">
              <Link href="/legal/confidentialite" className="hover:opacity-80">
                Politique de confidentialité
              </Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}











