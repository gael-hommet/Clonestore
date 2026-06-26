// CloneStory — /founding-partners : page principale (FONDATION institutionnelle).
//
// Page sobre, majestueuse, sérieuse — une archive officielle, pas une interface
// marketing. Aucun partenaire ni aucune contribution n'est inventé : le sceau
// affiché est un SPÉCIMEN de la forme de la reconnaissance (format de vocabulaire),
// explicitement présenté comme tel.

import Link from "next/link";
import FoundingIntro from "@/components/clonestory/FoundingIntro";
import {
  DoctrineNote,
  RegistrySeal,
  StoryDisplay,
  StoryEyebrow,
  StoryHeading,
  StoryLede,
  StoryRule,
} from "@/components/clonestory/primitives";
import { PROGRAM_NAME, UNIVERSE_NAME } from "@/lib/clonestory/founding-partners/vocabulary";
import { registrationOpen } from "@/lib/clonestory/founding-partners/server/config";

// Dynamique : l'état d'ouverture (flag opérateur) est lu à chaque requête.
export const dynamic = "force-dynamic";

const PRINCIPLES = [
  {
    index: "I",
    title: "Un registre historique officiel",
    copy: "La mémoire vérifiée de CloneStore : qui était présent, et ce qui fut accompli, au commencement.",
  },
  {
    index: "II",
    title: "Une contribution vérifiée",
    copy: "Le titre ne se demande pas. Il se constate, à partir de faits réels : une entreprise introduite, devenue cliente, activée.",
  },
  {
    index: "III",
    title: "Une reconnaissance permanente",
    copy: "Une place identifiable dans le commencement d'une entreprise à très forte ambition — inscrite pour durer.",
  },
];

export default function FoundingPartnersPage() {
  // Spécimen de format (vocabulaire officiel) — PAS un partenaire réel.
  const specimenJoinedAt = new Date(Date.UTC(2026, 6, 1)); // juillet 2026
  const open = registrationOpen();
  const entryCta = open
    ? { href: "/founding-partners/join", label: "Rejoindre le Cercle" }
    : { href: "/founding-partners/conditions", label: "Découvrir le Cercle" };

  return (
    <FoundingIntro>
      <main className="csy-canvas">
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section className="csy-section csy-section--hero">
          <div className="csy-shell">
            <div className="csy-appear csy-frontispiece">
              <span className="csy-frontispiece__mark">{UNIVERSE_NAME}</span>
              <span className="csy-frontispiece__rule" />
              <StoryEyebrow>{PROGRAM_NAME}</StoryEyebrow>
            </div>
            <div className="csy-appear csy-appear--2" style={{ marginTop: 40 }}>
              <StoryDisplay>
                Ceux qui étaient là <em>au commencement</em>.
              </StoryDisplay>
            </div>
            <div className="csy-appear csy-appear--3" style={{ marginTop: 36, maxWidth: "58ch" }}>
              <StoryLede>
                CloneStore construit le futur du travail. {UNIVERSE_NAME} en conserve la mémoire —
                et le nom des personnes ayant contribué, de manière vérifiée, à son commencement.
              </StoryLede>
            </div>
            <div className="csy-appear csy-appear--4" style={{ marginTop: 44 }}>
              <Link href={entryCta.href} className="csy-button">{entryCta.label}</Link>
            </div>
          </div>
        </section>

        <div className="csy-shell">
          <StoryRule metal />
        </div>

        {/* ── Doctrine ──────────────────────────────────────────────────── */}
        <section className="csy-section">
          <div className="csy-shell csy-shell--narrow">
            <StoryEyebrow>La nature de ce Cercle</StoryEyebrow>
            <div style={{ marginTop: 28 }}>
              <DoctrineNote />
            </div>
          </div>
        </section>

        {/* ── Principes (liste éditoriale, numéros romains) ───────────────── */}
        <section className="csy-section">
          <div className="csy-shell csy-shell--narrow">
            <StoryHeading>Une distinction, pas une mécanique.</StoryHeading>
            <div className="csy-principles" style={{ marginTop: 48 }}>
              {PRINCIPLES.map((p) => (
                <article className="csy-principle" key={p.index}>
                  <span className="csy-principle__num">{p.index}</span>
                  <div>
                    <h3 className="csy-principle__title">{p.title}</h3>
                    <p className="csy-principle__copy">{p.copy}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Forme de la reconnaissance (spécimen de format) ───────────── */}
        <section className="csy-section">
          <div className="csy-shell csy-shell--narrow">
            <StoryEyebrow>La forme de la reconnaissance</StoryEyebrow>
            <div style={{ marginTop: 24, display: "grid", gap: 22, justifyItems: "start" }}>
              <RegistrySeal registryNumber={17} joinedAt={specimenJoinedAt} />
              <p className="csy-copy">
                Exemple de la forme — non un partenaire réel. Chaque Partenaire Fondateur reçoit un
                numéro de registre permanent, accordé uniquement après une contribution vérifiée.
              </p>
            </div>
          </div>
        </section>

        <div className="csy-shell">
          <StoryRule />
        </div>

        {/* ── Clôture ───────────────────────────────────────────────────── */}
        <section className="csy-section">
          <div className="csy-shell csy-shell--narrow">
            <StoryHeading>{open ? "Les inscriptions au Cercle sont ouvertes." : "Ouverture imminente du Cercle."}</StoryHeading>
            <p className="csy-copy" style={{ marginTop: 20 }}>
              {open
                ? "En rejoignant, vous devenez Membre du Cercle Fondateur. Le titre de Partenaire Fondateur de CloneStore est accordé après une première contribution vérifiée."
                : "Le Cercle ouvrira très prochainement ses inscriptions. En attendant, découvrez ce qu'est le Cercle et la nature de la reconnaissance qu'il consacre."}
            </p>
            <div style={{ marginTop: 32, display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
              <Link href={entryCta.href} className="csy-button">{entryCta.label}</Link>
              <Link href="/founding-partners/conditions" className="csy-link">
                Conditions du Cercle
                <span className="csy-link__arrow" aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </FoundingIntro>
  );
}
