// src/lib/clonestore/product-technologies/t2/cloneguard-product-tech.ts
// T2 — CloneGuard : gouvernance, risque, validation et refus intelligent.
// Décide : exécutable ? préparable seulement ? à valider ? à bloquer ? à refuser ? et POURQUOI.
// FAIL-CLOSED : en cas de doute → require_validation ; danger → block/refuse.
// N'exécute rien ; ne produit AUCUNE décision légale finale ; ne remplace pas la revue externe.

import { defineProductTechnologyContract, type ProductTechnologyContract } from "./product-technology-contract";
import { PRODUCT_TECHNOLOGY_FALLBACKS } from "./product-technology-fallbacks";
import { detectSensitiveHrLanguage } from "./cloneos-product-tech";
import type { RiskLevel } from "./product-technology-types";

export type CloneGuardActionDecision = "allow_prepare" | "require_validation" | "block" | "refuse";

export interface CloneGuardActionInput {
  readonly kind?: string;         // ex. "prepare_document", "draft_email", "send_external", "execute_live"
  readonly description?: string;
  readonly artifactType?: string;
  readonly channel?: string;      // ex. "internal", "external_email", "signature"
  readonly requestedAutonomy?: string;
}

export interface CloneGuardInput {
  readonly action?: CloneGuardActionInput;
}

export interface CloneGuardDecision {
  readonly artifactKind: "cloneguard_decision";
  readonly riskLevel: RiskLevel;
  readonly decision: CloneGuardActionDecision;
  readonly reasons: readonly string[];
  readonly humanEscalation: string | null;
  readonly explanation: string;
  /** Invariants : Guard décide de la porte — il n'exécute rien et ne juge pas le droit. */
  readonly executed: false;
  readonly finalLegalDecision: false;
}

const CRITICAL_TERMS: readonly string[] = [
  "licenci", "rupture", "signature de contrat", "salaire", "rémunérat", "sanction", "faute grave",
  "paiement", "virement", "juridique", "prud'hom",
  // Euphémismes FR + anglais + allemand (marché CH) — la criticité ne dépend pas de la langue.
  "mettre fin au contrat", "solde de tout compte", "terminat", "dismiss", "fire ", "layoff",
  "severance", "salary", "payroll", "final decision", "kündig", "entlass",
];
const LIVE_EFFECT_KINDS: readonly string[] = ["execute_live", "send_live", "sign_live", "call_live", "pay_live"];
// Mot « live » en segment isolé (évite le faux positif de-LIVE-r).
const LIVE_KIND_PATTERN = /(^|_)live(_|$)/;
// Finalité de décision exprimée dans le CONTENU (pas seulement le kind, contrôlé par l'appelant).
const DECISION_FINALITY_PATTERN = /(décision finale|final decision|décide de|décider de|approuve définitivement|exécute (la|le) (rupture|licenciement|sanction))/i;

export const cloneGuardProductTech: ProductTechnologyContract<CloneGuardInput, CloneGuardDecision> =
  defineProductTechnologyContract({
    id: "cloneguard",
    name: "CloneGuard",
    definition: "La couche de gouvernance, risque, validation et refus intelligent de CloneStore.",
    role: "Décider ce qui peut être exécuté, préparé sans envoi, validé, bloqué ou refusé — et expliquer pourquoi.",
    answersQuestion: "Le système peut-il aller plus loin, et sous quelles conditions ?",
    contains: ["classification de risque normal/sensitive/critical", "décision allow_prepare/require_validation/block/refuse", "raison d'escalade humaine", "explication"],
    doesNotContain: ["exécution", "décision légale finale", "remplacement de la revue juridique externe"],
    dependencies: ["clonepolicy", "clonetrust"],
    status: "local_safe_ready",
    mode: "local_safe",
    safeFallback: PRODUCT_TECHNOLOGY_FALLBACKS.cloneguard,
    liveBlockedReason: null,
    requiresValidation: false, // une décision de porte n'est pas un effet — le refus est immédiat
    commercialClaimAllowed: "Chaque action passe une porte de gouvernance qui classe le risque, impose la validation humaine et sait refuser — avec explication.",
    commercialClaimForbidden: ["conformité légale garantie", "décision juridique automatique"],
    prepareArtifact: (input) => {
      const action = input?.action ?? {};
      const kind = (action.kind ?? "").trim().toLowerCase();
      const text = `${action.description ?? ""} ${action.artifactType ?? ""}`.toLowerCase();
      const channel = (action.channel ?? "internal").toLowerCase();
      const reasons: string[] = [];

      // 1) Toute demande d'effet LIVE est refusée en T2 (production OFF, providers non vérifiés).
      if (LIVE_EFFECT_KINDS.some((k) => kind === k) || LIVE_KIND_PATTERN.test(kind)) {
        return {
          kind: "ok",
          artifact: {
            artifactKind: "cloneguard_decision",
            riskLevel: "critical",
            decision: "refuse",
            reasons: ["Effet live demandé — interdit en T2 (production OFF, aucun provider vérifié)."],
            humanEscalation: "Seul l'owner peut ouvrir un chemin live (attestation externe + P10).",
            explanation: "CloneGuard refuse tout effet live : le système prépare, l'humain (et les portes P10/P15.1) décident.",
            executed: false,
            finalLegalDecision: false,
          },
        };
      }

      // 2) Classification de risque.
      let riskLevel: RiskLevel = "normal";
      if (CRITICAL_TERMS.some((t) => text.includes(t) || kind.includes(t))) {
        riskLevel = "critical";
        reasons.push("Termes critiques détectés (décision RH/financière/juridique potentielle).");
      } else if (detectSensitiveHrLanguage(text) || channel.startsWith("external") || channel === "signature") {
        riskLevel = "sensitive";
        reasons.push(channel.startsWith("external") || channel === "signature"
          ? `Canal sensible « ${channel} » (sortie vers l'extérieur).`
          : "Langage RH sensible détecté.");
      } else {
        reasons.push("Aucun signal critique/sensible — préparation locale autorisée.");
      }

      // 3) Décision fail-closed. Le REFUS critique est joignable depuis le CONTENU
      //    (finalité de décision dans la description), pas seulement depuis le kind.
      const decisionFinality = kind.includes("decide") || kind.includes("final") || DECISION_FINALITY_PATTERN.test(text);
      const decision: CloneGuardActionDecision =
        riskLevel === "critical" ? (decisionFinality ? "refuse" : "require_validation")
        : riskLevel === "sensitive" ? "require_validation"
        : "allow_prepare";
      if (decision === "refuse") reasons.push("Les décisions finales sensibles sont HUMAN_ONLY — jamais automatisées.");

      return {
        kind: "ok",
        artifact: {
          artifactKind: "cloneguard_decision",
          riskLevel,
          decision,
          reasons,
          humanEscalation: riskLevel === "normal" ? null : "Escalade au responsable humain : risque " + riskLevel + ".",
          explanation:
            decision === "allow_prepare" ? "Préparation locale permise ; tout envoi/effet restera soumis à validation."
            : decision === "require_validation" ? "Préparation permise, mais AUCUN usage sans validation humaine explicite."
            : "Action refusée : ce niveau de décision appartient à l'humain (et, pour le droit, à la revue externe).",
          executed: false,
          finalLegalDecision: false,
        },
      };
    },
  });
