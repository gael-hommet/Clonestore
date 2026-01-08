import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CloneStore",
  description: "Vos employés IA, clé en main.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {/* HEADER */}
        <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            {/* LOGO / HOME */}
            <Link
              href="/"
              className="text-xl font-semibold tracking-tight hover:opacity-80"
            >
              CloneStore
            </Link>

            {/* NAVIGATION */}
            <div className="flex items-center gap-6 text-sm">
              <Link href="/agents" className="hover:opacity-80">
                Boutique
              </Link>

              <Link href="/profile/agents" className="hover:opacity-80">
                Mes agents
              </Link>

              <Link href="/profile" className="hover:opacity-80">
                Mon compte
              </Link>

              {/* HELP / CHATBOT */}
              <Link
                href="/assistant"
                className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold hover:bg-muted transition"
                aria-label="Questions"
                title="Questions"
              >
                ?
              </Link>
            </div>
          </nav>
        </header>

        {/* CONTENU PRINCIPAL */}
        <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>

        {/* FOOTER */}
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








