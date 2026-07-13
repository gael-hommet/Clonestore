// src/lib/clonechat/intelligence/c1-1/parrain-visibility.ts
// C1.1 — Politique de visibilité FAIL-CLOSED. Le mode et le rôle sont résolus côté
// serveur. RESTRICTED_SECRET n'est JAMAIS visible (ni modèle, ni client, ni fondateur).
// COMPANY_SCOPED exige l'entreprise EXACTE. Le public ne voit que PUBLIC.

import type { KnowledgeVisibility } from "../../knowledge/types";
import type {
  ParrainKnowledgeChunk,
  ParrainViewerContext,
  ParrainViewerMode,
  ParrainVisibility,
} from "./parrain-types";

/** Visibilités autorisées par mode — RESTRICTED_SECRET n'apparaît JAMAIS. */
export function allowedParrainVisibilities(mode: ParrainViewerMode): readonly ParrainVisibility[] {
  switch (mode) {
    // SESSION_EPHEMERAL : le fichier que l'utilisateur vient lui-même de joindre. Il est visible
    // dans TOUS les modes (y compris anonyme) — c'est SON contenu — mais il n'est jamais lié à
    // une entreprise, donc il ne peut jamais servir de pont vers des données tenant.
    case "public":
      return ["PUBLIC", "SESSION_EPHEMERAL"];
    case "client":
      return ["PUBLIC", "SESSION_EPHEMERAL", "AUTHENTICATED_CLIENT", "COMPANY_SCOPED"];
    case "founder":
      return ["PUBLIC", "SESSION_EPHEMERAL", "AUTHENTICATED_CLIENT", "COMPANY_SCOPED", "FOUNDER_INTERNAL"];
  }
}

/** Un chunk est-il visible pour CE viewer ? (visibilité + tenant, fail-closed) */
export function chunkVisibleFor(chunk: ParrainKnowledgeChunk, viewer: ParrainViewerContext): boolean {
  if (chunk.parrainVisibility === "RESTRICTED_SECRET") return false; // jamais, pour personne
  if (!allowedParrainVisibilities(viewer.mode).includes(chunk.parrainVisibility)) return false;
  if (chunk.parrainVisibility === "COMPANY_SCOPED" || chunk.tenantCompanyId !== null) {
    // Donnée tenant : exige l'entreprise EXACTE résolue serveur. Aucun repli inter-tenant.
    return (
      typeof viewer.companyId === "string" &&
      viewer.companyId.length > 0 &&
      chunk.tenantCompanyId === viewer.companyId
    );
  }
  return true;
}

/** Filtre de visibilité complet (l'unique porte avant récupération/modèle). */
export function filterVisibleChunks(
  chunks: readonly ParrainKnowledgeChunk[],
  viewer: ParrainViewerContext,
): ParrainKnowledgeChunk[] {
  return chunks.filter((c) => chunkVisibleFor(c, viewer));
}

/** Mapping vers la visibilité P9.4.1 (compatibilité KnowledgeChunk). */
export function toLegacyVisibility(v: ParrainVisibility): KnowledgeVisibility {
  switch (v) {
    case "PUBLIC":
      return "PUBLIC";
    case "SESSION_EPHEMERAL":
    case "AUTHENTICATED_CLIENT":
    case "COMPANY_SCOPED":
      return "AUTHENTICATED_CLIENT";
    case "FOUNDER_INTERNAL":
      return "INTERNAL_CLONESTORE";
    case "RESTRICTED_SECRET":
      return "RESTRICTED";
  }
}

/** Motifs de contenu secret — un chunk qui matche est REJETÉ à l'indexation (fail-closed). */
const SECRET_CONTENT_PATTERNS: readonly RegExp[] = [
  /sk_live_[a-zA-Z0-9]+/,
  /sk_test_[a-zA-Z0-9]{8,}/,
  /OPENAI_API_KEY\s*=/i,
  /SUPABASE_SERVICE_ROLE/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /Bearer\s+[A-Za-z0-9._-]{25,}/,
  /postgres(?:ql)?:\/\/[^\s"']+:[^\s"']+@/i,
];

export function containsSecretMaterial(text: string): boolean {
  return SECRET_CONTENT_PATTERNS.some((rx) => rx.test(text));
}

/**
 * Garde d'indexation : tout chunk candidat contenant du matériel secret est
 * reclassé RESTRICTED_SECRET (donc invisible partout) — jamais silencieusement gardé.
 */
export function quarantineIfSecret(chunk: ParrainKnowledgeChunk): ParrainKnowledgeChunk {
  if (!containsSecretMaterial(chunk.text)) return chunk;
  return Object.freeze({
    ...chunk,
    parrainVisibility: "RESTRICTED_SECRET" as const,
    visibility: "RESTRICTED" as const,
    text: "[contenu mis en quarantaine : matériel sensible détecté]",
  });
}

/** Un chemin de fichier interne ne doit jamais fuiter vers public/client. */
export function stripInternalPathsForViewer(text: string, mode: ParrainViewerMode): string {
  if (mode === "founder") return text;
  return text
    .replace(/src[\\/][\w\\/.@-]+\.(ts|tsx|mjs|js)/g, "un module interne")
    .replace(/\.c1[\w-]*-proofs[\w\\/.-]*/g, "des preuves internes");
}
