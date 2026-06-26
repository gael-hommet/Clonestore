// src/lib/pierre/demo/demo-truth-registry.ts
// PIERRE FINAL INTERACTIVE DEMO — TRUTH REGISTRY.
//
// Single source of truth for what the demo is ALLOWED to show and how honestly
// it must frame it. Every capability rendered in a scenario must be declared
// here; demo-validation.ts enforces that no undeclared capability leaks into the
// experience, and that no capability is shown as "live" when it isn't.
//
// Grounding (honest status decisions):
//   • Document/email/contract preparation + human approval are shipped (Pierre
//     v1 produces real PDFs/DOCX and routes approvals).
//   • Real email SEND is gated behind explicit human validation.
//   • Live external e-signature is NOT presented as proven — the B3 provider
//     engine is not closed; we show "preparation to signature" only.
//   • CloneVoice is NOT operational and is never shown as active.

import type { DemoCapabilityTruth, DemoTechnology } from "./demo-types";

export const DEMO_CAPABILITIES: readonly DemoCapabilityTruth[] = [
  {
    id: "request_understanding",
    label: "Compréhension d'une demande libre",
    productionStatus: "available",
    demoDisclosure: "Pierre lit une demande naturelle et en extrait les objectifs, sans rien inventer.",
    evidencePath: "src/lib/pierre/__tests__/golden-scenarios.test.ts",
  },
  {
    id: "context_recall",
    label: "Rappel du contexte entreprise",
    productionStatus: "available",
    demoDisclosure: "Pierre relit l'empreinte entreprise (règles, équipes, modèles) déjà enregistrée.",
    evidencePath: "src/lib/clonestore/empreinte/__tests__/empreinte-b44-enterprise.test.ts",
  },
  {
    id: "missing_info_detection",
    label: "Détection d'information manquante",
    productionStatus: "available",
    demoDisclosure: "Quand une donnée manque, Pierre la signale et bloque la tâche — il ne comble jamais le trou seul.",
    evidencePath: "src/lib/pierre/__tests__/hr-mission-control.test.ts",
  },
  {
    id: "mission_planning",
    label: "Organisation en missions et tâches",
    productionStatus: "available",
    demoDisclosure: "Pierre transforme la demande en missions, tâches, priorités et échéances.",
    evidencePath: "src/lib/pierre/__tests__/hr-workflows.test.ts",
  },
  {
    id: "parallel_execution",
    label: "Suivi de plusieurs missions en parallèle",
    productionStatus: "available",
    demoDisclosure: "Pierre fait avancer plusieurs missions à la fois et garde leur état.",
    evidencePath: "src/lib/pierre/__tests__/hr-mission-control.test.ts",
  },
  {
    id: "document_generation",
    label: "Génération de documents RH",
    productionStatus: "available",
    demoDisclosure: "Pierre produit des documents (offre, checklist, avenant, courrier) en PDF/DOCX.",
    evidencePath: "src/lib/clonestore/documents/__tests__/premium-documents.test.ts",
  },
  {
    id: "email_preparation",
    label: "Préparation de messages et emails",
    productionStatus: "available",
    demoDisclosure: "Pierre rédige les messages et emails, prêts à relire.",
    evidencePath: "src/lib/pierre/__tests__/premium-artifacts.test.ts",
  },
  {
    id: "real_email_send",
    label: "Envoi réel d'un email",
    productionStatus: "available_with_validation",
    demoDisclosure: "L'envoi réel existe en production mais reste conditionné à une validation humaine. Aucun email n'est envoyé dans cette démonstration.",
    evidencePath: "src/lib/cloneos/channels/__tests__/channels-b39-live-email.test.ts",
  },
  {
    id: "human_approval",
    label: "Validation humaine obligatoire",
    productionStatus: "available",
    demoDisclosure: "Pierre demande une validation humaine pour toute action sensible.",
    evidencePath: "src/lib/clonestore/guard/__tests__/global-guard-policy-tech06.test.ts",
  },
  {
    id: "scheduling_followup",
    label: "Planification et relances",
    productionStatus: "available",
    demoDisclosure: "Pierre planifie les relances et les déclenche aux bonnes échéances.",
    evidencePath: "src/lib/pierre/__tests__/hr-continuity.test.ts",
  },
  {
    id: "guardrails",
    label: "Garde-fous et refus hors rôle",
    productionStatus: "available",
    demoDisclosure: "CloneGuard bloque les décisions sensibles et exige la bonne validation.",
    evidencePath: "src/lib/pierre/__tests__/hr-cloneguard.test.ts",
  },
  {
    id: "traceability",
    label: "Traçabilité complète",
    productionStatus: "available",
    demoDisclosure: "CloneTrace enregistre chaque décision, génération et action avec horodatage.",
    evidencePath: "src/lib/clonestore/trace/__tests__/global-trace-timeline-tech07.test.ts",
  },
  {
    id: "continuity_memory",
    label: "Mémoire et reprise du travail",
    productionStatus: "available",
    demoDisclosure: "CloneContinuum conserve le contexte et permet à Pierre de reprendre plus tard.",
    evidencePath: "src/lib/pierre/__tests__/hr-continuity.test.ts",
  },
  {
    id: "signature_preparation",
    label: "Préparation à la signature",
    productionStatus: "prepared_not_executed",
    demoDisclosure: "Pierre prépare le document pour signature après validation. La signature reste une étape distincte.",
    evidencePath: "src/lib/pierre/v1/signature-provider-config.ts",
  },
  {
    id: "live_external_signature",
    label: "Signature électronique externe live",
    productionStatus: "demo_only",
    demoDisclosure: "La signature externe live n'est pas présentée comme validée dans cette démonstration.",
    evidencePath: "src/lib/pierre/v1/signature-provider-config.ts",
  },
  {
    id: "voice_call",
    label: "Appel vocal (CloneVoice)",
    productionStatus: "demo_only",
    demoDisclosure: "CloneVoice n'est pas opérationnel et n'est jamais montré comme actif.",
    evidencePath: "src/lib/clonestore/voice/clonevoice-readiness.ts",
  },
] as const;

const CAPABILITY_INDEX: ReadonlyMap<string, DemoCapabilityTruth> = new Map(
  DEMO_CAPABILITIES.map((c) => [c.id, c]),
);

/** Capability ids that may appear in an active/positive way inside scenarios. */
export const SCENARIO_ALLOWED_CAPABILITY_IDS: ReadonlySet<string> = new Set(
  DEMO_CAPABILITIES.filter((c) => c.productionStatus !== "demo_only").map((c) => c.id),
);

/** Capabilities that must NEVER be presented as active/live in a scenario. */
export const DEMO_ONLY_CAPABILITY_IDS: ReadonlySet<string> = new Set(
  DEMO_CAPABILITIES.filter((c) => c.productionStatus === "demo_only").map((c) => c.id),
);

export function getCapability(id: string): DemoCapabilityTruth | undefined {
  return CAPABILITY_INDEX.get(id);
}

export function isCapabilityDeclared(id: string): boolean {
  return CAPABILITY_INDEX.has(id);
}

/**
 * Disclosure shown next to a capability. Returns a stable string even for
 * unknown ids so the UI degrades safely.
 */
export function disclosureFor(id: string): string {
  return CAPABILITY_INDEX.get(id)?.demoDisclosure ?? "Capacité de démonstration.";
}

// ── CloneStore technologies, surfaced while they act (human language) ─────────
export const DEMO_TECHNOLOGIES: readonly DemoTechnology[] = [
  { id: "cloneos", name: "CloneOS", role: "Comprend la mission et coordonne le travail.", accent: "neutral" },
  { id: "cloneadn", name: "CloneADN", role: "Retrouve les règles, personnes et habitudes de l'entreprise.", accent: "warm" },
  { id: "cloneguard", name: "CloneGuard", role: "Bloque les actions sensibles et exige les bonnes validations.", accent: "cool" },
  { id: "clonetrust", name: "CloneTrust", role: "Adapte le niveau d'autonomie accordé à Pierre.", accent: "cool" },
  { id: "clonecontinuum", name: "CloneContinuum", role: "Conserve le contexte et reprend le suivi plus tard.", accent: "warm" },
  { id: "clonetrace", name: "CloneTrace", role: "Enregistre chaque décision, génération et action.", accent: "neutral" },
] as const;
