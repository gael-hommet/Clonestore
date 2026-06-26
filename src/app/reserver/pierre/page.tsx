import type { Metadata } from "next";
import { ReservationForm } from "./ReservationForm";
import { PresencePing } from "@/components/founder/PresencePing";
import { FOUNDER_PRICE_MONTHLY, getFounderPhase } from "@/lib/founder-access/commercial";

export const metadata: Metadata = {
  title: "Réserver Pierre — CloneStore",
  description:
    "Réservez l'accès fondateur à Pierre, l'employé IA RH de CloneStore. Aucun paiement aujourd'hui ; 449 € HT/mois, tarif conservé tant que l'abonnement reste actif après activation.",
  alternates: { canonical: "/reserver/pierre" },
  robots: { index: true, follow: true },
};

export default async function ReserverPierrePage({
  searchParams,
}: {
  searchParams: Promise<{ confirm?: string }>;
}) {
  const { confirm } = await searchParams;
  return (
    <div className="cs-page">
      <PresencePing phase={getFounderPhase()} />
      <div className="cs-page-shell">
        <div className="mx-auto max-w-[680px]">
          <header className="mb-7 text-center">
            <p className="cs-eyebrow">Accès fondateur</p>
            <h1 className="cs-display mt-3 text-[clamp(1.9rem,4vw,3rem)] leading-[1.02]">
              Réservez Pierre, votre employé IA RH
            </h1>
            <p className="mx-auto mt-4 max-w-[520px] text-[0.95rem] leading-relaxed text-[var(--cs-ink-3)]">
              Pierre prend en charge le travail RH opérationnel confié ; votre entreprise garde
              ses règles, ses validations et le contrôle des décisions sensibles. {FOUNDER_PRICE_MONTHLY}.
            </p>
          </header>
          <ReservationForm confirmState={confirm} />
        </div>
      </div>
    </div>
  );
}
