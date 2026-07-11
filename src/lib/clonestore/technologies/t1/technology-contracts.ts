// src/lib/clonestore/technologies/t1/technology-contracts.ts
// T1 — Les 15 contrats de technologies CloneStore (implémentations locales SÛRES).
// DOCTRINE : chaque contrat PRÉPARE un artefact — il n'exécute JAMAIS d'effet live.
// Aucune logique spécifique à Pierre : « pierre » n'est qu'un employeeId parmi d'autres.
// Les systèmes réels existants (moteur V1, mémoire durable, RLS…) restent les sources de
// vérité — référencés comme sourceModules dans le registre, JAMAIS importés ici.

import type { TechnologyId } from "./technology-types";
import { defineTechnologyContract, type TechnologyContract, type TechnologyPrepareOutcome } from "./technology-contract";
import { TECHNOLOGY_FALLBACKS } from "./technology-fallbacks";
import { checkTechnologyPermission } from "./technology-permissions";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.trim().length > 0 ? v.trim() : fallback;

const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()) : [];

// ── A. DocumentTech ────────────────────────────────────────────────────────────

export interface DocumentTechInput {
  readonly title?: string;
  readonly templateId?: string;
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface PreparedDocumentArtifact {
  readonly artifactKind: "prepared_document";
  readonly title: string;
  readonly templateSource: string;
  readonly outline: readonly string[];
  readonly legalGuarantee: false;
  readonly humanValidationRequired: true;
}

export const documentTech: TechnologyContract<DocumentTechInput, PreparedDocumentArtifact> = defineTechnologyContract({
  id: "document",
  name: "DocumentTech",
  purpose: "Préparer des artefacts documentaires via une abstraction locale de gabarits (aucune garantie légale).",
  status: "partial",
  liveDependency: "none",
  requiresValidation: true,
  safeFallback: TECHNOLOGY_FALLBACKS.document,
  prepareArtifact: (input) => ({
    kind: "needs_validation",
    artifact: {
      artifactKind: "prepared_document",
      title: str(input?.title, "Document sans titre"),
      templateSource: str(input?.templateId, "abstraction-locale-de-gabarits"),
      outline: ["en-tête", "corps (données fournies, non interprétées)", "bloc de validation humaine"],
      legalGuarantee: false,
      humanValidationRequired: true,
    },
  }),
});

// ── B. MailTech ────────────────────────────────────────────────────────────────

export interface MailTechInput {
  readonly to?: string;
  readonly subject?: string;
  readonly intent?: string;
}

export interface DraftedEmailArtifact {
  readonly artifactKind: "drafted_email";
  readonly to: string;
  readonly subject: string;
  readonly body: string;
  readonly sent: false;
  readonly liveSendBlocked: true;
}

export const mailTech: TechnologyContract<MailTechInput, DraftedEmailArtifact> = defineTechnologyContract({
  id: "mail",
  name: "MailTech",
  purpose: "Rédiger des brouillons d'email — l'envoi live est bloqué (provider/domaine externe non vérifié).",
  status: "partial",
  liveDependency: "provider",
  requiresValidation: true,
  safeFallback: TECHNOLOGY_FALLBACKS.mail,
  prepareArtifact: (input) => ({
    kind: "needs_validation",
    artifact: {
      artifactKind: "drafted_email",
      to: str(input?.to, "(destinataire à compléter)"),
      subject: str(input?.subject, "(objet à compléter)"),
      body: `Brouillon préparé — intention : ${str(input?.intent, "non précisée")}. À relire et envoyer manuellement.`,
      sent: false,
      liveSendBlocked: true,
    },
  }),
});

// ── C. CalendarTech ────────────────────────────────────────────────────────────

export interface CalendarTechInput {
  readonly title?: string;
  readonly startsAt?: string;
  readonly endsAt?: string;
  readonly attendees?: readonly string[];
}

export interface PreparedCalendarEventArtifact {
  readonly artifactKind: "prepared_calendar_event";
  readonly title: string;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
  readonly attendees: readonly string[];
  readonly createdLive: false;
}

export const calendarTech: TechnologyContract<CalendarTechInput, PreparedCalendarEventArtifact> = defineTechnologyContract({
  id: "calendar",
  name: "CalendarTech",
  purpose: "Préparer des objets événement/entretien — aucune création d'événement live.",
  status: "partial",
  liveDependency: "provider",
  requiresValidation: true,
  safeFallback: TECHNOLOGY_FALLBACKS.calendar,
  prepareArtifact: (input) => ({
    kind: "needs_validation",
    artifact: {
      artifactKind: "prepared_calendar_event",
      title: str(input?.title, "Événement sans titre"),
      startsAt: typeof input?.startsAt === "string" ? input.startsAt : null,
      endsAt: typeof input?.endsAt === "string" ? input.endsAt : null,
      attendees: strList(input?.attendees),
      createdLive: false,
    },
  }),
});

// ── D. SignatureTech ───────────────────────────────────────────────────────────

export interface SignatureTechInput {
  readonly documentTitle?: string;
  readonly signers?: readonly string[];
}

export interface PreparedSignaturePackageArtifact {
  readonly artifactKind: "prepared_signature_package";
  readonly documentTitle: string;
  readonly signers: readonly string[];
  readonly liveSignature: false;
  readonly provider: "none";
  readonly instructions: string;
}

export const signatureTech: TechnologyContract<SignatureTechInput, PreparedSignaturePackageArtifact> = defineTechnologyContract({
  id: "signature",
  name: "SignatureTech",
  purpose: "Préparer un paquet de signature — signature manuelle/externe ; AUCUNE revendication de signature live (Yousign bloqué P8.7.4).",
  status: "partial",
  liveDependency: "provider",
  requiresValidation: true,
  safeFallback: TECHNOLOGY_FALLBACKS.signature,
  prepareArtifact: (input) => ({
    kind: "needs_validation",
    artifact: {
      artifactKind: "prepared_signature_package",
      documentTitle: str(input?.documentTitle, "Document sans titre"),
      signers: strList(input?.signers),
      liveSignature: false,
      provider: "none",
      instructions: "Circuit de signature manuel/externe : l'humain fait signer le document préparé.",
    },
  }),
});

// ── E. VoiceTech / CloneVoice ──────────────────────────────────────────────────

export interface VoiceTechInput {
  readonly audioRef?: string;
}

export interface VoiceFallbackArtifact {
  readonly artifactKind: "voice_fallback";
  readonly textAuthoritative: true;
  readonly transcript: null;
  readonly instructions: string;
}

export const voiceTech: TechnologyContract<VoiceTechInput, VoiceFallbackArtifact> = defineTechnologyContract({
  id: "voice",
  name: "VoiceTech / CloneVoice",
  purpose: "Architecture vocale (roadmap) — aucun provider vocal ; l'entrée texte reste la source de vérité.",
  status: "architecture_ready",
  liveDependency: "provider",
  requiresValidation: true,
  safeFallback: TECHNOLOGY_FALLBACKS.voice,
  // Toujours en fallback : aucune transcription — le texte reste autoritaire.
  prepareArtifact: () => ({
    kind: "fallback",
    artifact: {
      artifactKind: "voice_fallback",
      textAuthoritative: true,
      transcript: null,
      instructions: "Saisir la demande en texte — l'entrée texte reste la source de vérité.",
    },
    fallbackNote: TECHNOLOGY_FALLBACKS.voice,
  }),
});

// ── F. NotificationTech ────────────────────────────────────────────────────────

export interface NotificationTechInput {
  readonly message?: string;
  readonly dueAt?: string;
}

export interface CockpitReminderArtifact {
  readonly artifactKind: "cockpit_reminder";
  readonly message: string;
  readonly channel: "cockpit";
  readonly dueAt: string | null;
  readonly pushSent: false;
}

export const notificationTech: TechnologyContract<NotificationTechInput, CockpitReminderArtifact> = defineTechnologyContract({
  id: "notification",
  name: "NotificationTech",
  purpose: "Créer des artefacts de rappel cockpit — aucun provider push.",
  status: "partial",
  liveDependency: "provider",
  requiresValidation: true,
  safeFallback: TECHNOLOGY_FALLBACKS.notification,
  prepareArtifact: (input) => ({
    kind: "needs_validation",
    artifact: {
      artifactKind: "cockpit_reminder",
      message: str(input?.message, "Rappel sans message"),
      channel: "cockpit",
      dueAt: typeof input?.dueAt === "string" ? input.dueAt : null,
      pushSent: false,
    },
  }),
});

// ── G. ConnectorTech ───────────────────────────────────────────────────────────

export interface ConnectorTechInput {
  readonly targetSystem?: string;
}

export interface ConnectorFallbackArtifact {
  readonly artifactKind: "connector_fallback";
  readonly targetSystem: string;
  readonly liveCallBlocked: true;
  readonly manualAlternative: string;
}

export const connectorTech: TechnologyContract<ConnectorTechInput, ConnectorFallbackArtifact> = defineTechnologyContract({
  id: "connector",
  name: "ConnectorTech",
  purpose: "Architecture de connecteurs (SIRH/paie/Slack) — tout appel live est bloqué ; export/import manuel.",
  status: "architecture_ready",
  liveDependency: "external",
  requiresValidation: true,
  safeFallback: TECHNOLOGY_FALLBACKS.connector,
  // Jamais d'appel provider : dégradation sûre systématique.
  prepareArtifact: (input) => ({
    kind: "fallback",
    artifact: {
      artifactKind: "connector_fallback",
      targetSystem: str(input?.targetSystem, "système externe non précisé"),
      liveCallBlocked: true,
      manualAlternative: "Export/import manuel des données par l'humain.",
    },
    fallbackNote: TECHNOLOGY_FALLBACKS.connector,
  }),
});

// ── H. MemoryTech ──────────────────────────────────────────────────────────────

export interface MemoryTechInput {
  readonly op?: "read" | "write";
  readonly key?: string;
  readonly value?: unknown;
  /** Périmètre demandé — DOIT égaler ctx.companyId (fail-closed sinon). */
  readonly scope?: string;
}

export interface MemoryOperationArtifact {
  readonly artifactKind: "memory_operation";
  readonly op: "read" | "write";
  readonly companyScope: string;
  readonly key: string | null;
  readonly committed: false;
  readonly note: string;
}

export const memoryTech: TechnologyContract<MemoryTechInput, MemoryOperationArtifact> = defineTechnologyContract({
  id: "memory",
  name: "MemoryTech",
  purpose: "Contrat de lecture/écriture mémoire dans le périmètre société — les stores durables existants (pierre_v27, CloneADN) restent la source.",
  status: "verified",
  liveDependency: "none",
  requiresValidation: true,
  safeFallback: TECHNOLOGY_FALLBACKS.memory,
  prepareArtifact: (input, ctx) => {
    // Respect STRICT du périmètre société : un scope différent est refusé (fail-closed).
    if (typeof input?.scope === "string" && input.scope.trim() !== ctx.companyId) {
      return { kind: "blocked", artifact: null, blockedReason: "Périmètre société non respecté (scope demandé ≠ companyId du contexte) — refus fail-closed." };
    }
    const op = input?.op === "write" ? "write" : "read";
    const artifact: MemoryOperationArtifact = {
      artifactKind: "memory_operation",
      op,
      companyScope: ctx.companyId,
      key: typeof input?.key === "string" ? input.key : null,
      committed: false,
      note: op === "write"
        ? "Écriture PRÉPARÉE (non commitée) — la persistance passe par les stores durables existants, sous validation."
        : "Lecture préparée dans le périmètre société — les stores durables existants restent la source.",
    };
    return { kind: op === "write" ? "needs_validation" : "ok", artifact };
  },
});

// ── I. EvidenceTech / TraceTech ────────────────────────────────────────────────

export interface EvidenceTechInput {
  readonly subject?: string;
  readonly action?: string;
}

export interface EvidenceEntryArtifact {
  readonly artifactKind: "evidence_entry";
  readonly subject: string;
  readonly action: string;
  readonly employeeId: string;
  readonly companyId: string;
}

export const evidenceTech: TechnologyContract<EvidenceTechInput, EvidenceEntryArtifact> = defineTechnologyContract({
  id: "evidence",
  name: "EvidenceTech / TraceTech",
  purpose: "Créer des entrées d'audit/preuve — aucun provider externe ; chaque usage de technologie est auditable.",
  status: "partial",
  liveDependency: "none",
  requiresValidation: false, // l'audit est le mécanisme de gouvernance : toujours disponible
  safeFallback: TECHNOLOGY_FALLBACKS.evidence,
  prepareArtifact: (input, ctx) => ({
    kind: "ok",
    artifact: {
      artifactKind: "evidence_entry",
      subject: str(input?.subject, "sujet non précisé"),
      action: str(input?.action, "action non précisée"),
      employeeId: ctx.employeeId,
      companyId: ctx.companyId,
    },
  }),
});

// ── J. WorkflowTech ────────────────────────────────────────────────────────────

export interface WorkflowTechInput {
  readonly goal?: string;
  readonly steps?: readonly string[];
  /** Toute demande de DÉCISION RH est refusée : le raisonnement RH reste dans Pierre V1. */
  readonly decideHrOutcome?: boolean;
}

export interface WorkflowPlanArtifact {
  readonly artifactKind: "workflow_plan";
  readonly goal: string;
  readonly steps: readonly string[];
  readonly decidesHrOutcomes: false;
  readonly hrReasoningSource: string;
  readonly executed: false;
  /** Avertissement contenu : du langage RH sensible a été détecté dans goal/steps (l'humain voit). */
  readonly sensitiveHrLanguageDetected: boolean;
}

// Détection ADVISORY de langage RH sensible (même esprit que les SENSITIVE_SIGNALS P14) :
// le plan reste une préparation sous validation humaine ; le drapeau alerte l'humain.
const SENSITIVE_HR_TERMS: readonly string[] = [
  "licenci", "disciplinair", "sanction", "rupture", "salair", "rémunérat", "préavis", "faute grave",
];

export const workflowTech: TechnologyContract<WorkflowTechInput, WorkflowPlanArtifact> = defineTechnologyContract({
  id: "workflow",
  name: "WorkflowTech",
  purpose: "Contrat de workflow GÉNÉRIQUE (étapes/orchestration) — ne décide JAMAIS d'issues RH ; pas un 2e cerveau RH.",
  status: "partial",
  liveDependency: "none",
  requiresValidation: true,
  safeFallback: TECHNOLOGY_FALLBACKS.workflow,
  prepareArtifact: (input) => {
    // Garde par TRUTHINESS (pas seulement === true) : "yes"/1/objet forgé sont aussi refusés.
    if (input?.decideHrOutcome) {
      return {
        kind: "blocked",
        artifact: null,
        blockedReason: "WorkflowTech est un moteur générique — il ne décide JAMAIS d'issues RH. Le raisonnement RH reste dans le moteur V1 existant, sous validation humaine.",
      };
    }
    const goal = str(input?.goal, "objectif non précisé");
    const steps = strList(input?.steps);
    const text = [goal, ...steps].join(" ").toLowerCase();
    return {
      kind: "needs_validation",
      artifact: {
        artifactKind: "workflow_plan",
        goal,
        steps,
        decidesHrOutcomes: false,
        hrReasoningSource: "moteur de missions V1 existant (jamais dupliqué ici)",
        executed: false,
        sensitiveHrLanguageDetected: SENSITIVE_HR_TERMS.some((t) => text.includes(t)),
      },
    };
  },
});

// ── K. AnalyticsTech / ROI ─────────────────────────────────────────────────────

export interface AnalyticsTechInput {
  readonly metrics?: readonly string[];
}

export interface MetricsReportArtifact {
  readonly artifactKind: "metrics_report";
  readonly metrics: readonly string[];
  readonly computedBy: string;
  readonly roiGuaranteed: false;
  readonly deliveredToClient: false;
}

export const analyticsTech: TechnologyContract<AnalyticsTechInput, MetricsReportArtifact> = defineTechnologyContract({
  id: "analytics",
  name: "AnalyticsTech / ROI",
  purpose: "Préparer des artefacts de rapport métriques/valeur — aucune promesse de ROI garanti.",
  status: "partial",
  liveDependency: "none",
  requiresValidation: true,
  safeFallback: TECHNOLOGY_FALLBACKS.analytics,
  prepareArtifact: (input) => ({
    kind: "needs_validation",
    artifact: {
      artifactKind: "metrics_report",
      metrics: strList(input?.metrics),
      computedBy: "préparation locale — le calcul réel reste au runtime existant (analytics.compute, RLS)",
      roiGuaranteed: false,
      deliveredToClient: false,
    },
  }),
});

// ── L. FileTech ────────────────────────────────────────────────────────────────

const FILE_MIME_ALLOWLIST: readonly string[] = [
  "image/png", "image/jpeg", "image/webp", "application/pdf", "text/plain", "text/csv",
];

export interface FileTechInput {
  readonly fileName?: string;
  readonly mimeType?: string;
}

export interface FileIngestionArtifact {
  readonly artifactKind: "file_ingestion";
  readonly fileName: string;
  readonly mimeType: string | null;
  readonly acceptedForPreparation: boolean;
  readonly parsed: false;
  readonly manualReviewRequired: true;
}

export const fileTech: TechnologyContract<FileTechInput, FileIngestionArtifact> = defineTechnologyContract({
  id: "file",
  name: "FileTech",
  purpose: "Préparer l'ingestion de fichiers — aucune hypothèse de parsing ; revue manuelle requise.",
  status: "partial",
  liveDependency: "none",
  requiresValidation: true,
  safeFallback: TECHNOLOGY_FALLBACKS.file,
  prepareArtifact: (input) => {
    const mime = typeof input?.mimeType === "string" ? input.mimeType.trim().toLowerCase() : null;
    const accepted = mime !== null && FILE_MIME_ALLOWLIST.includes(mime);
    const artifact: FileIngestionArtifact = {
      artifactKind: "file_ingestion",
      fileName: str(input?.fileName, "fichier-sans-nom"),
      mimeType: mime,
      acceptedForPreparation: accepted,
      parsed: false,
      manualReviewRequired: true,
    };
    // Type inconnu/absent → dégradation sûre : revue manuelle, aucun parsing tenté.
    return accepted
      ? { kind: "needs_validation", artifact }
      : { kind: "fallback", artifact, fallbackNote: TECHNOLOGY_FALLBACKS.file };
  },
});

// ── M. ExportTech ──────────────────────────────────────────────────────────────

export interface ExportTechInput {
  readonly subject?: string;
  readonly format?: string;
}

export interface ExportPackageArtifact {
  readonly artifactKind: "export_package";
  readonly subject: string;
  readonly format: string;
  readonly liveTransferBlocked: true;
  readonly transferred: false;
}

export const exportTech: TechnologyContract<ExportTechInput, ExportPackageArtifact> = defineTechnologyContract({
  id: "export",
  name: "ExportTech",
  purpose: "Préparer des artefacts d'export — aucun transfert live ; téléchargement/export manuel.",
  status: "partial",
  liveDependency: "none",
  requiresValidation: true,
  safeFallback: TECHNOLOGY_FALLBACKS.export,
  prepareArtifact: (input) => ({
    kind: "needs_validation",
    artifact: {
      artifactKind: "export_package",
      subject: str(input?.subject, "export non précisé"),
      format: str(input?.format, "json"),
      liveTransferBlocked: true,
      transferred: false,
    },
  }),
});

// ── N. PermissionTech ──────────────────────────────────────────────────────────

export interface PermissionTechInput {
  readonly employeeId?: string;
  readonly technologyId?: string;
  readonly companyId?: string;
}

export interface PermissionDecisionArtifact {
  readonly artifactKind: "permission_decision";
  readonly allowed: boolean;
  readonly reason: string;
  readonly failClosed: true;
}

export const permissionTech: TechnologyContract<PermissionTechInput, PermissionDecisionArtifact> = defineTechnologyContract({
  id: "permission",
  name: "PermissionTech",
  purpose: "Vérifier le périmètre acteur/société/employé — FAIL-CLOSED ; ne contourne jamais RLS/requireCompanyUser.",
  status: "verified",
  liveDependency: "none",
  requiresValidation: false, // une décision de permission n'est pas un effet ; le refus est immédiat
  safeFallback: TECHNOLOGY_FALLBACKS.permission,
  prepareArtifact: (input, ctx) => {
    const decision = checkTechnologyPermission(
      input?.employeeId !== undefined ? input.employeeId : ctx.employeeId,
      str(input?.technologyId, "permission"),
      { companyId: input?.companyId !== undefined ? input.companyId : ctx.companyId },
    );
    const artifact: PermissionDecisionArtifact = {
      artifactKind: "permission_decision",
      allowed: decision.allowed,
      reason: decision.reason,
      failClosed: true,
    };
    // Refus → résultat BLOQUÉ (fail-closed), jamais un simple « ok » silencieux.
    return decision.allowed
      ? { kind: "ok", artifact }
      : { kind: "blocked", artifact: null, blockedReason: decision.reason };
  },
});

// ── O. IntegrationBus (contrat de coordination — le bus lui-même est technology-bus.ts) ──

export interface IntegrationBusInput {
  readonly question?: string;
}

export interface BusSummaryArtifact {
  readonly artifactKind: "bus_summary";
  readonly technologiesRegistered: number;
  readonly employeeSpecificLogic: false;
  readonly note: string;
}

export const integrationBusTech: TechnologyContract<IntegrationBusInput, BusSummaryArtifact> = defineTechnologyContract({
  id: "integration_bus",
  name: "IntegrationBus / TechnologyBus",
  purpose: "Coordonner la découverte/consommation des technologies par contrat — aucune logique spécifique à un employé.",
  status: "partial",
  liveDependency: "none",
  requiresValidation: false, // un résumé de coordination n'est pas un effet
  safeFallback: TECHNOLOGY_FALLBACKS.integration_bus,
  prepareArtifact: () => ({
    kind: "ok",
    artifact: {
      artifactKind: "bus_summary",
      technologiesRegistered: ALL_TECHNOLOGY_CONTRACT_IDS.length,
      employeeSpecificLogic: false,
      note: "Le bus expose les 15 technologies par contrat ; toute techno indisponible dégrade en fallback.",
    },
  }),
});

// ── Tableau des 15 contrats ────────────────────────────────────────────────────

// Gelé : l'invariant « aucune I/O, aucun live » ne doit pas pouvoir être annulé par
// une mutation runtime (splice d'un contrat malveillant via cast).
export const ALL_TECHNOLOGY_CONTRACTS: Readonly<Record<TechnologyId, TechnologyContract>> = Object.freeze({
  document: documentTech,
  mail: mailTech,
  calendar: calendarTech,
  signature: signatureTech,
  voice: voiceTech,
  notification: notificationTech,
  connector: connectorTech,
  memory: memoryTech,
  evidence: evidenceTech,
  workflow: workflowTech,
  analytics: analyticsTech,
  file: fileTech,
  export: exportTech,
  permission: permissionTech,
  integration_bus: integrationBusTech,
});

export const ALL_TECHNOLOGY_CONTRACT_IDS: readonly TechnologyId[] = Object.freeze(
  Object.keys(ALL_TECHNOLOGY_CONTRACTS) as TechnologyId[],
);

/** Récupère un contrat (undefined si id inconnu — le bus refuse fail-closed). Pur. */
export function getTechnologyContract(technologyId: string): TechnologyContract | undefined {
  return (ALL_TECHNOLOGY_CONTRACTS as Record<string, TechnologyContract>)[technologyId];
}
