import "./globals.css";
import Link from "next/link";
import Script from "next/script";

export const metadata = {
  title: "CloneStore",
  description: "Vos employés IA, clé en main.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/logo-icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    url: "https://clonestore.pro",
    title: "CloneStore — Vos employés IA, clé en main.",
    description: "Agents IA prêts à l’emploi pour recruter, prospecter, assister et supporter vos clients.",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "CloneStore — Vos employés IA, clé en main.",
    description: "Agents IA prêts à l’emploi pour recruter, prospecter, assister et supporter vos clients.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-xl font-semibold">CloneStore</Link>
            <div className="flex items-center gap-6 text-sm">
              <Link href="/agents" className="hover:opacity-80">Boutique</Link>
              <Link href="/account/agents" className="hover:opacity-80">Mes agents</Link>
              <Link href="/account" className="hover:opacity-80">Mon compte</Link>
            </div>
          </nav>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>

        <footer className="border-t py-8 text-center text-xs opacity-70">
          © {new Date().getFullYear()} CloneStore
        </footer>

        {/* ✅ Script pour dire à Google que ton logo officiel est celui du site */}
        <Script
          id="ld-org"
          type="application/ld+json"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "CloneStore",
              "url": "https://clonestore.pro",
              "logo": "https://clonestore.pro/logo.svg",
            }),
          }}
        />
      </body>
    </html>
  );
}





