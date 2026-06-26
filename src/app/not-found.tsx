// Frontière not-found globale. Sa présence garantit que `notFound()` renvoie un VRAI
// statut HTTP 404 (sinon Next, en rendu dynamique streamé sans frontière, peut laisser
// fuiter un 200 avec le corps « page introuvable »). Page publique, indexation interdite.
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page introuvable — CloneStore",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="cs-page">
      <div className="cs-page-shell">
        <div className="mx-auto max-w-[560px] py-24 text-center">
          <p className="cs-eyebrow">Erreur 404</p>
          <h1 className="cs-display mt-3 text-[clamp(2rem,5vw,3.4rem)] leading-[1.02]">
            Page introuvable
          </h1>
          <p className="mt-4 text-[0.95rem] leading-relaxed text-[var(--cs-ink-3)]">
            Cette page n’existe pas ou n’est plus disponible.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--cs-violet)] px-6 text-sm font-semibold text-white shadow-lg transition-all hover:-translate-y-0.5"
            >
              Retour à l’accueil
            </Link>
            <Link
              href="/agents/pierre"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-[rgba(0,0,0,0.08)] bg-white/70 px-5 text-sm font-semibold text-[var(--cs-ink-2)] transition-all hover:-translate-y-0.5"
            >
              Découvrir Pierre
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
