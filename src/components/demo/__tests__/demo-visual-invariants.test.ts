// /demo — VERROU anti-régression des textes collés (Premium Demo Reconstruction, 2026-07-30).
//
// Cause racine des bugs `11 h 35de travail humain`, `12 mind'attention humaine`, `01Un…`,
// `02CLONESTORE`, `10Vous…` : des éléments inline adjacents (nombre + unité, numéro d'eyebrow +
// libellé) SANS espace réelle dans le DOM — la séparation ne reposait que sur du CSS (flex-gap /
// petite marge), fragile et invisible dans le textContent. Or `display`/`gap` n'ajoutent JAMAIS de
// caractère au texte : ce test rend le DOM réel (react-dom/server, comme capacity-calculator) et
// retire les balises SANS insérer d'espace — donc tout collage subsiste dans le texte extrait et
// fait échouer le test. Le correctif insère une vraie séparation blanche dans les primitives.

import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ValueShock } from "../acts/ValueShock";
import { Act1Opening } from "../acts/Act1Opening";
import { CineEyebrow } from "../primitives/cine";

/** Texte visible réel : on retire les balises SANS les remplacer par une espace, de sorte qu'un
 *  collage inline (`a</span><span>b` -> `ab`) reste détectable. On décode les apostrophes puis on
 *  réduit toute espace blanche (y compris no-break U+00A0 et fine U+202F/U+2009 que `\s` couvre en
 *  JS) à une espace simple — cela NE CRÉE jamais de séparation là où il y a collage, mais neutralise
 *  la variante d'espace typographique française pour la comparaison. */
function visibleText(el: React.ReactElement): string {
  return renderToStaticMarkup(el)
    .replace(/<[^>]+>/g, "")
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/’/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

describe("/demo — invariants de texte visible (aucun collage nombre/unité ni numéro/libellé)", () => {
  const valueShock = () => visibleText(React.createElement(ValueShock));
  const opening = () => visibleText(React.createElement(Act1Opening, { onDirectPierre: () => {} }));

  it("SCÈNE 1 (ValueShock) affiche les valeurs correctement espacées", () => {
    const t = valueShock();
    expect(t).toContain("11 h 35 de travail humain");
    expect(t).toContain("12 min d'attention humaine");
    expect(t).toContain("Voir ce que Pierre absorbe");
  });

  it("SCÈNE 1 ne colle jamais le nombre à son unité", () => {
    const t = valueShock();
    expect(t).not.toContain("35de");
    expect(t).not.toContain("mind'attention");
    expect(t).not.toContain("35de travail");
  });

  it("SCÈNE 2 (Act1Opening) conserve la promesse produit exacte", () => {
    const t = opening();
    expect(t).toContain("N'achetez plus seulement des logiciels.");
    expect(t).toContain("Ouvrez des postes d'employés IA.");
  });

  it("aucun numéro d'eyebrow n'est collé à son libellé (01Un, 02CLONESTORE, 10Vous…)", () => {
    // Un numéro suivi IMMÉDIATEMENT d'une lettre = collage. Après correctif, une espace réelle sépare.
    for (const t of [valueShock(), opening()]) {
      expect(t).not.toMatch(/\b0[0-9][A-Za-zÀ-ÿ]/);
      expect(t).not.toMatch(/\b1[0-9][A-Za-zÀ-ÿ]/);
    }
  });

  it("le primitive CineEyebrow insère une séparation réelle entre le numéro et le libellé", () => {
    const t = visibleText(
      React.createElement(CineEyebrow, { n: "01" }, "Un responsable commercial rejoint l'équipe"),
    );
    expect(t).toContain("01 Un responsable");
    expect(t).not.toContain("01Un");
  });
});
