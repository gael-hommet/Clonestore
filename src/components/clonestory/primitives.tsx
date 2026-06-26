// CloneStory — primitives d'interface ISOLÉES (composants serveur, sans état).
//
// Sobres et institutionnelles : elles ne portent que des classes .csy-* définies
// dans clonestory.css. Aucune logique métier, aucune dépendance crypto.

import type { ReactNode } from "react";
import {
  DOCTRINE,
  FOUNDER_MEANING_NOTE,
  buildIdentity,
} from "@/lib/clonestory/founding-partners/vocabulary";

export function StoryEyebrow({ children }: { children: ReactNode }) {
  return <p className="csy-eyebrow">{children}</p>;
}

export function StoryDisplay({ children }: { children: ReactNode }) {
  return <h1 className="csy-display">{children}</h1>;
}

export function StoryHeading({ children }: { children: ReactNode }) {
  return <h2 className="csy-heading">{children}</h2>;
}

export function StoryLede({ children }: { children: ReactNode }) {
  return <p className="csy-lede">{children}</p>;
}

export function StoryRule({ metal = false }: { metal?: boolean }) {
  return <hr className={metal ? "csy-rule csy-rule--metal" : "csy-rule"} />;
}

/**
 * Note doctrinale : affiche la phrase doctrinale verrouillée + la précision
 * juridique sur le sens de « fondateur ». Claire mais élégante.
 */
export function DoctrineNote({ withLegalNote = true }: { withLegalNote?: boolean }) {
  return (
    <aside className="csy-doctrine" aria-label="Nature du programme">
      <p>{DOCTRINE}</p>
      {withLegalNote ? <p>{FOUNDER_MEANING_NOTE}</p> : null}
    </aside>
  );
}

/**
 * Sceau de registre : badge international + titre français + ligne « Depuis … ».
 * N'est légitime que pour un Partenaire Fondateur vérifié (numéro de registre
 * alloué). Composant de présentation pur — la donnée provient du serveur.
 */
export function RegistrySeal({
  registryNumber,
  joinedAt,
}: {
  registryNumber: number;
  joinedAt: Date;
}) {
  const identity = buildIdentity(registryNumber, joinedAt);
  return (
    <div className="csy-seal" role="group" aria-label="Sceau de registre">
      <span className="csy-seal__badge">{identity.badge}</span>
      <span className="csy-seal__title">{identity.titleFr}</span>
      <span className="csy-seal__since">{identity.since}</span>
    </div>
  );
}
