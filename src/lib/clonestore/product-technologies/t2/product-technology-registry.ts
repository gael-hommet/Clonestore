// src/lib/clonestore/product-technologies/t2/product-technology-registry.ts
// T2 — REGISTRE des 14 technologies produit. STATUTS HONNÊTES (règle dure : rien n'est
// « final » sans impl locale sûre + tests + fallback + live bloqué + chemin d'audit).
// Les sourceModules sont des RÉFÉRENCES documentaires (jamais importés) ; les technologies
// T1 consommées sont déclarées (et pour clonetrace/clonevoice, prouvées au runtime).

import type { TechnologyId } from "@/lib/clonestore/technologies/t1";
import type { ProductTechnologyId } from "./product-technology-types";
import { ALL_PRODUCT_TECHNOLOGY_IDS } from "./product-technology-types";
import type { ProductTechnologyContract } from "./product-technology-contract";
import { cloneOSProductTech } from "./cloneos-product-tech";
import { cloneADNProductTech } from "./cloneadn-product-tech";
import { cloneGuardProductTech } from "./cloneguard-product-tech";
import { cloneTraceProductTech } from "./clonetrace-product-tech";
import { cloneVoiceProductTech } from "./clonevoice-product-tech";
import { clonePolicyProductTech } from "./clonepolicy-product-tech";
import { cloneContinuumProductTech } from "./clonecontinuum-product-tech";
import { cloneTrustProductTech } from "./clonetrust-product-tech";
import { cloneReviewProductTech } from "./clonereview-product-tech";
import { cloneSignalsProductTech } from "./clonesignals-product-tech";
import { cloneLearnProductTech } from "./clonelearn-product-tech";
import { cloneBriefProductTech } from "./clonebrief-product-tech";
import { cloneCallProductTech } from "./clonecall-product-tech";
import { cloneRoomProductTech } from "./cloneroom-product-tech";

export const ALL_PRODUCT_TECHNOLOGY_CONTRACTS: Readonly<Record<ProductTechnologyId, ProductTechnologyContract>> = Object.freeze({
  cloneos: cloneOSProductTech,
  cloneadn: cloneADNProductTech,
  cloneguard: cloneGuardProductTech,
  clonetrace: cloneTraceProductTech,
  clonevoice: cloneVoiceProductTech,
  clonepolicy: clonePolicyProductTech,
  clonecontinuum: cloneContinuumProductTech,
  clonetrust: cloneTrustProductTech,
  clonereview: cloneReviewProductTech,
  clonesignals: cloneSignalsProductTech,
  clonelearn: cloneLearnProductTech,
  clonebrief: cloneBriefProductTech,
  clonecall: cloneCallProductTech,
  cloneroom: cloneRoomProductTech,
});

export interface ProductTechnologyRegistryEntry {
  readonly id: ProductTechnologyId;
  readonly contract: ProductTechnologyContract;
  readonly status: ProductTechnologyContract["status"];
  readonly definition: string;
  readonly role: string;
  readonly dependencies: readonly ProductTechnologyId[];
  /** Modules sources réels du repo — références documentaires, JAMAIS importés ici. */
  readonly sourceModules: readonly string[];
  /** Technologies T1 consommées (déclaré pour P16C ; clonetrace/clonevoice prouvées au runtime). */
  readonly t1TechnologiesConsumed: readonly TechnologyId[];
  readonly safeLocalImplementation: string;
  readonly safeFallback: string;
  readonly liveBlockedReason: string | null;
  readonly testsRequired: readonly string[];
  readonly readyForP16A: boolean;
  readonly readyForP16C: boolean;
  readonly claimableNow: string;
  readonly mustNotClaim: readonly string[];
}

interface RegistryMeta {
  readonly sourceModules: readonly string[];
  readonly t1: readonly TechnologyId[];
  readonly safeLocalImplementation: string;
  readonly testsRequired: readonly string[];
}

const META: Readonly<Record<ProductTechnologyId, RegistryMeta>> = {
  cloneos: {
    sourceModules: ["src/lib/clonestore/cloneos/cloneos-command-center.ts", "src/lib/clonestore/cloneos/cloneos-employee-router.ts", "src/components/cloneos/CloneOsAppShell.tsx"],
    t1: ["workflow", "permission", "evidence"],
    safeLocalImplementation: "Planification locale : intention → mission → tâches/dépendances → routage proposé → handoffs → plan de fusion → transitions d'état (needs_validation).",
    testsRequired: ["plan depuis demande brute", "décomposition + dépendances", "routage sans exécution", "pas de décision RH"],
  },
  cloneadn: {
    sourceModules: ["src/lib/clonestore/adn/global-enterprise-memory.ts", "src/lib/clonestore/adn/pierre-adn-bridge.ts", "src/lib/clonestore/empreinte/enterprise-schema.ts"],
    t1: ["memory"],
    safeLocalImplementation: "Profil d'entreprise local (ton/formalité/circuits/formulations) — propositions uniquement, mutationPolicy=proposals_only.",
    testsRequired: ["artefact de style/contexte", "aucune mutation silencieuse"],
  },
  cloneguard: {
    sourceModules: ["src/lib/pierre/v1/mission-service.ts (decideValidationAction — référence)", "src/lib/clonestore/cloneos/cloneos-command-guard.ts"],
    t1: ["permission", "evidence"],
    safeLocalImplementation: "Classification normal/sensitive/critical + décision allow_prepare/require_validation/block/refuse + explication ; refus systématique des effets live.",
    testsRequired: ["classification 3 niveaux", "refus critique non sûr", "aucune décision légale finale"],
  },
  clonetrace: {
    sourceModules: ["src/lib/pierre/hr/audit-trail.ts (référence)", "src/lib/clonestore/cloneos-history/cloneos-history-runtime.ts"],
    t1: ["evidence"],
    safeLocalImplementation: "Événement + liens (mission/tâche/artefacts/validations) + raison + pointeur de reprise ; consomme RÉELLEMENT T1 EvidenceTech.",
    testsRequired: ["événement/timeline", "pointeur de reprise", "consommation T1 evidence"],
  },
  clonevoice: {
    sourceModules: ["src/lib/clonestore/employee-context-registry/employee-context-registry-clonevoice-contract.ts", "src/lib/clonestore/technologies/t1/technology-contracts.ts (voiceTech)"],
    t1: ["voice"],
    safeLocalImplementation: "Nettoyage du parlé + segmentation multi-actions + intentions — sur transcript TEXTE ; consomme RÉELLEMENT T1 VoiceTech (fallback canonique).",
    testsRequired: ["fallback texte autoritaire", "aucune revendication voix live", "segmentation/intentions"],
  },
  clonepolicy: {
    sourceModules: ["src/lib/pierre/v1/tenant-context.ts (requirePermission — référence)", "src/lib/clonestore/adn/rules.ts"],
    t1: ["permission"],
    safeLocalImplementation: "Règles tâche/artefact/canal/temps/rôle + plafond d'autonomie + escalade → décision ; défauts sûrs fail-closed (canal externe = validation obligatoire).",
    testsRequired: ["règles validation/autonomie/canal", "défauts sûrs", "ne remplace pas CloneGuard"],
  },
  clonecontinuum: {
    sourceModules: ["src/lib/pierre/v1/runtime-scheduler.ts (référence)"],
    t1: ["notification"],
    safeLocalImplementation: "Machine d'états de continuité (attentes/reprise/clôture/réouverture) + recommandation de réveil — aucun cron live.",
    testsRequired: ["états de continuité", "aucun scheduler live"],
  },
  clonetrust: {
    sourceModules: ["src/lib/pierre/v1/mission-service.ts (decideValidation/P9.5 autonomy — référence)"],
    t1: ["permission"],
    safeLocalImplementation: "Score + niveau d'autonomie (human_only→autonomous_safe) plafonné par la politique ; critique → human_only toujours.",
    testsRequired: ["prepare_only/human_only pour le sensible", "plafond politique", "jamais critique seul"],
  },
  clonereview: {
    sourceModules: ["src/lib/clonestore/document-style-kit/quality-gates.ts"],
    t1: ["document"],
    safeLocalImplementation: "Relecture locale : ton, placeholders, clarté, contradictions → rapport + version relue + drapeau revue humaine.",
    testsRequired: ["rapport qualité", "drapeau revue humaine", "aucune garantie"],
  },
  clonesignals: {
    sourceModules: ["src/lib/pierre/v1/runtime-scheduler.ts (relances — référence)"],
    t1: ["notification"],
    safeLocalImplementation: "Candidats de déclencheurs (retards/silences/échéances/manques/conditions) — aucun scheduler live, aucun envoi.",
    testsRequired: ["candidats de triggers", "aucun cron/notification live"],
  },
  clonelearn: {
    sourceModules: ["src/lib/clonestore/adn/global-enterprise-memory-validation.ts (référence)"],
    t1: ["memory", "evidence"],
    safeLocalImplementation: "Agrégation d'événements → candidats d'apprentissage (confiance, habitude/exception) — approvalRequired sur chaque candidat, adnMutated=false.",
    testsRequired: ["candidats proposés", "aucune mutation CloneADN"],
  },
  clonebrief: {
    sourceModules: ["src/lib/clonestore/brief/clonebrief-generator.ts", "src/lib/clonestore/brief/clonebrief-sections.ts"],
    t1: ["analytics", "export"],
    safeLocalImplementation: "Brief matin/soir sur FAITS FOURNIS uniquement — préparé ≠ fait, blocages jamais masqués.",
    testsRequired: ["brief sans invention", "préparé jamais présenté comme fait"],
  },
  clonecall: {
    sourceModules: ["(nouveau en T2 — aucune source antérieure)", "src/lib/clonestore/technologies/t1/technology-contracts.ts (voiceTech, notificationTech — références)"],
    t1: ["voice", "notification", "calendar"],
    safeLocalImplementation: "Session d'appel SAFE LOCAL : objectif/préparation/script/transcript texte → intentions/actions → mission CloneOS + Guard + Trace + Continuum + Signals + Brief ; sortant/live BLOQUÉ.",
    testsRequired: ["session locale", "transcript→intentions/actions", "candidat mission", "trace/continuum/signals/brief", "sortant bloqué"],
  },
  cloneroom: {
    sourceModules: ["src/components/cloneroom/CloneRoomConsole.tsx", "src/app/cockpit/room/page.tsx"],
    t1: ["permission", "evidence"],
    safeLocalImplementation: "Coordination de salle : participants + fil → candidats de mission via CloneOS, routage TOUT-via-CloneOS, garde + trace ; pair-à-pair anarchique bloqué.",
    testsRequired: ["artefact de coordination", "fil→mission", "routage via CloneOS (pas de p2p)"],
  },
};

/** Ce qui ne doit JAMAIS être revendiqué, par techno (union avec les interdits du contrat). */
const GLOBAL_MUST_NOT_CLAIM: readonly string[] = [
  "production live", "paiement live", "Stripe live", "signature live", "email live envoyé automatiquement",
];

export function buildProductTechnologyRegistry(): readonly ProductTechnologyRegistryEntry[] {
  return ALL_PRODUCT_TECHNOLOGY_IDS.map((id) => {
    const contract = ALL_PRODUCT_TECHNOLOGY_CONTRACTS[id];
    const meta = META[id];
    // DÉRIVÉ, jamais déclaré à la main : contrat complet + fallback + statut non-missing +
    // live_disabled documenté. Le verdict global reste au command center (sondes réelles).
    const structurallyReady =
      typeof contract.prepare === "function" && typeof contract.validate === "function" &&
      typeof contract.audit === "function" && contract.safeFallback.trim().length > 0 &&
      contract.status !== "missing" &&
      (contract.mode !== "live_disabled" || contract.liveBlockedReason !== null);
    return {
      id,
      contract,
      status: contract.status,
      definition: contract.definition,
      role: contract.role,
      dependencies: contract.dependencies,
      sourceModules: meta.sourceModules,
      t1TechnologiesConsumed: meta.t1,
      safeLocalImplementation: meta.safeLocalImplementation,
      safeFallback: contract.safeFallback,
      liveBlockedReason: contract.liveBlockedReason,
      testsRequired: meta.testsRequired,
      readyForP16A: structurallyReady,
      readyForP16C: structurallyReady,
      claimableNow: contract.commercialClaimAllowed,
      mustNotClaim: [...contract.commercialClaimForbidden, ...GLOBAL_MUST_NOT_CLAIM],
    };
  });
}

const REGISTRY: readonly ProductTechnologyRegistryEntry[] = Object.freeze(
  buildProductTechnologyRegistry().map((e) => Object.freeze(e)),
);

export function listProductTechnologyRegistryEntries(): readonly ProductTechnologyRegistryEntry[] {
  return REGISTRY;
}

export function getProductTechnologyRegistryEntry(id: string): ProductTechnologyRegistryEntry | undefined {
  return REGISTRY.find((e) => e.id === id);
}
