// src/lib/clonestore/technologies/t1/technology-registry.ts
// T1 — REGISTRE des 15 technologies CloneStore. GROUNDED sur le master split P16.0 réel
// (cross-check par id — jamais une liste inventée). RÈGLE DURE : aucune techno pierreOnly
// (types littéraux `reusable: true`, `pierreOnly: false` — une exception exigerait d'élargir
// le type ET une justification écrite). Les sourceModules sont des RÉFÉRENCES documentaires
// vers les systèmes réels existants — jamais des imports (Pierre V1 reste intouché).

import { getTechnologyItems, itemById, type P16Item } from "@/lib/clonestore/ultimate/p16-master-split";
import type { TechnologyId, TechnologyStatus } from "./technology-types";
import { ALL_TECHNOLOGY_IDS } from "./technology-types";
import type { TechnologyContract } from "./technology-contract";
import { ALL_TECHNOLOGY_CONTRACTS } from "./technology-contracts";

export type TechnologyIntegrationPhase = "P16C" | "later";

export interface TechnologyRegistryEntry {
  readonly id: TechnologyId;
  readonly contract: TechnologyContract;
  /** Statut post-T1 (honnête : contrat local sûr ≠ techno live). */
  readonly status: TechnologyStatus;
  /** Statut AVANT T1, lu depuis le master split P16.0 réel (cross-check). */
  readonly preT1Status: string;
  /** RÈGLE DURE : toujours réutilisable — le littéral interdit l'exception silencieuse. */
  readonly reusable: true;
  readonly pierreOnly: false;
  readonly pierreOnlyJustification: null;
  readonly futureEmployeesCanUse: true;
  /** Modules sources réels dans le repo (références documentaires, jamais importés ici). */
  readonly sourceModules: readonly string[];
  readonly liveBlockedReason: string | null;
  readonly safeLocalImplementation: string;
  readonly safeFallback: string;
  readonly testsRequired: readonly string[];
  readonly recommendedIntegrationPhase: TechnologyIntegrationPhase;
  /** Id de l'item correspondant dans le master split P16.0 (grounding). */
  readonly p16MasterSplitId: string;
}

interface RegistryMeta {
  readonly p16Id: string;
  readonly sourceModules: readonly string[];
  readonly liveBlockedReason: string | null;
  readonly safeLocalImplementation: string;
  readonly testsRequired: readonly string[];
  readonly recommendedIntegrationPhase: TechnologyIntegrationPhase;
}

const REGISTRY_META: Readonly<Record<TechnologyId, RegistryMeta>> = {
  document: {
    p16Id: "tech.document",
    sourceModules: [
      "src/lib/clonestore/documents/renderer.ts",
      "src/lib/clonestore/documents/template-registry.ts",
      "src/lib/clonestore/document-style-kit/html-renderer.ts",
    ],
    liveBlockedReason: null,
    safeLocalImplementation: "Préparation documentaire locale (gabarits abstraits) — validation humaine obligatoire, aucune garantie légale.",
    testsRequired: ["contrat + fallback", "needs_validation systématique", "aucune garantie légale revendiquée"],
    recommendedIntegrationPhase: "P16C",
  },
  mail: {
    p16Id: "tech.mail",
    sourceModules: [
      "src/lib/pierre/v1/communications.ts",
      "src/lib/pierre/v1/communication-provider.ts",
    ],
    liveBlockedReason: "Envoi live bloqué — domaine/provider email externe non vérifié (ext.email_provider).",
    safeLocalImplementation: "Rédaction de brouillons uniquement — l'humain envoie manuellement.",
    testsRequired: ["brouillon sans envoi", "send:true → blocked", "fallback humain"],
    recommendedIntegrationPhase: "P16C",
  },
  calendar: {
    p16Id: "tech.calendar",
    sourceModules: [],
    liveBlockedReason: "Aucun provider calendrier live — création d'événements live impossible.",
    safeLocalImplementation: "Objet événement préparé — l'humain copie/valide.",
    testsRequired: ["événement préparé non créé", "createLive:true → blocked"],
    recommendedIntegrationPhase: "P16C",
  },
  signature: {
    p16Id: "tech.signature",
    sourceModules: ["src/lib/clonestore/production/p15-provider-closure.ts"],
    liveBlockedReason: "Yousign live bloqué (P8.7.4) — fallback signature préparée, aucune revendication live.",
    safeLocalImplementation: "Paquet de signature préparé — circuit manuel/externe.",
    testsRequired: ["aucune revendication de signature live", "signLive:true → blocked"],
    recommendedIntegrationPhase: "P16C",
  },
  voice: {
    p16Id: "tech.voice",
    sourceModules: ["src/lib/clonestore/employee-context-registry/employee-context-registry-clonevoice-contract.ts"],
    liveBlockedReason: "Aucun provider vocal — roadmap ; l'entrée texte reste autoritaire.",
    safeLocalImplementation: "Fallback systématique : le texte reste la source de vérité.",
    testsRequired: ["fallback texte autoritaire", "aucune transcription revendiquée"],
    recommendedIntegrationPhase: "later",
  },
  notification: {
    p16Id: "tech.notification",
    sourceModules: [
      "src/lib/pierre/v1/cockpit-snapshot.ts",
      "src/lib/pierre/v1/communications.ts",
    ],
    liveBlockedReason: "Aucun provider push — rappels cockpit uniquement.",
    safeLocalImplementation: "Artefact de rappel cockpit — aucun push.",
    testsRequired: ["rappel cockpit sans push", "push:true → blocked"],
    recommendedIntegrationPhase: "P16C",
  },
  connector: {
    p16Id: "tech.connector",
    sourceModules: ["src/lib/pierre/v1/channels.ts"],
    liveBlockedReason: "Connecteurs SIRH/paie/Slack externes non vérifiés — tout appel live bloqué.",
    safeLocalImplementation: "Dégradation systématique : export/import manuel.",
    testsRequired: ["connect:true → blocked", "fallback manuel"],
    recommendedIntegrationPhase: "later",
  },
  memory: {
    p16Id: "tech.memory",
    sourceModules: [
      "src/lib/pierre/v1/cognitive-runtime/operational-memory.ts",
      "src/lib/clonestore/adn/index.ts",
    ],
    liveBlockedReason: null,
    safeLocalImplementation: "Contrat lecture/écriture dans le périmètre société — stores durables existants = source.",
    testsRequired: ["scope société respecté (fail-closed)", "écriture → needs_validation"],
    recommendedIntegrationPhase: "P16C",
  },
  evidence: {
    p16Id: "tech.evidence",
    sourceModules: [
      "src/lib/pierre/hr/audit-trail.ts",
      "src/lib/pierre/v1/cognitive-runtime/evidence.ts",
    ],
    liveBlockedReason: null,
    safeLocalImplementation: "Entrées d'audit locales — chaque usage de techno est auditable, même en fallback.",
    testsRequired: ["audit disponible pour tous les kinds", "aucun secret dans les traces"],
    recommendedIntegrationPhase: "P16C",
  },
  workflow: {
    p16Id: "tech.workflow",
    sourceModules: [
      "src/lib/pierre/v1/mission-service.ts",
      "src/lib/pierre/v1/hr-operations/case-state-machine.ts",
    ],
    liveBlockedReason: null,
    safeLocalImplementation: "Plan de workflow générique (étapes) — ne décide jamais d'issues RH ; le moteur V1 reste la source.",
    testsRequired: ["decideHrOutcome:true → blocked", "decidesHrOutcomes=false", "pas de 2e cerveau RH"],
    recommendedIntegrationPhase: "P16C",
  },
  analytics: {
    p16Id: "tech.analytics",
    sourceModules: [
      "src/lib/pierre/v1/runtime-action-handlers.ts",
      "src/lib/pierre/v1/cognitive-runtime/analytics-engine.ts",
    ],
    liveBlockedReason: null,
    safeLocalImplementation: "Artefact de rapport métriques — le calcul réel reste à analytics.compute (RLS) ; aucun ROI garanti.",
    testsRequired: ["roiGuaranteed=false", "rapport → needs_validation"],
    recommendedIntegrationPhase: "P16C",
  },
  file: {
    p16Id: "tech.file",
    sourceModules: [
      "src/lib/clonechat/openai/multimodal.ts",
      "src/lib/clonechat/openai/image-sanitizer.ts",
    ],
    liveBlockedReason: null,
    safeLocalImplementation: "Artefact d'ingestion — aucun parsing supposé ; revue manuelle requise ; mime inconnu → fallback.",
    testsRequired: ["mime inconnu → fallback", "manualReviewRequired=true"],
    recommendedIntegrationPhase: "P16C",
  },
  export: {
    p16Id: "tech.export",
    sourceModules: [
      "src/lib/pierre/security/pierre-rgpd-export.ts",
      "src/lib/clonestore/document-style-kit/pdf-ready-renderer.ts",
    ],
    liveBlockedReason: null,
    safeLocalImplementation: "Artefact d'export préparé — aucun transfert live ; téléchargement manuel.",
    testsRequired: ["transferNow:true → blocked", "transferred=false"],
    recommendedIntegrationPhase: "P16C",
  },
  permission: {
    p16Id: "tech.permission",
    sourceModules: [
      "src/lib/clonechat/server/auth.ts",
      "src/lib/pierre/v1/tenant-context.ts",
      "src/lib/pierre/v1/rbac.ts",
    ],
    liveBlockedReason: null,
    safeLocalImplementation: "Décision de permission fail-closed — complète (jamais ne remplace) RLS + requireCompanyUser.",
    testsRequired: ["fail-closed (employé/société manquants)", "techno inconnue → refus"],
    recommendedIntegrationPhase: "P16C",
  },
  integration_bus: {
    p16Id: "tech.bus",
    sourceModules: ["src/lib/clonestore/employee-context-registry/index.ts"],
    liveBlockedReason: null,
    safeLocalImplementation: "Bus de contrats : découverte + permission + prepare + audit — aucune logique par employé.",
    testsRequired: ["list/get/prepare", "employé futur = mêmes règles que pierre", "techno inconnue rejetée"],
    recommendedIntegrationPhase: "P16C",
  },
};

/** Construit le registre des 15 technologies (contrats + métadonnées + grounding P16.0). Pur. */
export function buildTechnologyRegistry(): readonly TechnologyRegistryEntry[] {
  return ALL_TECHNOLOGY_IDS.map((id) => {
    const meta = REGISTRY_META[id];
    const contract = ALL_TECHNOLOGY_CONTRACTS[id];
    const p16Item: P16Item | undefined = itemById(meta.p16Id);
    return {
      id,
      contract,
      status: contract.status,
      preT1Status: p16Item?.current_status ?? "unknown_in_master_split",
      reusable: true,
      pierreOnly: false,
      pierreOnlyJustification: null,
      futureEmployeesCanUse: true,
      sourceModules: meta.sourceModules,
      liveBlockedReason: meta.liveBlockedReason,
      safeLocalImplementation: meta.safeLocalImplementation,
      safeFallback: contract.safeFallback,
      testsRequired: meta.testsRequired,
      recommendedIntegrationPhase: meta.recommendedIntegrationPhase,
      p16MasterSplitId: meta.p16Id,
    };
  });
}

// Gelé (tableau + entrées) : le registre ne peut pas être muté au runtime via cast.
const REGISTRY: readonly TechnologyRegistryEntry[] = Object.freeze(
  buildTechnologyRegistry().map((e) => Object.freeze(e)),
);

export function listTechnologyRegistryEntries(): readonly TechnologyRegistryEntry[] {
  return REGISTRY;
}

export function getTechnologyRegistryEntry(technologyId: string): TechnologyRegistryEntry | undefined {
  return REGISTRY.find((e) => e.id === technologyId);
}

export interface TechnologyRegistryCrossCheck {
  readonly ok: boolean;
  readonly registryCount: number;
  readonly masterSplitTechnologyCount: number;
  readonly issues: readonly string[];
}

/** Cross-check HONNÊTE : le registre T1 couvre exactement les 15 technologies du master split P16.0. Pur. */
export function crossCheckTechnologyRegistryWithMasterSplit(): TechnologyRegistryCrossCheck {
  const issues: string[] = [];
  const masterTechs = getTechnologyItems();
  const masterIds = new Set(masterTechs.map((t) => t.id));

  if (REGISTRY.length !== 15) issues.push(`Registre T1 : ${REGISTRY.length} entrées au lieu de 15.`);
  if (masterTechs.length !== 15) issues.push(`Master split P16.0 : ${masterTechs.length} technologies au lieu de 15.`);

  for (const entry of REGISTRY) {
    if (!masterIds.has(entry.p16MasterSplitId)) {
      issues.push(`Entrée « ${entry.id} » : p16MasterSplitId « ${entry.p16MasterSplitId} » introuvable dans le master split.`);
    }
  }
  const mappedP16Ids = new Set(REGISTRY.map((e) => e.p16MasterSplitId));
  for (const tech of masterTechs) {
    if (!mappedP16Ids.has(tech.id)) issues.push(`Techno du master split non couverte par T1 : « ${tech.id} ».`);
  }

  return { ok: issues.length === 0, registryCount: REGISTRY.length, masterSplitTechnologyCount: masterTechs.length, issues };
}
