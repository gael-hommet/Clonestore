// src/lib/clonestore/product-technologies/t2/clonepolicy-product-tech.ts
// T2 — ClonePolicy : transforme les règles d'entreprise en comportement machine exécutable.
// Règles par type de tâche/artefact/canal/temps, autonomie, escalade, rôle/destination.
// Ne stocke pas la mémoire brute (CloneADN), n'exécute rien, ne remplace pas CloneGuard.
// FAIL-CLOSED : sans règle explicite, les défauts sûrs s'appliquent (validation requise
// pour toute sortie ; autonomie plafonnée).

import { defineProductTechnologyContract, type ProductTechnologyContract } from "./product-technology-contract";
import { PRODUCT_TECHNOLOGY_FALLBACKS } from "./product-technology-fallbacks";
import type { AutonomyLevel } from "./product-technology-types";

export interface ClonePolicyRule {
  readonly ruleId: string;
  readonly appliesTo: {
    readonly taskType?: string;
    readonly artifactType?: string;
    readonly channel?: string;
    readonly requesterRole?: string;
  };
  readonly requiresValidation?: boolean;
  readonly autonomyCap?: AutonomyLevel;
  readonly allowedChannels?: readonly string[];
  readonly timeWindow?: { readonly notBeforeHour?: number; readonly notAfterHour?: number };
  readonly escalateTo?: string;
}

export interface ClonePolicyActionInput {
  readonly taskType?: string;
  readonly artifactType?: string;
  readonly channel?: string;
  readonly requesterRole?: string;
  readonly requestedAutonomy?: AutonomyLevel;
  readonly hourOfDay?: number;
}

export interface ClonePolicyInput {
  readonly rules?: readonly ClonePolicyRule[];
  readonly action?: ClonePolicyActionInput;
}

export interface ClonePolicyDecision {
  readonly artifactKind: "clonepolicy_decision";
  readonly applicableRuleIds: readonly string[];
  readonly requiresValidation: boolean;
  readonly autonomyCap: AutonomyLevel;
  readonly allowedChannels: readonly string[];
  readonly timeWindowOk: boolean;
  readonly escalateTo: string | null;
  readonly decision: "allow_prepare" | "require_validation" | "escalate" | "block";
  readonly policySource: "company_rules_local";
  readonly reasons: readonly string[];
  readonly executed: false;
  readonly replacesCloneGuard: false;
}

/** Défauts sûrs — appliqués quand l'entreprise n'a pas (encore) de règle explicite. */
const SAFE_DEFAULT_CAP: AutonomyLevel = "execute_with_validation";
const EXTERNAL_CHANNELS = ["external_email", "signature", "sms", "phone"];

const AUTONOMY_ORDER: readonly AutonomyLevel[] = ["human_only", "prepare_only", "suggest", "execute_with_validation", "autonomous_safe"];
/** Normalise un niveau d'autonomie VENANT DE DONNÉES (règles JSON) : inconnu → human_only (fail-closed). Pur. */
export function normalizeAutonomyLevel(value: unknown): AutonomyLevel {
  return (AUTONOMY_ORDER as readonly string[]).includes(value as string) ? (value as AutonomyLevel) : "human_only";
}
const autonomyRank = (a: AutonomyLevel): number => AUTONOMY_ORDER.indexOf(a);
/** Plafonne une autonomie demandée par un cap (le plus restrictif gagne ; entrées normalisées fail-closed). Pur. */
export function capAutonomy(requested: AutonomyLevel, cap: AutonomyLevel): AutonomyLevel {
  const r = normalizeAutonomyLevel(requested);
  const c = normalizeAutonomyLevel(cap);
  return autonomyRank(r) <= autonomyRank(c) ? r : c;
}

export const clonePolicyProductTech: ProductTechnologyContract<ClonePolicyInput, ClonePolicyDecision> =
  defineProductTechnologyContract({
    id: "clonepolicy",
    name: "ClonePolicy",
    definition: "Transforme les règles d'entreprise en comportement machine exécutable (tâches, artefacts, canaux, temps, autonomie, escalade, rôles).",
    role: "Faire des règles de l'entreprise un comportement machine réel.",
    answersQuestion: "Comment les règles de l'entreprise deviennent-elles un vrai comportement machine ?",
    contains: ["règles par type de tâche", "règles par type d'artefact", "règles d'autonomie", "règles de validation", "règles de canal", "règles de temps", "règles d'escalade", "règles rôle/destination/contexte"],
    doesNotContain: ["mémoire brute d'entreprise (CloneADN)", "exécution d'actions", "remplacement de CloneGuard"],
    dependencies: [],
    status: "local_safe_ready",
    mode: "local_safe",
    safeFallback: PRODUCT_TECHNOLOGY_FALLBACKS.clonepolicy,
    liveBlockedReason: null,
    requiresValidation: false, // une décision de politique n'est pas un effet
    commercialClaimAllowed: "Les règles de l'entreprise (validation, canaux, horaires, autonomie, escalade) deviennent un comportement machine appliqué à chaque action.",
    commercialClaimForbidden: ["conformité réglementaire garantie", "application sans supervision humaine"],
    prepareArtifact: (input) => {
      const action = input?.action ?? {};
      const rules = input?.rules ?? [];
      const reasons: string[] = [];

      const applicable = rules.filter((r) => {
        const a = r.appliesTo ?? {};
        return (
          (a.taskType === undefined || a.taskType === action.taskType) &&
          (a.artifactType === undefined || a.artifactType === action.artifactType) &&
          (a.channel === undefined || a.channel === action.channel) &&
          (a.requesterRole === undefined || a.requesterRole === action.requesterRole)
        );
      });

      // Validation : une règle explicite peut l'imposer ; les canaux externes l'imposent TOUJOURS (fail-closed).
      const channel = (action.channel ?? "internal").toLowerCase();
      const externalChannel = EXTERNAL_CHANNELS.includes(channel);
      const ruleRequiresValidation = applicable.some((r) => r.requiresValidation === true);
      const requiresValidation = ruleRequiresValidation || externalChannel;
      if (externalChannel) reasons.push(`Canal externe « ${channel} » → validation humaine obligatoire (non désactivable).`);
      if (ruleRequiresValidation) reasons.push("Une règle d'entreprise impose la validation.");

      // Autonomie : le cap le plus restrictif gagne ; niveaux inconnus (données) → human_only ; défaut sûr sinon.
      const caps = applicable.map((r) => r.autonomyCap).filter((c): c is AutonomyLevel => !!c).map(normalizeAutonomyLevel);
      const cap = caps.length > 0 ? caps.reduce((min, c) => (autonomyRank(c) < autonomyRank(min) ? c : min)) : SAFE_DEFAULT_CAP;

      // Canaux permis : intersection des règles, sinon interne seul par défaut.
      const channelLists = applicable.map((r) => r.allowedChannels).filter((l): l is readonly string[] => !!l && l.length > 0);
      const allowedChannels = channelLists.length > 0
        ? channelLists.reduce((acc, l) => acc.filter((c) => l.includes(c)))
        : ["internal", "cockpit"];

      // Fenêtre temporelle. FAIL-CLOSED : une règle horaire existe mais l'heure est inconnue
      // → la validation humaine devient obligatoire (jamais un contournement par omission).
      const windows = applicable.map((r) => r.timeWindow).filter((w): w is NonNullable<ClonePolicyRule["timeWindow"]> => !!w);
      const hour = typeof action.hourOfDay === "number" ? action.hourOfDay : null;
      let hourUnknownWithRules = false;
      if (windows.length > 0 && hour === null) {
        hourUnknownWithRules = true;
        reasons.push("Règle horaire présente mais heure inconnue — validation humaine forcée (fail-closed).");
      }
      const timeWindowOk = hour === null || windows.every((w) =>
        (w.notBeforeHour === undefined || hour >= w.notBeforeHour) && (w.notAfterHour === undefined || hour <= w.notAfterHour));
      if (!timeWindowOk) reasons.push("Hors fenêtre temporelle autorisée par les règles.");

      const escalateTo = applicable.map((r) => r.escalateTo).find((e): e is string => !!e) ?? null;
      // Allowlist EXPLICITE = autoritaire (un canal externe hors liste est BLOQUÉ, pas seulement validé) ;
      // sans règle de canal, l'externe reste permis-mais-validé (défaut sûr).
      const channelAllowed = channelLists.length > 0
        ? allowedChannels.includes(channel)
        : (allowedChannels.includes(channel) || externalChannel);

      const effectiveRequiresValidation = requiresValidation || hourUnknownWithRules;
      const decision: ClonePolicyDecision["decision"] =
        !timeWindowOk ? "block"
        : !channelAllowed ? "block"
        : effectiveRequiresValidation ? "require_validation"
        : escalateTo ? "escalate"
        : "allow_prepare";
      if (!channelAllowed) reasons.push(`Canal « ${channel} » non autorisé par les règles.`);
      if (reasons.length === 0) reasons.push("Défauts sûrs appliqués — préparation locale permise.");

      return {
        kind: "ok",
        artifact: {
          artifactKind: "clonepolicy_decision",
          applicableRuleIds: applicable.map((r) => r.ruleId),
          requiresValidation: effectiveRequiresValidation,
          autonomyCap: cap,
          allowedChannels,
          timeWindowOk,
          escalateTo,
          decision,
          policySource: "company_rules_local",
          reasons,
          executed: false,
          replacesCloneGuard: false,
        },
      };
    },
  });
