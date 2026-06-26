// Phase E.4 — Page d'activation de Pierre. Verrouillée par phase commerciale :
//   • avant le lancement  → activation bloquée proprement (réservation possible) ;
//   • fenêtre fondateur    → activation disponible ;
//   • après fermeture      → conditions fondatrices non disponibles.
// Aucune confiance dans les paramètres du navigateur : la liaison réservation↔compte
// est revalidée côté serveur au moment du checkout.

import type { Metadata } from "next";
import Link from "next/link";
import { getFounderPhase, DEMO_LAUNCH_LABEL, FOUNDER_CLOSE_LABEL, FOUNDER_PRICE_MONTHLY } from "@/lib/founder-access/commercial";
import { getRuntimeDb } from "@/lib/pierre/v1/db";
import { getReservationForActivation } from "@/lib/founder-access/store";
import { PresencePing } from "@/components/founder/PresencePing";
import { ActivatePierre } from "./ActivatePierre";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Activer Pierre", description: "Activez Pierre, votre employé IA RH, au tarif fondateur." };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadCompany(rid: string | undefined): Promise<string | null> {
  if (!rid || !UUID_RE.test(rid)) return null;
  try {
    const db = await getRuntimeDb();
    const r = await getReservationForActivation(db, rid);
    return r?.company_name ?? null;
  } catch {
    return null;
  }
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="cs-page"><div className="cs-page-shell">
      <section className="mx-auto grid min-h-[calc(100vh-180px)] max-w-[680px] items-center py-10">{children}</section>
    </div></main>
  );
}

export default async function ActivatePierrePage({ searchParams }: { searchParams: Promise<{ rid?: string }> }) {
  const { rid } = await searchParams;
  const phase = getFounderPhase();

  if (phase === "before_launch") {
    return (
      <Shell>
        <div className="rounded-[1.8rem] border border-white/60 bg-white/70 p-8 backdrop-blur-xl">
          <h1 className="cs-heading text-2xl">L'activation de Pierre ouvre le {DEMO_LAUNCH_LABEL}.</h1>
          <p className="mt-3 text-[0.95rem] leading-relaxed text-[var(--cs-ink-3)]">
            Vous pourrez activer Pierre dès l'ouverture des accès fondateurs. {FOUNDER_PRICE_MONTHLY}. Réservez dès maintenant pour être prévenu en priorité.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/reserver/pierre" className="cs-liquid-button min-h-11 px-5">Réserver Pierre</Link>
            <Link href="/demo/pierre" className="text-[0.9rem] font-semibold text-[var(--cs-ink-3)] underline-offset-2 hover:underline self-center">Revoir Pierre</Link>
          </div>
        </div>
      </Shell>
    );
  }

  if (phase === "closed") {
    return (
      <Shell>
        <div className="rounded-[1.8rem] border border-white/60 bg-white/70 p-8 backdrop-blur-xl">
          <h1 className="cs-heading text-2xl">L'accès fondateur est clôturé.</h1>
          <p className="mt-3 text-[0.95rem] leading-relaxed text-[var(--cs-ink-3)]">
            Les conditions fondatrices ne sont plus disponibles depuis le {FOUNDER_CLOSE_LABEL}. Écrivez-nous pour connaître les conditions en vigueur.
          </p>
          <div className="mt-5"><Link href="/questions" className="cs-liquid-button min-h-11 px-5">Nous écrire</Link></div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <PresencePing phase="launched" event="founder_activation_viewed" />
      <ActivatePierre reservationId={rid && UUID_RE.test(rid) ? rid : null} companyName={await loadCompany(rid)} />
    </Shell>
  );
}
