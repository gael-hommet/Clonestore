// src/lib/clonechat/care/known-issues.ts
//
// Registre CANONIQUE, typé, versionné et déterministe des problèmes/limitations RÉELLEMENT prouvés
// par le repo (routes, erreurs structurées, comportements existants, rapports). AUCUNE entrée n'est
// créée parce qu'un modèle la suggère : chaque entrée porte une PROVENANCE vers une source réelle.
// La correspondance se fait sur des signaux réels (codes d'erreur, kind de diagnostic, catégorie de
// blocage, code de refus tenant) — jamais sur du texte libre.

import type { CloneChatContext } from "@/lib/clonechat/context";
import type { CloneChatDiagnosis, DiagnosisKind, BlockerCategory } from "@/lib/clonechat/diagnosis";
import type { TicketCategory } from "./types";

export const CLONECHAT_KNOWN_ISSUES_VERSION = "known-issues-1" as const;

export type IssueSeverity = "low" | "medium" | "high";
/** Statut de cycle de vie RÉEL (jamais un statut inventé, jamais une équipe assignée). */
export type IssueStatus = "known" | "by_design" | "transient" | "mitigated" | "monitoring";

export interface KnownIssue {
  readonly id: string;
  readonly title: string;
  readonly description: string; // description SÛRE (aucun secret, aucune donnée client)
  readonly category: TicketCategory;
  readonly severity: IssueSeverity;
  readonly status: IssueStatus;
  readonly surfaces: readonly string[]; // routes/surfaces affectées (réelles)
  readonly signals: readonly string[]; // sous-chaînes de codes d'erreur reconnues (surfacedErrors)
  readonly diagnosisKinds?: readonly DiagnosisKind[];
  readonly blockerCategories?: readonly BlockerCategory[];
  readonly refusalCodes?: readonly string[];
  readonly cause: "known" | "unknown";
  readonly officialResolution: string | null; // résolution CERTAINE quand elle existe
  readonly workaround: string | null; // contournement temporaire quand il existe
  readonly resolutionVerification: string | null; // condition OBSERVABLE prouvant la résolution
  readonly escalation: string; // conditions d'escalade
  readonly provenance: string; // preuve/source réelle
  readonly validity?: string | null;
}

export const KNOWN_ISSUES: readonly KnownIssue[] = [
  {
    id: "checkout_payment_declined",
    title: "Paiement refusé ou incomplet au checkout",
    description: "Le paiement peut être refusé (carte refusée) ou bloqué faute de commande/session valide, empêchant la finalisation.",
    category: "payment", severity: "medium", status: "known",
    surfaces: ["/checkout"],
    signals: ["checkout", "payment", "paiement", "declined", "card", "carte", "stripe"],
    diagnosisKinds: ["confirmed_cause", "probable_cause"], blockerCategories: ["environment"],
    cause: "known",
    officialResolution: "Reprendre le paiement avec un moyen de paiement valide (une carte refusée doit être débloquée ou remplacée auprès de la banque).",
    workaround: "Réessayer le paiement ; vérifier le moyen de paiement demandé par la page.",
    resolutionVerification: "Une confirmation de commande s'affiche sur /checkout.",
    escalation: "Escalader si le paiement échoue de façon répétée malgré un moyen de paiement valide.",
    provenance: "nav/route-registry (/checkout : gating agent + session + statut de commande) ; diagnostic BLOC 4 des erreurs de paiement remontées.",
  },
  {
    id: "tenant_membership_suspended",
    title: "Accès entreprise suspendu",
    description: "Le rattachement à l'entreprise est suspendu ; l'accès aux données et actions de l'entreprise est fermé (sécurité).",
    category: "access", severity: "high", status: "known",
    surfaces: ["/profile", "/agents/pierre/use"],
    signals: ["membership_suspended", "suspended"],
    refusalCodes: ["MEMBERSHIP_SUSPENDED"],
    cause: "known",
    officialResolution: null,
    workaround: null,
    resolutionVerification: "L'accès à l'entreprise est rétabli (membership de nouveau actif).",
    escalation: "Toujours : une suspension ne se débloque pas en self-service.",
    provenance: "server/company.ts (MEMBERSHIP_SUSPENDED / UNHEALTHY_COMPANY).",
  },
  {
    id: "tenant_company_unavailable",
    title: "Entreprise momentanément indisponible",
    description: "La résolution de l'entreprise a échoué côté serveur (fail-closed) ; l'accès reste fermé tant qu'elle n'est pas disponible.",
    category: "access", severity: "medium", status: "transient",
    surfaces: ["/profile", "/agents/pierre/use"],
    signals: ["company_unavailable"],
    refusalCodes: ["COMPANY_UNAVAILABLE"],
    cause: "unknown",
    officialResolution: null,
    workaround: "Réessayer dans un instant.",
    resolutionVerification: "La résolution de l'entreprise aboutit.",
    escalation: "Escalader si l'indisponibilité persiste après plusieurs tentatives.",
    provenance: "server/company.ts (fail-closed COMPANY_UNAVAILABLE).",
  },
  {
    id: "pierre_entitlement_lookup_outage",
    title: "Vérification du droit Pierre indisponible",
    description: "La lecture du droit Pierre a échoué (panne de vérification). Ceci n'est JAMAIS interprété comme une absence de droit.",
    category: "entitlement", severity: "medium", status: "transient",
    surfaces: ["/agents/pierre", "/reserver/pierre"],
    signals: ["entitlement_lookup", "lookup_failed", "pierre_access_lookup_failed"],
    diagnosisKinds: ["provider_failure"], blockerCategories: ["entitlement"],
    cause: "unknown",
    officialResolution: null,
    workaround: "Réessayer ; le droit n'est jamais présumé absent pendant une panne de vérification.",
    resolutionVerification: "La vérification du droit Pierre aboutit.",
    escalation: "Escalader si la panne de vérification persiste.",
    provenance: "pierre/access.ts (LOOKUP_FAILED).",
  },
  {
    id: "clonechat_model_outage",
    title: "Service de génération momentanément indisponible",
    description: "Le fournisseur du modèle a été observé indisponible. Une réponse déterministe reste possible entre-temps.",
    category: "provider", severity: "medium", status: "transient",
    surfaces: ["/assistant"],
    signals: ["model_unavailable", "model_outage"],
    diagnosisKinds: ["provider_failure"], blockerCategories: ["provider"],
    cause: "unknown",
    officialResolution: null,
    workaround: "Réessayer dans un instant.",
    resolutionVerification: "Une réponse est générée normalement.",
    escalation: "Escalader si l'indisponibilité persiste longuement.",
    provenance: "brain.ts (modelUnavailable) ; incident outage budget documenté.",
  },
  {
    id: "navigation_unknown_route",
    title: "Page inexistante dans le produit",
    description: "La page indiquée n'existe pas dans le registre canonique des routes.",
    category: "navigation", severity: "low", status: "known",
    surfaces: [],
    signals: ["route_unknown", "not_found", "404"],
    diagnosisKinds: ["route_or_navigation_issue"],
    cause: "known",
    officialResolution: "Rejoindre une route valide du produit ; l'accueil (/) est toujours disponible.",
    workaround: null,
    resolutionVerification: "Vous êtes sur une page listée au registre des routes.",
    escalation: "Escalader uniquement si une route attendue est réellement absente du produit.",
    provenance: "nav/route-registry (getRouteEntry).",
  },
  {
    id: "reservation_before_launch",
    title: "Réservation pas encore ouverte (fenêtre de lancement)",
    description: "La réservation de Pierre est verrouillée selon la phase de lancement (avant ouverture / fenêtre / fermée).",
    category: "product", severity: "low", status: "known",
    surfaces: ["/reserver/pierre"],
    signals: ["reservation_before_launch", "reservation_closed", "founder_gated", "before_launch"],
    cause: "known",
    officialResolution: null,
    workaround: "Voir la démo (/demo/pierre) en attendant l'ouverture de la fenêtre de réservation.",
    resolutionVerification: "La page de réservation (/reserver/pierre) est ouverte (fenêtre active).",
    escalation: "Escalader si la fenêtre devrait être ouverte mais reste fermée.",
    provenance: "nav/route-registry (/reserver/pierre : before_launch / window / closed) ; product-truth (lancement officiel 8 septembre 2026).",
    validity: "Lancement officiel le 8 septembre 2026 ; réservations ouvertes avant cette date.",
  },
  {
    id: "pierre_human_validation_required",
    title: "Pierre prépare, un humain valide (autonomie totale non supportée)",
    description: "Par conception, aucune action n'est exécutée sans validation humaine ; l'autonomie totale n'est pas une capacité du produit.",
    category: "product", severity: "low", status: "by_design",
    surfaces: ["/assistant", "/agents/pierre/use"],
    signals: ["pierre_autonomy_not_supported", "autonomy", "full_autonomy"],
    cause: "known",
    officialResolution: null,
    workaround: null,
    resolutionVerification: null,
    escalation: "Aucune : c'est une limite produit assumée, pas un bug.",
    provenance: "hr-canon / gouvernance (planchers human-only) ; P14 (MUST_NOT DRH autonome complet).",
  },
  {
    id: "voice_transcription_outage",
    title: "Transcription vocale indisponible",
    description: "La transcription audio a échoué ou expiré. La dictée peut être retentée ; le format audio doit être supporté.",
    category: "voice", severity: "medium", status: "transient",
    surfaces: ["/assistant"],
    signals: ["transcription_failed", "transcription_timeout"],
    cause: "unknown",
    officialResolution: null,
    workaround: "Réessayer la dictée ; vérifier que le format audio est supporté.",
    resolutionVerification: "La dictée produit un transcript.",
    escalation: "Escalader si la transcription échoue de façon persistante sur un audio valide.",
    provenance: "api/assistant/transcribe (TRANSCRIPTION_FAILED / TRANSCRIPTION_TIMEOUT).",
  },
  {
    id: "voice_tts_unavailable",
    title: "Lecture vocale indisponible",
    description: "La synthèse vocale (TTS) est indisponible. La réponse reste disponible en texte (fallback).",
    category: "voice", severity: "low", status: "known",
    surfaces: ["/assistant"],
    signals: ["tts_unavailable", "tts_failed", "tts_timeout"],
    cause: "known",
    officialResolution: null,
    workaround: "La réponse reste disponible en texte (fallback systématique).",
    resolutionVerification: "La lecture vocale fonctionne de nouveau.",
    escalation: "Escalader uniquement si le fallback texte est lui aussi absent.",
    provenance: "voice/pipeline (fallback TTS BLOC 6).",
  },
] as const;

export function getKnownIssue(id: string): KnownIssue | null {
  return KNOWN_ISSUES.find((i) => i.id === id) ?? null;
}

/**
 * Fait correspondre une situation RÉELLE à un problème connu. Priorité : signal explicite dans
 * surfacedErrors (le plus spécifique), puis (kind de diagnostic + catégorie de blocage), puis code
 * de refus tenant. Aucune correspondance sur du texte libre. null si rien ne correspond.
 */
export function matchKnownIssue(ctx: CloneChatContext, diagnosis: CloneChatDiagnosis): KnownIssue | null {
  const errs = ctx.surfacedErrors.map((e) => e.toLowerCase());

  // 1) Signal explicite.
  for (const issue of KNOWN_ISSUES) {
    if (issue.signals.some((sig) => errs.some((e) => e.includes(sig)))) return issue;
  }
  // 2) Kind de diagnostic (+ catégorie de blocage si déclarée).
  for (const issue of KNOWN_ISSUES) {
    if (!issue.diagnosisKinds || !issue.diagnosisKinds.includes(diagnosis.kind)) continue;
    if (issue.blockerCategories && !issue.blockerCategories.includes(diagnosis.blockerCategory)) continue;
    return issue;
  }
  // 3) Code de refus tenant.
  const code = ctx.tenant.refusalCode;
  if (code) {
    for (const issue of KNOWN_ISSUES) {
      if (issue.refusalCodes && issue.refusalCodes.includes(code)) return issue;
    }
  }
  return null;
}
