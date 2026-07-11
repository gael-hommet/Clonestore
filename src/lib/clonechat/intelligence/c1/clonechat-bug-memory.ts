// src/lib/clonechat/intelligence/c1/clonechat-bug-memory.ts
// C1 — Mémoire de bugs VALIDÉS : les candidats ne sont JAMAIS réutilisés globalement
// avant validation ; les connaissances de compte ne fuient JAMAIS vers d'autres
// entreprises ; aucune donnée personnelle sensible en mémoire globale (rédaction
// systématique — réutilise redactSymptom de la couche clonechat vérifiée P9.4.x).
// Ne jamais prétendre qu'un bug est corrigé quand seul un contournement existe.

import { redactSymptom } from "../../bug-memory";
import {
  c1Fingerprint,
  c1TokenSimilarity,
  type BugSeverity,
  type BugScope,
  type KnownBug,
  type KnownBugMatch,
} from "./clonechat-knowledge-types";

const MATCH_THRESHOLD = 0.3;

export interface KnownBugQuery {
  readonly text: string;
  readonly route?: string | null;
  readonly companyId?: string | null;
}

export interface ReportKnownBugInput {
  readonly title: string;
  readonly symptoms: readonly string[];
  readonly affectedRoutes?: readonly string[];
  readonly affectedFeatures?: readonly string[];
  readonly severity?: BugSeverity;
  readonly rootCauseHypothesis?: string;
  readonly workaround?: string | null;
  readonly scope?: BugScope;
  readonly accountId?: string | null;
  readonly at: string;
}

export interface C1BugMemory {
  /** Retourne UNIQUEMENT des bugs validés, dans le périmètre autorisé (global ou même compte). */
  find(query: KnownBugQuery): readonly KnownBugMatch[];
  /** Enregistre un bug en statut candidate (jamais réutilisable globalement tel quel). */
  report(input: ReportKnownBugInput): KnownBug;
  /** Seule voie vers la réutilisation : validation explicite. */
  validate(id: string, opts: { readonly by: string; readonly at: string; readonly confirmedFix?: string | null }): KnownBug | null;
  /** Déprécie (jamais de suppression silencieuse). */
  deprecate(id: string, opts: { readonly by: string; readonly at: string }): KnownBug | null;
  get(id: string): KnownBug | null;
  list(): readonly KnownBug[];
  listCandidates(): readonly KnownBug[];
}

function redactAll(texts: readonly string[]): readonly string[] {
  return texts.map((t) => redactSymptom(t));
}

/** Un bug est-il visible pour cette requête ? (isolation de compte fail-closed) */
function visibleFor(bug: KnownBug, companyId: string | null | undefined): boolean {
  if (bug.validationStatus !== "validated") return false; // candidats/dépréciés : jamais réutilisés
  if (bug.scope === "account") {
    return typeof companyId === "string" && companyId.length > 0 && bug.accountId === companyId;
  }
  return true; // global / route / feature — connaissance produit, rédactée
}

export function createC1BugMemory(seed: readonly KnownBug[] = C1_SEED_KNOWN_BUGS): C1BugMemory {
  const bugs = new Map<string, KnownBug>(seed.map((b) => [b.id, b]));

  return {
    find(query: KnownBugQuery): readonly KnownBugMatch[] {
      const text = query.text ?? "";
      const matches: KnownBugMatch[] = [];
      for (const bug of bugs.values()) {
        if (!visibleFor(bug, query.companyId)) continue;
        const routeBoost =
          query.route && bug.affectedRoutes.includes(query.route) ? 0.2 : 0;
        const score =
          Math.max(...bug.symptoms.map((s) => c1TokenSimilarity(text, s)), c1TokenSimilarity(text, bug.title)) +
          routeBoost;
        if (score >= MATCH_THRESHOLD) matches.push({ bug, score });
      }
      return matches.sort((a, b) => b.score - a.score);
    },

    report(input: ReportKnownBugInput): KnownBug {
      const symptoms = redactAll(input.symptoms);
      const id = c1Fingerprint("kb", symptoms.join(" | ") + (input.scope === "account" ? `@${input.accountId ?? ""}` : ""));
      const existing = bugs.get(id);
      if (existing) return existing;
      const scope = input.scope ?? "global";
      const bug: KnownBug = Object.freeze({
        id,
        title: redactSymptom(input.title),
        symptoms,
        affectedRoutes: input.affectedRoutes ?? [],
        affectedFeatures: input.affectedFeatures ?? [],
        severity: input.severity ?? "medium",
        rootCauseHypothesis: input.rootCauseHypothesis ?? "À investiguer.",
        confirmedFix: null,
        workaround: input.workaround ?? null,
        validationStatus: "candidate",
        scope,
        accountId: scope === "account" ? (input.accountId ?? null) : null,
        createdAt: input.at,
        updatedAt: input.at,
      });
      bugs.set(id, bug);
      return bug;
    },

    validate(id, opts) {
      const bug = bugs.get(id);
      if (!bug || !opts.by) return null;
      const next: KnownBug = Object.freeze({
        ...bug,
        validationStatus: "validated",
        confirmedFix: opts.confirmedFix ?? bug.confirmedFix,
        updatedAt: opts.at,
      });
      bugs.set(id, next);
      return next;
    },

    deprecate(id, opts) {
      const bug = bugs.get(id);
      if (!bug || !opts.by) return null;
      const next: KnownBug = Object.freeze({ ...bug, validationStatus: "deprecated", updatedAt: opts.at });
      bugs.set(id, next);
      return next;
    },

    get: (id) => bugs.get(id) ?? null,
    list: () => [...bugs.values()],
    listCandidates: () => [...bugs.values()].filter((b) => b.validationStatus === "candidate"),
  };
}

// ── Bugs connus validés (seed produit — issus de gotchas réels des phases) ─────
const kb = (x: KnownBug): KnownBug => Object.freeze(x);
const SEED_AT = "2026-07-10T00:00:00.000Z";

export const C1_SEED_KNOWN_BUGS: readonly KnownBug[] = Object.freeze([
  kb({
    id: "kb_cockpit_cold_start",
    title: "Premier chargement du cockpit lent (compilation à froid en dev)",
    symptoms: ["le cockpit met longtemps à charger la première fois", "cockpit lent premier accès", "page cockpit blanche puis charge"],
    affectedRoutes: ["/cockpit", "/cockpit/pierre"],
    affectedFeatures: ["cockpit"],
    severity: "low",
    rootCauseHypothesis: "Compilation à froid des routes authentifiées (connu P13 : warm-up recommandé).",
    confirmedFix: null,
    workaround: "Recharger la page après quelques secondes ; le second accès est rapide.",
    validationStatus: "validated",
    scope: "route",
    accountId: null,
    createdAt: SEED_AT,
    updatedAt: SEED_AT,
  }),
  kb({
    id: "kb_swiss_sees_eur",
    title: "Utilisateur suisse voyant l'offre en euros",
    symptoms: ["je suis en suisse mais je vois le prix en euros", "prix euro affiché en suisse", "pas le bon prix pour la suisse"],
    affectedRoutes: ["/reserver/pierre", "/paiement", "/comprendre-clonestore"],
    affectedFeatures: ["pricing"],
    severity: "medium",
    rootCauseHypothesis: "Le pays n'est pas encore déterminé : l'offre suisse s'applique dès que le pays Suisse est renseigné (le paiement vérifie ensuite pays/devise, une incohérence CH/EUR est bloquée).",
    confirmedFix: null,
    workaround: "Renseigner « Suisse » comme pays dans le formulaire de réservation : l'offre 499 CHF / mois s'applique.",
    validationStatus: "validated",
    scope: "feature",
    accountId: null,
    createdAt: SEED_AT,
    updatedAt: SEED_AT,
  }),
  kb({
    id: "kb_clonechat_locked",
    title: "CloneChat (/assistant) verrouillé ou indisponible",
    symptoms: ["clonechat ne s'ouvre pas", "assistant indisponible", "l'assistant affiche un écran verrouillé", "erreur 503 assistant"],
    affectedRoutes: ["/assistant"],
    affectedFeatures: ["clonechat"],
    severity: "low",
    rootCauseHypothesis: "Comportement attendu : CloneChat est désactivé par défaut (flag serveur) tant que l'activation n'est pas décidée.",
    confirmedFix: null,
    workaround: "Ce n'est pas une panne : la fonctionnalité sera activée à l'ouverture. Le support répond via /questions.",
    validationStatus: "validated",
    scope: "route",
    accountId: null,
    createdAt: SEED_AT,
    updatedAt: SEED_AT,
  }),
  kb({
    id: "kb_demo_old_mobile",
    title: "Démo lourde sur ancien mobile",
    symptoms: ["la démo rame sur mobile", "animations saccadées démo", "la démo ne s'ouvre pas sur mon téléphone"],
    affectedRoutes: ["/demo"],
    affectedFeatures: ["demo", "mobile"],
    severity: "medium",
    rootCauseHypothesis: "Animations immersives coûteuses sur appareils anciens ; un repli sans JavaScript existe.",
    confirmedFix: null,
    workaround: "Utiliser le mode simplifié (repli sans JavaScript) ou un navigateur récent ; la démo /demo/pierre est plus légère.",
    validationStatus: "validated",
    scope: "route",
    accountId: null,
    createdAt: SEED_AT,
    updatedAt: SEED_AT,
  }),
  kb({
    id: "kb_gated_redirect_login",
    title: "Redirection vers /login sur les pages cockpit",
    symptoms: ["le cockpit me renvoie vers la connexion", "je ne peux pas accéder à mon clonestore", "redirection login cockpit"],
    affectedRoutes: ["/cockpit", "/mon-clonestore"],
    affectedFeatures: ["login"],
    severity: "low",
    rootCauseHypothesis: "Comportement attendu : ces pages exigent une session (garde middleware).",
    confirmedFix: null,
    workaround: "Se connecter via /login ; l'accès aux cockpits suit immédiatement.",
    validationStatus: "validated",
    scope: "route",
    accountId: null,
    createdAt: SEED_AT,
    updatedAt: SEED_AT,
  }),
  // Candidat NON validé (preuve de non-réutilisation globale) :
  kb({
    id: "kb_candidate_reserve_button",
    title: "Bouton réserver sans effet (signalement isolé, non confirmé)",
    symptoms: ["le bouton réserver ne fait rien", "clic reserver sans effet"],
    affectedRoutes: ["/reserver/pierre"],
    affectedFeatures: ["demo"],
    severity: "high",
    rootCauseHypothesis: "Non reproduit — possible état de fenêtre fondateur fermée ou JavaScript bloqué.",
    confirmedFix: null,
    workaround: null,
    validationStatus: "candidate",
    scope: "global",
    accountId: null,
    createdAt: SEED_AT,
    updatedAt: SEED_AT,
  }),
]);
