// src/lib/clonechat/intelligence/c1-1/parrain-pierre-index.ts
// C1.1 — Connaissance COMPLÈTE de Pierre, DÉRIVÉE du canon réel P8.10 (HR_CAPABILITIES).
// Aucune copie manuelle, aucun compte en dur : le nombre et le contenu viennent du
// registre canonique vivant. Récupération BORNÉE : jamais toutes les capacités vers
// le modèle — uniquement les entrées autorisées les plus pertinentes.

import { HR_CAPABILITIES, HR_DOMAINS, type HrCapabilityDefinition, type HrDomainId } from "@/lib/pierre/v1/hr-canon";
import { makeParrainChunk } from "./parrain-knowledge-chunk";
import { parrainNormalize, type ParrainKnowledgeChunk } from "./parrain-types";

export interface ParrainPierreCapabilityEntry {
  readonly capabilityId: string;
  readonly title: string;
  readonly domain: HrDomainId;
  readonly description: string;
  readonly supportedInputs: readonly string[];
  readonly expectedOutputs: readonly string[];
  readonly autonomyClass: HrCapabilityDefinition["autonomy"];
  readonly riskClass: HrCapabilityDefinition["risk"]["level"];
  readonly validationRequired: boolean;
  readonly humanOnly: boolean;
  readonly countryLegalDependency: boolean;
  readonly externalProviderDependency: boolean;
  readonly currentFunctionalStatus: HrCapabilityDefinition["implementation"];
  readonly currentLiveStatus: "human_only" | "legal_blocked" | "provider_blocked" | "local_governed";
  readonly missionPackIds: readonly string[];
  readonly runtimeActionKeys: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly commercialExplanation: string;
  readonly technicalExplanation: string;
  readonly forbiddenClaims: readonly string[];
  readonly relatedCapabilities: readonly string[];
}

function liveStatus(cap: HrCapabilityDefinition): ParrainPierreCapabilityEntry["currentLiveStatus"] {
  if (cap.autonomy === "human_only" || cap.autonomy === "forbidden" || cap.implementation === "HUMAN_ONLY") return "human_only";
  if (cap.implementation === "IMPLEMENTED_LEGAL_BLOCKED" || cap.implementation === "LEGAL_CONTENT_REQUIRED") return "legal_blocked";
  if (
    cap.implementation === "IMPLEMENTED_EXTERNAL_GOVERNED" ||
    cap.implementation === "EXTERNAL_DEPENDENCY" ||
    cap.integrationDependencies.some((d) => d.system !== "none" && d.status !== "available")
  ) {
    return "provider_blocked";
  }
  return "local_governed";
}

const AUTONOMY_FR: Record<HrCapabilityDefinition["autonomy"], string> = {
  observe_only: "observation et signalement uniquement",
  suggest: "proposition — l'humain décide",
  prepare_draft: "préparation de brouillon — l'humain envoie/décide",
  execute_with_validation: "exécution après validation humaine obligatoire",
  execute_autonomous: "exécution autonome dans des limites gouvernées",
  human_only: "réservé à l'humain — Pierre assiste seulement",
  forbidden: "jamais automatisé",
};

function toEntry(cap: HrCapabilityDefinition): ParrainPierreCapabilityEntry {
  const humanOnly = cap.autonomy === "human_only" || cap.autonomy === "forbidden" || cap.implementation === "HUMAN_ONLY";
  const legal = cap.countryRuleDependencies.some((d) => d.required) || cap.implementation === "IMPLEMENTED_LEGAL_BLOCKED" || cap.implementation === "LEGAL_CONTENT_REQUIRED";
  const provider = cap.integrationDependencies.some((d) => d.system !== "none" && d.status !== "available");
  const validationRequired =
    cap.autonomy === "execute_with_validation" || cap.approvals.some((a) => a.when !== "never");
  const status = liveStatus(cap);
  const forbiddenClaims: string[] = ["Exécuté en production live"];
  if (humanOnly) forbiddenClaims.push("Automatisé par Pierre (cette capacité reste humaine)");
  if (legal) forbiddenClaims.push("Conformité légale garantie sans revue externe");
  if (provider) forbiddenClaims.push("Envoi/signature/connexion automatique (provider non vérifié)");
  if (cap.autonomy !== "execute_autonomous") forbiddenClaims.push("Réalisé sans aucune validation humaine");
  return Object.freeze({
    capabilityId: cap.id,
    title: cap.label,
    domain: cap.domain,
    description: cap.description,
    supportedInputs: cap.requiredInputs.map((i) => i.label),
    expectedOutputs: cap.expectedArtifacts.map((a) => a.label),
    autonomyClass: cap.autonomy,
    riskClass: cap.risk.level,
    validationRequired,
    humanOnly,
    countryLegalDependency: legal,
    externalProviderDependency: provider,
    currentFunctionalStatus: cap.implementation,
    currentLiveStatus: status,
    missionPackIds: cap.implementationReferences
      .filter((r) => /mission/i.test(r.path) || /pack/i.test(r.path))
      .map((r) => r.symbol ?? r.path)
      .slice(0, 4),
    runtimeActionKeys: cap.workflow.steps.map((s) => s.key).slice(0, 8),
    evidenceRefs: cap.evidence.map((e) => e.ref).slice(0, 3),
    commercialExplanation:
      `${cap.label} : ${cap.description} Mode de fonctionnement : ${AUTONOMY_FR[cap.autonomy]}.` +
      (humanOnly ? " Cette étape reste humaine — Pierre prépare et assiste." : "") +
      (legal ? " Le volet légal pays attend une revue externe — rien n'est garanti juridiquement." : "") +
      (provider ? " L'automatisation externe attend un provider vérifié — chemin manuel gouverné en attendant." : ""),
    technicalExplanation:
      `Statut canon : ${cap.implementation} · risque ${cap.risk.level} · autonomie ${cap.autonomy} · ` +
      `${cap.workflow.steps.length} étapes de workflow · ${cap.evidence.length} preuves référencées.`,
    forbiddenClaims,
    relatedCapabilities: [],
  });
}

let ENTRIES: readonly ParrainPierreCapabilityEntry[] | null = null;

/** Index dérivé (memoïsé par process) — le COMPTE vient du registre réel, jamais d'une constante. */
export function buildPierreCapabilityIndex(): readonly ParrainPierreCapabilityEntry[] {
  if (ENTRIES && ENTRIES.length === HR_CAPABILITIES.length) return ENTRIES;
  const base = HR_CAPABILITIES.map(toEntry);
  const byDomain = new Map<string, string[]>();
  for (const e of base) {
    const list = byDomain.get(e.domain) ?? [];
    list.push(e.capabilityId);
    byDomain.set(e.domain, list);
  }
  ENTRIES = Object.freeze(
    base.map((e) =>
      Object.freeze({
        ...e,
        relatedCapabilities: (byDomain.get(e.domain) ?? []).filter((id) => id !== e.capabilityId).slice(0, 5),
      }),
    ),
  );
  return ENTRIES;
}

/** Compte canonique DÉRIVÉ (source de vérité : le registre réel). */
export function canonicalCapabilityCount(): number {
  return HR_CAPABILITIES.length;
}

export function capabilityById(capabilityId: string): ParrainPierreCapabilityEntry | null {
  return buildPierreCapabilityIndex().find((e) => e.capabilityId === capabilityId) ?? null;
}

export function capabilitiesByDomain(domain: HrDomainId): readonly ParrainPierreCapabilityEntry[] {
  return buildPierreCapabilityIndex().filter((e) => e.domain === domain);
}

const DOMAIN_SIGNALS: readonly { domain: HrDomainId; rx: RegExp }[] = [
  { domain: "onboarding", rx: /onboard|int[ée]gration|arriv[ée]e|nouveau salari[ée]/i },
  { domain: "offboarding", rx: /offboard|d[ée]part|sortie|fin de contrat/i },
  { domain: "absence", rx: /absence|cong[ée]|maladie|rtt|temps de travail/i },
  { domain: "payroll", rx: /paie|pr[ée]-?paie|salaire|bulletin|variables/i },
  { domain: "contract", rx: /contrat|avenant|cdi|cdd|clause/i },
  { domain: "recruitment", rx: /recrutement|candidat|entretien d['’]embauche|annonce/i },
  { domain: "disciplinary", rx: /disciplinaire|sanction|licenciement|faute/i },
  { domain: "performance", rx: /performance|entretien annuel|[ée]valuation|objectifs/i },
  { domain: "training", rx: /formation|comp[ée]tence|certification/i },
  { domain: "employee360", rx: /dossier salari[ée]|employ[ée] 360|administration du personnel/i },
  { domain: "reporting", rx: /reporting|rapport|indicateur|kpi/i },
  { domain: "data_gdpr", rx: /rgpd|gdpr|donn[ée]es personnelles/i },
];

/** Récupération BORNÉE : top-k capacités pertinentes (jamais tout le canon). */
export function retrieveCapabilities(query: string, opts?: { limit?: number; domain?: HrDomainId }): readonly ParrainPierreCapabilityEntry[] {
  const limit = Math.min(opts?.limit ?? 5, 8);
  const q = parrainNormalize(query);
  const words = q.split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const domainHint = opts?.domain ?? DOMAIN_SIGNALS.find((d) => d.rx.test(query))?.domain ?? null;
  const scored = buildPierreCapabilityIndex().map((e) => {
    const hay = parrainNormalize(`${e.capabilityId} ${e.title} ${e.description} ${e.domain}`);
    let score = 0;
    for (const w of words) if (hay.includes(w)) score += 1;
    if (domainHint && e.domain === domainHint) score += 2.5;
    if (q.includes(parrainNormalize(e.capabilityId))) score += 5;
    return { e, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.e);
}

/** Chunks bornés pour le grounding (uniquement les capacités récupérées). */
export function capabilityChunks(entries: readonly ParrainPierreCapabilityEntry[]): readonly ParrainKnowledgeChunk[] {
  return entries.slice(0, 8).map((e) =>
    makeParrainChunk({
      id: `cap.${e.capabilityId}`,
      sourceId: "src.capability_registry",
      title: e.title,
      text: e.commercialExplanation,
      sourceType: "capability_registry",
      authority: "canonical_runtime",
      visibility: "PUBLIC",
      citationLabel: `la capacité « ${e.title} »`,
    }),
  );
}

/** Vue synthèse par domaine (bornée) pour les questions générales « que sait faire Pierre ? ». */
export function domainSummaryChunk(): ParrainKnowledgeChunk {
  const counts = HR_DOMAINS.map((d) => `${d.name} (${capabilitiesByDomain(d.id as HrDomainId).length})`).join(" · ");
  return makeParrainChunk({
    id: "cap.domain-summary",
    sourceId: "src.capability_registry",
    title: "Panorama des capacités de Pierre",
    text: `Pierre couvre ${canonicalCapabilityCount()} capacités RH canoniques réparties sur ${HR_DOMAINS.length} domaines : ${counts}. Les décisions sensibles restent sous validation humaine ; les volets légaux pays et les envois externes attendent des vérifications externes.`,
    sourceType: "capability_registry",
    authority: "canonical_runtime",
    visibility: "PUBLIC",
    citationLabel: "les capacités de Pierre",
  });
}
