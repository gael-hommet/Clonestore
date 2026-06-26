// CloneStory — Conditions du Cercle. Transparence claire sans casser le prestige.

import type { Metadata } from "next";
import { StoryDisplay, StoryEyebrow, StoryHeading, StoryRule } from "@/components/clonestory/primitives";
import { DOCTRINE, FOUNDER_MEANING_NOTE } from "@/lib/clonestory/founding-partners/vocabulary";

export const dynamic = "force-static";
export const metadata: Metadata = { title: "Conditions du Cercle — CloneStory", robots: { index: false, follow: false } };

const POINTS: { h: string; p: string }[] = [
  { h: "Un statut honorifique", p: "L'appartenance au Cercle est une reconnaissance d'une contribution au commencement de CloneStore. Elle est honorifique." },
  { h: "Aucun droit financier ni capitalistique", p: "Le Cercle ne confère aucune part sociale, aucune action, aucun droit de vote, aucune rémunération automatique." },
  { h: "Aucune relation de travail ni mandat", p: "L'appartenance au Cercle n'établit aucune relation de travail, aucun mandat de représentation, et n'autorise pas à parler officiellement au nom de CloneStore." },
  { h: "Contribution vérifiée", p: "Le titre de Partenaire Fondateur de CloneStore et le numéro de registre définitif ne sont accordés qu'après une contribution réelle et vérifiée : une entreprise introduite, devenue cliente, puis activée, après un délai de validation." },
  { h: "Attribution", p: "Une contribution est attribuée à un seul membre direct (première attribution valide et prouvée, avant l'achat). L'origine de branche et l'impact de réseau sont reconnus séparément, sans retirer le mérite direct. Les conflits sont soumis à une revue manuelle." },
  { h: "Suspension pour fraude", p: "Toute fraude — auto-attribution, comptes multiples, recommandation déclarée après l'achat, collusion — peut entraîner la suspension du compte et le refus de la contribution." },
  { h: "Données personnelles", p: "Vous pouvez demander le retrait de vos données à tout moment. Les données d'un contact qui refuse une mise en relation sont effacées." },
  { h: "Registre public", p: "Un registre public pourra présenter, à l'avenir, les Partenaires Fondateurs dont la contribution est vérifiée. Un simple membre inscrit n'y figure pas tant qu'aucune contribution n'est vérifiée." },
];

export default function ConditionsPage() {
  return (
    <main className="csy-canvas">
      <section className="csy-section csy-section--hero" style={{ paddingBottom: "clamp(32px,5vh,64px)" }}>
        <div className="csy-shell csy-shell--narrow">
          <StoryEyebrow>Le Cercle des Partenaires Fondateurs</StoryEyebrow>
          <div style={{ marginTop: 24 }}><StoryDisplay>Conditions du Cercle</StoryDisplay></div>
          <aside className="csy-doctrine" style={{ marginTop: 28 }}>
            <p>{DOCTRINE}</p>
            <p>{FOUNDER_MEANING_NOTE}</p>
          </aside>
        </div>
      </section>

      <div className="csy-shell csy-shell--narrow"><StoryRule /></div>

      <section className="csy-section" style={{ paddingTop: "clamp(40px,6vh,72px)" }}>
        <div className="csy-shell csy-shell--narrow" style={{ display: "grid", gap: 30 }}>
          {POINTS.map((pt, i) => (
            <div key={i}>
              <StoryHeading>{pt.h}</StoryHeading>
              <p className="csy-copy" style={{ marginTop: 12 }}>{pt.p}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
