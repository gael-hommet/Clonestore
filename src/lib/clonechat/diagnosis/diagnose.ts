// src/lib/clonechat/diagnosis/diagnose.ts
//
// Cœur DÉTERMINISTE du diagnostic. Prend un CloneContext (BLOC 3) déjà assemblé depuis les sources
// réelles + (optionnellement) la décision du Brain (BLOC 2) et l'indisponibilité provider réellement
// observée. Applique un ordre de priorité déterministe et produit un CloneChatDiagnosis honnête :
//   - il ne devine jamais un état, une erreur, une permission, un tenant, ni un droit ;
//   - il distingue cause CONFIRMÉE / PROBABLE / contexte insuffisant / panne provider / sécurité
//     tenant / prérequis manquant / permission refusée / problème de route / escalade inconnue ;
//   - il n'annonce jamais une résolution réussie et ne recommande qu'une route RÉELLE (registre).
// Aucune donnée inter-tenant n'entre dans le diagnostic (il raisonne en catégories/étapes/routes,
// jamais en identifiants d'entreprise).

import { getRouteEntry } from "@/lib/nav/route-registry";
import { prerequisiteCta, type CloneChatPrerequisite } from "@/lib/clonechat/server/universal-access";
import type { BrainDecision } from "@/lib/clonechat/brain";
import type { CloneChatContext } from "@/lib/clonechat/context";
import {
  CLONECHAT_DIAGNOSIS_VERSION, type CloneChatDiagnosis, type BlockerCategory,
  type DiagnosisUnblockAction, type CauseCertainty, type DiagnosisConfidence,
} from "./types";

export interface DiagnoseInput {
  /** Décision du Brain pour cette même demande (fournit le mode et le refus de gouvernance réels). */
  readonly brainDecision?: BrainDecision;
  /** Le provider modèle a-t-il été RÉELLEMENT observé indisponible pour ce tour ? */
  readonly modelUnavailable?: boolean;
}

// ── Helpers déterministes ─────────────────────────────────────────────────────

function realRoute(path: string | null): string | null {
  return path && getRouteEntry(path) ? path : null;
}

/** Action de déblocage réelle pour un prérequis (route validée via le registre, jamais inventée). */
function unblockForPrerequisite(p: CloneChatPrerequisite): DiagnosisUnblockAction {
  const cta = prerequisiteCta([p]);
  const id = p === "authentication" ? "authenticate" : p === "active_company" ? "select_company" : "activate_pierre";
  const label = cta?.label ?? (p === "authentication" ? "Se connecter" : p === "active_company" ? "Ajouter une entreprise" : "Activer Pierre");
  return { id, label, route: cta?.route ?? null };
}

/** Support humain : route RÉELLE si elle existe, jamais un lien mort. */
function supportAction(): DiagnosisUnblockAction {
  return { id: "contact_support", label: "Contacter le support", route: realRoute("/questions") };
}

/** Étape exacte + catégorie pour un prérequis manquant. */
const PREREQ_STEP: Record<CloneChatPrerequisite, { step: string; category: BlockerCategory }> = {
  authentication: { step: "connexion requise (vous n'êtes pas identifié)", category: "permission" },
  active_company: { step: "entreprise active requise (aucune entreprise résolue)", category: "tenant" },
  pierre_entitlement: { step: "activation de Pierre requise (droit non actif)", category: "entitlement" },
};

// ── Classification des erreurs RÉELLEMENT présentes (surfacedErrors) ───────────
// On ne fabrique aucune sémantique : la classification est dérivée des mots littéraux de l'id, et
// l'id brut est TOUJOURS cité. Un token auto-descriptif (declined/denied/expired/failed…) rend la
// cause CERTAINE ; un simple domaine sans token auto-descriptif ne rend la cause que PROBABLE.
const SELF_DESCRIPTIVE = /\b(declined|denied|refused|refuse|expired|expire|failed|failure|invalid|timeout|rejected|insufficient|not_found|notfound|missing)\b/;

interface SurfacedClass {
  readonly category: BlockerCategory;
  readonly observed: string;
  readonly rootCause: string;
  readonly route: string | null;
  readonly unblock: readonly DiagnosisUnblockAction[];
}

function classifySurfacedError(id: string): SurfacedClass | null {
  const e = id.toLowerCase();
  if (/(checkout|payment|paiement|\bpay\b|card|carte|stripe)/.test(e)) {
    const r = realRoute("/checkout");
    return {
      category: "environment",
      observed: `Une erreur de paiement est présente sur la page (${id}).`,
      rootCause: `La finalisation de la commande est bloquée à l'étape paiement (erreur observée : ${id}).`,
      route: r,
      unblock: r ? [{ id: "retry_checkout", label: "Reprendre le paiement", route: r }] : [],
    };
  }
  if (/(auth|session|login|token|unauthenticated|unauthorized|401|403)/.test(e)) {
    const r = realRoute("/login");
    return {
      category: "permission",
      observed: `Un problème de session ou d'authentification est présent (${id}).`,
      rootCause: `La session n'est pas (ou plus) valide (erreur observée : ${id}).`,
      route: r,
      unblock: r ? [{ id: "authenticate", label: "Se reconnecter", route: r }] : [],
    };
  }
  if (/(tenant|company|entreprise|membership|member)/.test(e)) {
    return {
      category: "tenant",
      observed: `Un problème d'accès à l'entreprise est présent (${id}).`,
      rootCause: `L'accès à l'entreprise est en défaut (erreur observée : ${id}).`,
      route: null,
      unblock: [supportAction()],
    };
  }
  if (/(entitlement|pierre|order|commande|subscription|abonnement)/.test(e)) {
    const r = realRoute("/reserver/pierre");
    return {
      category: "entitlement",
      observed: `Un problème lié au droit Pierre est présent (${id}).`,
      rootCause: `Le droit d'utilisation de Pierre est en défaut (erreur observée : ${id}).`,
      route: r,
      unblock: r ? [{ id: "activate_pierre", label: "Vérifier / activer Pierre", route: r }] : [],
    };
  }
  return null; // erreur opaque : jamais de cause inventée → traitée en escalade
}

// ── Constructeurs de diagnostic ───────────────────────────────────────────────

function base(): Pick<CloneChatDiagnosis, "version"> {
  return { version: CLONECHAT_DIAGNOSIS_VERSION };
}

function noBlocker(): CloneChatDiagnosis {
  return Object.freeze({
    ...base(), kind: "no_blocker", blocked: false,
    observedProblem: null, rootCause: null, causeCertainty: "none", confidence: "high",
    evidence: Object.freeze(["no_blocking_signal"]), missingInformation: Object.freeze([]),
    blockedStep: null, missingPrerequisites: Object.freeze([]), blockerCategory: "none",
    unblockActions: Object.freeze([]), recommendedRoute: null,
    requiresClarification: false, clarificationQuestion: null, requiresEscalation: false,
  });
}

function make(d: Omit<CloneChatDiagnosis, "version" | "blocked"> & { blocked?: boolean }): CloneChatDiagnosis {
  return Object.freeze({
    ...base(),
    blocked: d.kind !== "no_blocker",
    kind: d.kind,
    observedProblem: d.observedProblem,
    rootCause: d.rootCause,
    causeCertainty: d.causeCertainty,
    confidence: d.confidence,
    evidence: Object.freeze([...d.evidence]),
    missingInformation: Object.freeze([...d.missingInformation]),
    blockedStep: d.blockedStep,
    missingPrerequisites: Object.freeze([...d.missingPrerequisites]),
    blockerCategory: d.blockerCategory,
    unblockActions: Object.freeze([...d.unblockActions]),
    recommendedRoute: d.recommendedRoute,
    requiresClarification: d.requiresClarification,
    clarificationQuestion: d.clarificationQuestion,
    requiresEscalation: d.requiresEscalation,
  });
}

// ── Moteur ─────────────────────────────────────────────────────────────────────

/**
 * Produit le diagnostic pour une demande, à partir du contexte réel. Ordre de priorité déterministe.
 * `confidence`/`causeCertainty` reflètent la FORCE des preuves réelles, jamais une supposition.
 */
export function diagnoseCloneChat(ctx: CloneChatContext, input: DiagnoseInput = {}): CloneChatDiagnosis {
  const brain = input.brainDecision;
  const modelUnavailable = input.modelUnavailable === true;
  const mode = brain?.mode ?? null;
  const isDiagnostic = mode === "diagnose" || mode === "escalate";

  // ── P1. Gouvernance / injection : refus de permission, JAMAIS reclassé en « prérequis à corriger ».
  if (brain?.requestedAction?.refusedReason === "governance_bypass_or_injection") {
    return make({
      kind: "permission_denied",
      observedProblem: "La demande cherche à contourner la gouvernance ou la validation obligatoire.",
      rootCause: "L'action demandée n'est pas autorisée : elle contournerait la validation humaine obligatoire (gouvernance CloneStore).",
      causeCertainty: "confirmed", confidence: "high",
      evidence: ["governance_bypass_or_injection"], missingInformation: [],
      blockedStep: "demande refusée par la gouvernance",
      missingPrerequisites: [], blockerCategory: "permission",
      unblockActions: [], recommendedRoute: null,
      requiresClarification: false, clarificationQuestion: null, requiresEscalation: false,
    });
  }

  // ── P2. Défaillance de sécurité tenant (suspension / indisponibilité) : fail-closed.
  if (ctx.tenant.securityFailure) {
    const code = ctx.tenant.refusalCode;
    const suspended = code === "MEMBERSHIP_SUSPENDED";
    return make({
      kind: "tenant_security_failure",
      observedProblem: suspended
        ? "L'accès à l'entreprise est suspendu."
        : "L'accès à l'entreprise est momentanément indisponible.",
      rootCause: suspended
        ? "Le rattachement à l'entreprise est suspendu : l'accès aux données et actions de l'entreprise est fermé (sécurité)."
        : "La résolution de l'entreprise a échoué côté serveur (fail-closed) : l'accès reste fermé tant que l'entreprise n'est pas disponible.",
      causeCertainty: "confirmed", confidence: "high",
      evidence: ["tenant.securityFailure", code ?? "tenant_security_failure"],
      missingInformation: suspended ? [] : ["disponibilité du service entreprise (réessayer plus tard)"],
      blockedStep: "accès entreprise refusé (sécurité)",
      missingPrerequisites: [], blockerCategory: "tenant",
      unblockActions: [supportAction()], recommendedRoute: realRoute("/questions"),
      requiresClarification: false, clarificationQuestion: null,
      requiresEscalation: suspended, // une suspension ne se débloque pas seul → humain ; une panne = réessayer
    });
  }

  // ── P3. Erreurs RÉELLEMENT présentes sur la page.
  if (ctx.surfacedErrors.length > 0) {
    const recognized = ctx.surfacedErrors
      .map((id) => ({ id, cls: classifySurfacedError(id) }))
      .find((x) => x.cls !== null) as { id: string; cls: SurfacedClass } | undefined;

    if (recognized) {
      // Normalise les séparateurs (_ et -) en espaces : sinon `\b` ne délimite pas les tokens
      // (l'underscore est un caractère de mot) et « checkout_declined » ne serait jamais reconnu.
      const normalizedId = recognized.id.toLowerCase().replace(/[^a-z0-9]+/g, " ");
      const certainty: CauseCertainty = SELF_DESCRIPTIVE.test(normalizedId) ? "confirmed" : "probable";
      const confidence: DiagnosisConfidence = certainty === "confirmed" ? "high" : "medium";
      return make({
        kind: certainty === "confirmed" ? "confirmed_cause" : "probable_cause",
        observedProblem: recognized.cls.observed,
        rootCause: recognized.cls.rootCause,
        causeCertainty: certainty, confidence,
        evidence: [`surfaced_error:${recognized.id}`],
        missingInformation: certainty === "confirmed" ? [] : ["détail exact de l'erreur pour confirmer la cause"],
        blockedStep: recognized.cls.observed,
        missingPrerequisites: [], blockerCategory: recognized.cls.category,
        unblockActions: recognized.cls.unblock, recommendedRoute: recognized.cls.route,
        requiresClarification: false, clarificationQuestion: null, requiresEscalation: false,
      });
    }

    // Erreur(s) opaque(s) uniquement : présence CERTAINE, cause NON identifiable → escalade honnête.
    return make({
      kind: "unknown_requires_escalation",
      observedProblem: `Une ou plusieurs erreurs sont présentes sur la page (${ctx.surfacedErrors.join(", ")}).`,
      rootCause: null, causeCertainty: "none", confidence: "low",
      evidence: ctx.surfacedErrors.map((e) => `surfaced_error:${e}`),
      missingInformation: [`signification des erreurs : ${ctx.surfacedErrors.join(", ")}`],
      blockedStep: "erreur présente non identifiable",
      missingPrerequisites: [], blockerCategory: "none",
      unblockActions: [supportAction()], recommendedRoute: realRoute("/questions"),
      requiresClarification: false, clarificationQuestion: null, requiresEscalation: true,
    });
  }

  // ── P4. Prérequis manquants (analyse par « porte la plus proche » : auth → entreprise → Pierre).
  const missing = ctx.missingPrerequisites;

  if (missing.includes("authentication")) {
    // Anonyme sur une demande qui exige un compte : prérequis CERTAIN.
    return prerequisiteDiagnosis(ctx, "authentication");
  }

  if (missing.includes("active_company")) {
    // Distinction d'HONNÊTETÉ : refus tenant RÉSOLU (refusalCode présent) = prérequis confirmé ;
    // tenant NON résolu (refusalCode null alors que l'utilisateur est authentifié) = contexte
    // insuffisant — on n'affirme JAMAIS « pas d'entreprise » quand on ne l'a pas vérifié.
    if (ctx.tenant.refusalCode === null && ctx.viewer.authenticated) {
      return make({
        kind: "insufficient_context",
        observedProblem: "Impossible de déterminer votre entreprise pour cette demande.",
        rootCause: null, causeCertainty: "none", confidence: "low",
        evidence: ["tenant.resolved=false", "tenant.refusalCode=null", "viewer.authenticated=true"],
        missingInformation: ["résolution de l'entreprise (aucune entreprise n'a été résolue pour cette requête)"],
        blockedStep: "résolution de l'entreprise",
        missingPrerequisites: [...missing], blockerCategory: "tenant",
        unblockActions: [unblockForPrerequisite("active_company")],
        recommendedRoute: prerequisiteCta(["active_company"])?.route ?? null,
        requiresClarification: true,
        clarificationQuestion: "Sur quelle entreprise souhaitez-vous travailler ? (ajoutez ou sélectionnez-la)",
        requiresEscalation: false,
      });
    }
    return prerequisiteDiagnosis(ctx, "active_company");
  }

  if (missing.includes("pierre_entitlement")) {
    // Panne de lecture d'entitlement : JAMAIS interprétée comme une absence de droit.
    if (ctx.pierre.lookupFailed) return providerFailure(ctx, "entitlement");
    return prerequisiteDiagnosis(ctx, "pierre_entitlement");
  }

  // ── P5. Provider modèle réellement indisponible (sans autre blocage).
  if (modelUnavailable) return providerFailure(ctx, "provider");

  // ── P6. Route courante inconnue du registre : navigation impossible (rien n'est supposé).
  if (ctx.navigation.routePath && !ctx.navigation.known) {
    return make({
      kind: "route_or_navigation_issue",
      observedProblem: `La page indiquée n'existe pas dans le produit (${ctx.navigation.routePath}).`,
      rootCause: `La route « ${ctx.navigation.routePath} » n'est pas dans le registre canonique des routes.`,
      causeCertainty: "confirmed", confidence: "high",
      evidence: [`route_unknown:${ctx.navigation.routePath}`],
      missingInformation: ["la page réellement recherchée"],
      blockedStep: "navigation vers une page inexistante",
      missingPrerequisites: [], blockerCategory: "route",
      unblockActions: [
        { id: "go_home", label: "Accueil", route: realRoute("/") },
        supportAction(),
      ].filter((a) => a.route !== null),
      recommendedRoute: null, // on n'invente jamais une route de remplacement
      requiresClarification: true,
      clarificationQuestion: "Quelle page cherchez-vous exactement ?",
      requiresEscalation: false,
    });
  }

  // ── P7. Demande de diagnostic sur une route RÉELLE mais VERROUILLÉE : cause PROBABLE via la note
  //        de gating réelle du registre (jamais présentée comme certaine ; on demande l'erreur exacte).
  if (isDiagnostic && ctx.navigation.known && ctx.navigation.status === "gated") {
    const entry = getRouteEntry(ctx.navigation.routePath!);
    const note = entry?.note ?? null;
    return make({
      kind: "probable_cause",
      observedProblem: `La page « ${entry?.label ?? ctx.navigation.routePath} » est verrouillée (accès conditionné).`,
      rootCause: note
        ? `Cause probable : cette page est verrouillée selon ${note}`
        : "Cause probable : cette page est verrouillée par une condition d'accès ; l'élément exact reste à confirmer.",
      causeCertainty: "probable", confidence: "medium",
      evidence: [`route_gated:${ctx.navigation.routePath}`, ...(note ? [`route_note:${note}`] : [])],
      missingInformation: ["le message d'erreur ou l'état exact qui bloque cette page"],
      blockedStep: `accès verrouillé à « ${entry?.label ?? ctx.navigation.routePath} »`,
      missingPrerequisites: [], blockerCategory: "route",
      unblockActions: [{ id: "provide_error", label: "Indiquer le message d'erreur exact", route: null }],
      recommendedRoute: realRoute(ctx.navigation.routePath),
      requiresClarification: true,
      clarificationQuestion: "Quel message ou quelle étape exacte bloque sur cette page ?",
      requiresEscalation: false,
    });
  }

  // ── P8. Escalade explicitement signalée (bug / plantage) sans cause identifiable.
  if (mode === "escalate") {
    return make({
      kind: "unknown_requires_escalation",
      observedProblem: "Un dysfonctionnement est signalé mais aucune cause n'est identifiable depuis le contexte.",
      rootCause: null, causeCertainty: "none", confidence: "low",
      evidence: ["brain.mode=escalate"],
      missingInformation: ["l'action précise, l'étape et le message d'erreur exact"],
      blockedStep: "dysfonctionnement signalé",
      missingPrerequisites: [], blockerCategory: "none",
      unblockActions: [supportAction()], recommendedRoute: realRoute("/questions"),
      requiresClarification: false, clarificationQuestion: null, requiresEscalation: true,
    });
  }

  // ── P9. Demande de diagnostic sans signal concret : contexte insuffisant (on ne devine pas).
  if (isDiagnostic) {
    return make({
      kind: "insufficient_context",
      observedProblem: "Un blocage est évoqué mais aucun signal précis (erreur, étape, prérequis) n'est disponible.",
      rootCause: null, causeCertainty: "none", confidence: "low",
      evidence: ["brain.mode=diagnose", "no_concrete_signal"],
      missingInformation: ["l'action ou l'étape précise qui échoue", "le message d'erreur exact"],
      blockedStep: null,
      missingPrerequisites: [...missing], blockerCategory: "none",
      unblockActions: [{ id: "provide_error", label: "Indiquer l'étape et l'erreur exactes", route: null }],
      recommendedRoute: null,
      requiresClarification: true,
      clarificationQuestion: "Quelle action précise échoue, et quel message d'erreur voyez-vous ?",
      requiresEscalation: false,
    });
  }

  // ── Aucun blocage observé.
  return noBlocker();
}

/** Diagnostic « prérequis manquant » confirmé pour la porte la plus proche. */
function prerequisiteDiagnosis(ctx: CloneChatContext, p: CloneChatPrerequisite): CloneChatDiagnosis {
  const info = PREREQ_STEP[p];
  const cta = prerequisiteCta([p]);
  return make({
    kind: "missing_prerequisite",
    observedProblem: `Cette demande nécessite : ${info.step}.`,
    rootCause: `La demande n'est pas satisfaisable en l'état : ${info.step}.`,
    causeCertainty: "confirmed", confidence: "high",
    evidence: [`missing_prerequisite:${p}`, ...(ctx.tenant.refusalCode ? [`tenant.refusalCode:${ctx.tenant.refusalCode}`] : [])],
    missingInformation: [],
    blockedStep: info.step,
    missingPrerequisites: [...ctx.missingPrerequisites], blockerCategory: info.category,
    unblockActions: ctx.missingPrerequisites.map(unblockForPrerequisite),
    recommendedRoute: cta?.route ?? null,
    requiresClarification: false, clarificationQuestion: null, requiresEscalation: false,
  });
}

/** Panne d'infrastructure : modèle indisponible OU lecture d'entitlement en échec. */
function providerFailure(ctx: CloneChatContext, which: "provider" | "entitlement"): CloneChatDiagnosis {
  if (which === "entitlement") {
    return make({
      kind: "provider_failure",
      observedProblem: "La vérification de votre droit Pierre est momentanément indisponible.",
      rootCause: "La lecture du droit Pierre a échoué (panne de vérification) — ceci n'est JAMAIS interprété comme une absence de droit.",
      causeCertainty: "confirmed", confidence: "medium",
      evidence: ["pierre.lookupFailed"],
      missingInformation: ["le statut réel du droit Pierre (vérification indisponible)"],
      blockedStep: "vérification du droit Pierre",
      missingPrerequisites: [...ctx.missingPrerequisites], blockerCategory: "entitlement",
      unblockActions: [{ id: "retry", label: "Réessayer dans un instant", route: null }],
      recommendedRoute: null,
      requiresClarification: false, clarificationQuestion: null,
      requiresEscalation: false, // réessayer d'abord ; l'escalade n'est pas encore justifiée
    });
  }
  return make({
    kind: "provider_failure",
    observedProblem: "Le service de génération de réponse est momentanément indisponible.",
    rootCause: "Le fournisseur du modèle a été observé indisponible pour ce tour (panne provider).",
    causeCertainty: "confirmed", confidence: "high",
    evidence: ["model_unavailable"],
    missingInformation: [],
    blockedStep: "génération de la réponse",
    missingPrerequisites: [], blockerCategory: "provider",
    unblockActions: [{ id: "retry", label: "Réessayer dans un instant", route: null }],
    recommendedRoute: null,
    requiresClarification: false, clarificationQuestion: null, requiresEscalation: false,
  });
}
