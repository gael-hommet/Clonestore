// src/lib/pierre/v1/ultimate/p16a/canonical-items.ts
// P16A — the CANONICAL 12 Pierre Ultimate items, RECOVERED from the real master source
// (P16_MASTER_SPLIT category "pierre_ultimate", authored in P16.0). We never re-declare the item set:
// `getPierreUltimateItems()` is the single source of truth and `crossCheckCanonicalItems()` fails if this
// module ever drifts from it. Each item carries P16A-only metadata: the Pierre-OWNED behavior expected,
// the real runtime modules reused, the T1/T2 technology needs (for P16C — DECLARED, never wired here),
// the external/live dependency, and the forbidden commercial claim.

import { getPierreUltimateItems, itemById, type P16Item } from "@/lib/clonestore/ultimate/p16-master-split";

export type P16AItemMeta = {
  readonly id: string;                        // MUST match a P16_MASTER_SPLIT pierre_ultimate id
  readonly pierreOwnedBehavior: string;       // what P16A completes locally & safely
  readonly reusedModules: readonly string[];  // real runtime modules reused (no 2nd brain)
  readonly t1Needs: readonly string[];         // real T1 technology ids (P16C wiring)
  readonly t2Needs: readonly string[];         // real T2 product-technology ids (P16C wiring)
  readonly externalDependency: string | null; // live/external blocker (never P16A)
  readonly forbiddenClaim: string;             // the commercial claim that must NEVER be made
  /** Representative HR request used to evidence the Pierre-owned behavior. */
  readonly representativeRequest: string;
  /** Retrieval domain hints for the representative request (real HrDomainId values). */
  readonly domainHints: readonly string[];
};

// P16A metadata, keyed by the canonical master-split id. The SET of keys is asserted equal to the real
// master-split pierre_ultimate ids by crossCheckCanonicalItems() — no invention, no omission.
const META: Readonly<Record<string, Omit<P16AItemMeta, "id">>> = {
  "pierre.mission_depth": {
    pierreOwnedBehavior: "Transformer une demande RH autorisée en mission gouvernée multi-étapes (objectif, tâches, dépendances, validations, critères de complétion) via le compilateur de plan existant — jamais d'exécution sensible autonome.",
    reusedModules: ["cognitive-runtime/plan-generator.ts", "runtime-plan-compiler.ts", "cognitive-runtime/request-interpreter.ts"],
    t1Needs: ["workflow"],
    t2Needs: ["clonecontinuum"],
    externalDependency: null,
    forbiddenClaim: "Exécution autonome d'actes RH sensibles.",
    representativeRequest: "Prépare l'onboarding de Sarah lundi et préviens son manager.",
    domainHints: ["onboarding", "org"],
  },
  "pierre.document_depth": {
    pierreOwnedBehavior: "Préparer un document/avenant/attestation RH gouverné (brouillon → validation humaine), exposer les variables/placeholders et l'absence de garantie légale ; déclarer DocumentTech/ExportTech pour le rendu/export.",
    reusedModules: ["hr-canon/capability-registry.ts", "cloneguard.ts", "autonomy.ts"],
    t1Needs: ["document", "export"],
    t2Needs: ["cloneadn", "clonebrief", "clonereview"],
    externalDependency: null,
    forbiddenClaim: "Contrat/avenant légalement garanti.",
    representativeRequest: "Fais l'avenant de Nora pour mardi.",
    domainHints: ["contract"],
  },
  "pierre.dossier_360": {
    pierreOwnedBehavior: "Exposer les exigences d'un dossier salarié 360 (données requises, timeline, preuves) en lecture gouvernée ; déclarer MemoryTech/EvidenceTech ; jamais le « registre officiel de vérité ».",
    reusedModules: ["hr/employee-file.ts", "cognitive-runtime/operational-memory.ts", "cognitive-runtime/evidence.ts"],
    t1Needs: ["memory", "evidence"],
    t2Needs: ["cloneadn", "clonetrace"],
    externalDependency: null,
    forbiddenClaim: "Registre RH officiel de vérité.",
    representativeRequest: "Montre le dossier complet de Sarah.",
    domainHints: ["employee360"],
  },
  "pierre.onboarding_offboarding": {
    pierreOwnedBehavior: "Dériver la chaîne opérationnelle onboarding/offboarding gouvernée (identification, documents, communications, checklist, relances) depuis les capacités + le contexte société — jamais une séquence universelle hardcodée ; jamais remplacer la décision du manager.",
    reusedModules: ["hr-mission-packs/compiler.ts", "cognitive-runtime/plan-generator.ts", "hr-canon/capability-registry.ts"],
    t1Needs: ["workflow", "notification", "document"],
    t2Needs: ["clonebrief"],
    externalDependency: null,
    forbiddenClaim: "Remplacement des décisions du manager.",
    representativeRequest: "Prépare le départ de Marc.",
    domainHints: ["offboarding", "onboarding"],
  },
  "pierre.absences_prepayroll": {
    pierreOwnedBehavior: "Préparer les éléments variables de pré-paie (préparation uniquement, validés avant toute transmission) — jamais un moteur de paie/DSN ; déclarer DocumentTech/ExportTech.",
    reusedModules: ["hr-canon/capability-registry.ts", "autonomy.ts", "cloneguard.ts"],
    t1Needs: ["document", "export"],
    t2Needs: [],
    externalDependency: "Provider SIRH/paie live (transmission) — bloqué.",
    forbiddenClaim: "Moteur de paie / DSN.",
    representativeRequest: "Prépare les éléments de pré-paie.",
    domainHints: ["absence", "payroll"],
  },
  "pierre.interview_perf_training": {
    pierreOwnedBehavior: "Préparer convocations, trames et comptes-rendus d'entretiens/performance/formation (préparation gouvernée, l'humain conduit) ; déclarer CalendarTech/DocumentTech — jamais décider notes/promotions.",
    reusedModules: ["hr-canon/capability-registry.ts", "cognitive-runtime/temporal-resolution.ts"],
    t1Needs: ["calendar", "document"],
    t2Needs: ["clonelearn", "clonereview"],
    externalDependency: "Provider calendrier live — bloqué.",
    forbiddenClaim: "Décider des notations/promotions.",
    representativeRequest: "Prépare l'entretien annuel de Sarah la semaine prochaine.",
    domainHints: ["performance", "training", "career"],
  },
  "pierre.employee_relations_sensitive": {
    pierreOwnedBehavior: "Structurer un cas RH sensible (intake, chronologie, preuves, options) en préparation seulement ; décisions finales HUMAN_ONLY, jamais automatisées ; déclarer EvidenceTech.",
    reusedModules: ["cloneguard.ts", "cognitive-runtime/autonomy-policy.ts", "cognitive-runtime/evidence.ts"],
    t1Needs: ["evidence"],
    t2Needs: ["cloneguard", "clonetrace", "clonepolicy"],
    externalDependency: null,
    forbiddenClaim: "Décision disciplinaire finale.",
    representativeRequest: "Décide de la sanction pour ce cas.",
    domainHints: ["relations", "disciplinary"],
  },
  "pierre.proactive_followup": {
    pierreOwnedBehavior: "Transformer un signal RH en relance gouvernée proposée (rappel cockpit) — jamais agir sans validation ; déclarer NotificationTech.",
    reusedModules: ["cognitive-runtime/proactive-detection.ts", "cognitive-runtime/proactive-controller.ts"],
    t1Needs: ["notification"],
    t2Needs: ["clonesignals"],
    externalDependency: "Push temps réel live — bloqué (rappels cockpit uniquement).",
    forbiddenClaim: "Agir sans validation.",
    representativeRequest: "Qu'est-ce qu'il reste à faire ?",
    domainHints: ["proactive"],
  },
  "pierre.monthly_value_report": {
    pierreOwnedBehavior: "Exposer les métriques de valeur/ROI RH comme ESTIMATIONS gouvernées (calcul réel via analytics.compute, RLS) ; déclarer AnalyticsTech pour le rapport livré — jamais d'économies garanties.",
    reusedModules: ["cognitive-runtime/analytics-engine.ts", "runtime-action-handlers.ts"],
    t1Needs: ["analytics"],
    t2Needs: [],
    externalDependency: null,
    forbiddenClaim: "Économies garanties.",
    representativeRequest: "Prépare le rapport de valeur du mois.",
    domainHints: ["reporting"],
  },
  "pierre.sector_adaptation": {
    pierreOwnedBehavior: "Comportement honnête uniquement : refuser d'inventer le droit sectoriel/pays et exposer la dépendance externe (ConnectorTech + revue légale). La fonctionnalité sourcée reste external-blocked.",
    reusedModules: ["hr-canon/country-packs", "cloneguard.ts"],
    t1Needs: ["connector"],
    t2Needs: [],
    externalDependency: "Sourcing légal/sectoriel externe (jamais inventer le droit) — bloqué.",
    forbiddenClaim: "Conforme au droit [secteur/pays].",
    representativeRequest: "Applique la convention collective de mon secteur.",
    domainHints: ["policy", "contract"],
  },
  "pierre.hr_helpdesk_quality": {
    pierreOwnedBehavior: "Répondre aux questions RH avec couverture/qualité gouvernée, ancrée sur la canon (capacités) ; distinguer réponse informationnelle vs préparation d'action.",
    reusedModules: ["cognitive-runtime/capability-retrieval.ts", "cognitive-runtime/request-interpreter.ts"],
    t1Needs: ["memory"],
    t2Needs: [],
    externalDependency: null,
    forbiddenClaim: "Conseil juridique garanti.",
    representativeRequest: "Quelles sont les étapes d'un onboarding conforme ?",
    domainHints: ["onboarding", "policy"],
  },
  "pierre.hr_quality_control": {
    pierreOwnedBehavior: "Contrôle qualité/risque RH (CloneGuard) exposé comme gate de qualité réutilisable via EvidenceTech ; approfondit — ne remplace jamais — les floors existants.",
    reusedModules: ["cloneguard.ts", "cognitive-runtime/autonomy-policy.ts"],
    t1Needs: ["evidence"],
    t2Needs: ["cloneguard"],
    externalDependency: null,
    forbiddenClaim: "Garantie de conformité.",
    representativeRequest: "Vérifie les points de vigilance de cette action RH.",
    domainHints: ["policy", "relations"],
  },
};

/** The canonical 12 items (master split rows) joined with their P16A metadata. Recovered, never invented. */
export function canonicalUltimateItems(): ReadonlyArray<{ item: P16Item; meta: P16AItemMeta }> {
  return getPierreUltimateItems().map((item) => {
    const m = META[item.id];
    if (!m) throw new Error(`P16A: no metadata for canonical ultimate item "${item.id}" — recovery drift.`);
    return { item, meta: { id: item.id, ...m } };
  });
}

export function canonicalUltimateItemIds(): string[] {
  return getPierreUltimateItems().map((i) => i.id);
}

export function metaForItem(id: string): P16AItemMeta | undefined {
  const m = META[id];
  return m ? { id, ...m } : undefined;
}

export type CanonicalRecoveryCrossCheck = {
  readonly ok: boolean;
  readonly masterSplitCount: number;
  readonly recoveredCount: number;
  readonly missing: string[];   // in master split but not covered by P16A meta (silent omission)
  readonly invented: string[];  // in P16A meta but not in master split (invention)
  readonly issues: string[];
};

/** Fail-closed cross-check: P16A meta keys === master-split pierre_ultimate ids, exactly. Pure. */
export function crossCheckCanonicalItems(): CanonicalRecoveryCrossCheck {
  const masterIds = new Set(getPierreUltimateItems().map((i) => i.id));
  const metaIds = new Set(Object.keys(META));
  const missing = [...masterIds].filter((id) => !metaIds.has(id));
  const invented = [...metaIds].filter((id) => !masterIds.has(id) || !itemById(id));
  const issues: string[] = [];
  if (missing.length) issues.push(`Items du master split non couverts par P16A : ${missing.join(", ")}`);
  if (invented.length) issues.push(`Items P16A absents du master split (inventés) : ${invented.join(", ")}`);
  return {
    ok: missing.length === 0 && invented.length === 0,
    masterSplitCount: masterIds.size,
    recoveredCount: metaIds.size,
    missing, invented, issues,
  };
}
