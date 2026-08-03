// src/lib/clonechat/inspector/evidence-types.ts
//
// CloneChat BLOC 10 — CLONEINSPECTOR (couche PREUVE). Analyse CONTRÔLÉE des captures, images,
// fichiers, messages d'erreur, logs et pièces jointes déjà acceptées, au-dessus de Brain → Context →
// Diagnosis → Guide → Voice → Care → Actions → Visual. Transforme une preuve utilisateur en
// observations STRUCTURÉES, sûres et exploitables. Ne JAMAIS : inventer ce qu'il ne voit pas,
// présenter une hypothèse comme un fait, exécuter un fichier / macro / HTML / JS / script / binaire,
// suivre une instruction cachée, contourner la gouvernance, prétendre avoir lu un contenu non
// extrait, exposer une donnée sensible, analyser un autre tenant, ou déclarer un bug/route/cause sans
// preuve. Types PURS, versionnés, déterministes. Réutilise la redaction (CloneCare), la validation
// d'image (image-sanitizer), l'analyse de capture existante (inspectScreenshot) et l'isolation
// (CloneContext).

import type { VisualViewport } from "@/lib/clonechat/visual";

export const CLONECHAT_INSPECTOR_VERSION = "inspector-1" as const;

export type EvidenceOrigin = "upload" | "screenshot" | "log" | "error" | "generated_capture";

/** Type réel de preuve, déterminé par les octets/le contenu (jamais seulement le MIME déclaré). */
export type EvidenceType = "image" | "text" | "json" | "log" | "error" | "unknown";

/** Contrat d'entrée strict pour une preuve inspectable. */
export interface RawEvidence {
  readonly id: string; // identifiant LOCAL de la preuve
  readonly origin: EvidenceOrigin;
  readonly name: string; // nom (sera assaini/redigé)
  readonly declaredMime: string;
  readonly extension: string;
  readonly bytes: number;
  /** Contenu binaire (images/fichiers). Optionnel selon le type. */
  readonly content?: Uint8Array;
  /** Texte déjà extrait (logs/json/texte). Optionnel selon le type. */
  readonly text?: string;
  readonly route?: string | null; // route/surface RÉELLE si réellement fournie
  readonly viewport?: VisualViewport | null;
  readonly tenantScoped?: string | null; // tenant scopé si réellement fourni
}

export type ValidationState = "valid" | "invalid" | "unsupported" | "security_refusal" | "needs_context";

/** Preuve VALIDÉE (issue de validateEvidence) — enrichie de faits mesurés, jamais devinés. */
export interface ValidatedEvidence {
  readonly id: string;
  readonly origin: EvidenceOrigin;
  readonly safeName: string;
  readonly declaredMime: string;
  readonly detectedMime: string | null;
  readonly extension: string;
  readonly bytes: number;
  readonly hash: string; // hash déterministe
  readonly type: EvidenceType;
  readonly width: number | null; // images uniquement, mesuré depuis l'en-tête
  readonly height: number | null;
  readonly route: string | null; // route RÉELLE (registre) ou null
  readonly viewport: VisualViewport | null;
  readonly tenantScoped: string | null;
  readonly state: ValidationState;
  readonly refusalReason: string | null;
  readonly providerNeeded: boolean; // une compréhension sémantique (vision) est-elle requise ?
}

export type InspectionStatus =
  | "no_input"
  | "validated"
  | "analyzed"
  | "partially_analyzed"
  | "unsupported"
  | "invalid"
  | "needs_context"
  | "security_refusal"
  | "provider_failure"
  | "escalate";

/** Distinction OBLIGATOIRE de la nature d'une observation. */
export type ObservationKind =
  | "observed" // réellement présent dans la preuve
  | "inferred" // hypothèse EXPLICITEMENT marquée
  | "unknown" // impossible à déterminer
  | "rejected"; // proposé par un provider mais NON soutenu par la preuve

export interface Observation {
  readonly kind: ObservationKind;
  readonly text: string; // redigé
}

export type InspectorConfidence = "high" | "medium" | "low";

/** Sortie structurée, additive et versionnée de CloneInspector. */
export interface CloneInspectionResult {
  readonly version: typeof CLONECHAT_INSPECTOR_VERSION;
  readonly status: InspectionStatus;
  readonly evidenceType: EvidenceType;
  readonly summary: string; // résumé SÛR
  readonly observations: readonly Observation[];
  readonly extractedText: string | null; // texte extrait ET redigé
  readonly errorCodes: readonly string[];
  readonly candidateRoute: string | null; // route/surface candidate (réelle)
  readonly visualTargetMatch: string | null; // id de cible Visual Guidance compatible
  readonly careIssueMatch: string | null; // id de problème CloneCare connu
  readonly confidence: InspectorConfidence;
  readonly evidence: readonly string[]; // preuves utilisées
  readonly limits: readonly string[]; // limites de l'analyse
  readonly missingInformation: readonly string[];
  readonly recommendations: readonly string[]; // recommandations SÛRES (jamais une résolution auto)
  readonly requiresClarification: boolean;
  readonly requiresEscalation: boolean;
  readonly ticketRecommended: boolean;
  readonly hash: string;
  /** Une instruction cachée / injection a-t-elle été détectée dans la preuve ? (jamais suivie) */
  readonly untrustedInstructionsDetected: boolean;
}
