// CloneStory — page de remerciement après action d'un prospect (confirmation/refus).

import type { Metadata } from "next";
import Link from "next/link";
import { StoryDisplay, StoryEyebrow, StoryLede } from "@/components/clonestory/primitives";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Merci — CloneStory", robots: { index: false, follow: false } };

const COPY: Record<string, { title: string; body: string }> = {
  ok: {
    title: "Merci. C'est confirmé.",
    body: "Votre confirmation est enregistrée. Cette introduction est désormais inscrite au registre du membre qui vous a présenté CloneStore.",
  },
  revue: {
    title: "Merci. Votre réponse est enregistrée.",
    body: "Cette entreprise faisait déjà l'objet d'une attribution. Votre confirmation est conservée et soumise à une vérification.",
  },
  refus: {
    title: "C'est noté.",
    body: "Vous avez indiqué ne pas confirmer cette mise en relation. Aucune contribution n'est enregistrée et vos données ont été effacées.",
  },
  invalide: {
    title: "Ce lien n'est plus valide.",
    body: "Ce lien de confirmation a expiré ou a déjà été utilisé.",
  },
};

export default async function MerciPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const sp = await searchParams;
  const copy = COPY[sp.c ?? "ok"] ?? COPY.ok;
  return (
    <main className="csy-canvas">
      <section className="csy-section csy-section--hero">
        <div className="csy-shell csy-shell--narrow">
          <StoryEyebrow>Le Cercle des Partenaires Fondateurs</StoryEyebrow>
          <div style={{ marginTop: 24 }}><StoryDisplay>{copy.title}</StoryDisplay></div>
          <div style={{ marginTop: 24 }}><StoryLede>{copy.body}</StoryLede></div>
          <div style={{ marginTop: 30 }}>
            <Link href="/founding-partners" className="csy-link">Découvrir CloneStore <span className="csy-link__arrow" aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>
    </main>
  );
}
