// CloneStory — Le Cercle des Partenaires Fondateurs
// normalize.ts — Helpers de normalisation PURS (aucune dépendance node:crypto,
// donc sûrs à importer depuis un composant client sans casser `next build`).

const ZERO_WIDTH = /[​-‍﻿]/g; // espaces zéro-largeur + BOM
const DIACRITICS = /[̀-ͯ]/g; // marques diacritiques combinées

/**
 * Normalise un email pour COMPARAISON (anti-fraude / déduplication) :
 * minuscule, trim, suppression d'espaces zéro-largeur / BOM. Ne touche pas aux
 * sous-adresses (+tag) ni aux points : on compare l'identité telle que saisie,
 * la qualification fine reste côté serveur.
 */
export function normalizeEmailForCompare(email: string): string {
  return (email ?? "").replace(ZERO_WIDTH, "").trim().toLowerCase();
}

/**
 * Construit un slug public lisible et sûr à partir d'un nom (page publique
 * `/founding-partners/[slug]`). ASCII, minuscules, tirets ; jamais vide.
 * On ne déduit JAMAIS un slug d'une donnée sensible — uniquement du nom affiché.
 */
export function buildPublicSlug(displayName: string, registryNumber: number): string {
  const base = (displayName ?? "")
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const suffix = String(registryNumber).padStart(3, "0");
  return base ? `${base}-${suffix}` : `partenaire-${suffix}`;
}

/** Vrai si un slug est de forme attendue (sûr à router). */
export function isValidPublicSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 3 && slug.length <= 64;
}

/**
 * Empreinte d'entreprise PUBLIQUE-SAFE et déterministe pour la déduplication,
 * SANS crypto : normalise un identifiant d'entreprise (nom + pays, ou domaine)
 * en une clé stable. Pour une empreinte non réversible (hachée), voir token.ts.
 */
export function companyDedupKey(parts: { name?: string | null; domain?: string | null }): string {
  const name = (parts.name ?? "")
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(/\b(sas|sasu|sarl|sa|eurl|inc|ltd|llc|gmbh|bv|srl)\b/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
  const domain = (parts.domain ?? "").toLowerCase().replace(/^www\./, "").trim();
  // Le NOM identifie l'entreprise (deux sociétés partageant un domaine email — ex.
  // un domaine mutualisé — ne doivent PAS être confondues). Le domaine sert de repli.
  return name || domain || "";
}
