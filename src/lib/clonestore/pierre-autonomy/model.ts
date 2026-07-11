// src/lib/clonestore/pierre-autonomy/model.ts
// P9.5 — MODÈLE D'AUTONOMIE PRODUIT de Pierre (couche interface, PAS un 2e cerveau RH).
//
// Pierre EST l'employé/l'équipe RH opérationnelle — configurable par NIVEAU D'AUTONOMIE, du
// brouillon à l'autonomie gouvernée. Ce module est PUREMENT une couche de PRÉSENTATION +
// CONFIGURATION : chaque « ce que Pierre fait seul / en validation / réservé humain / bloqué »
// est DÉRIVÉ du moteur RÉEL de P8 (`decideValidation`, autonomy.ts) — jamais réinventé ici.
// Les 5 modes produit se réduisent aux 4 modes moteur réels de P8 (+ un cadrage « dirigeant »).
// Fonctions pures → utilisables côté client (autonomy.ts n'a aucune dépendance).

import {
  decideValidation, AUTONOMY_MODES, isExecutable, requiresHumanApproval,
  type AutonomyMode, type ActionKind, type RiskLevel, type Sensitivity, type ValidationDecision,
} from "@/lib/pierre/v1/autonomy";

// ── Modes PRODUIT (ce que l'entreprise voit/choisit) → mode MOTEUR P8 (ce qui gouverne) ──
export type ProductAutonomyModeId = "draft" | "validation" | "controlled" | "governed" | "dirigeant";

export type SupervisorFraming = "human_team" | "dirigeant";

export interface ProductAutonomyMode {
  readonly id: ProductAutonomyModeId;
  /** Le mode MOTEUR P8 réel gouvernant l'exécution (jamais cosmétique). */
  readonly engineMode: AutonomyMode;
  readonly label: string;
  readonly tagline: string;
  readonly description: string;
  /** Qui traite les points escaladés : l'équipe humaine, ou directement le dirigeant. */
  readonly supervisor: SupervisorFraming;
  readonly order: number;
}

// « Pierre est votre employé IA RH / votre équipe RH opérationnelle » — jamais « assistant RH ».
export const PRODUCT_AUTONOMY_MODES: readonly ProductAutonomyMode[] = [
  {
    id: "draft", engineMode: "draft", supervisor: "human_team", order: 1,
    label: "Brouillon",
    tagline: "Pierre prépare, vous décidez.",
    description: "Pierre rédige et prépare le travail RH (contrats, courriers, dossiers, analyses). Rien qui sorte de l'entreprise sans votre décision.",
  },
  {
    id: "validation", engineMode: "normal", supervisor: "human_team", order: 2,
    label: "Validation",
    tagline: "Pierre propose l'important, vous validez.",
    description: "Pierre exécute seul les tâches opérationnelles à faible risque et propose les actions importantes à votre validation.",
  },
  {
    id: "controlled", engineMode: "high_autonomy", supervisor: "human_team", order: 3,
    label: "Exécution contrôlée",
    tagline: "Pierre exécute le travail autorisé, demande pour le risqué.",
    description: "Pierre exécute seul le travail RH autorisé à risque faible/moyen et ne sollicite un humain que pour les actions sensibles ou risquées.",
  },
  {
    id: "governed", engineMode: "enterprise_autonomous", supervisor: "human_team", order: 4,
    label: "Autonomie gouvernée",
    tagline: "Pierre opère la RH en continu, dans vos règles.",
    description: "Pierre fait tourner la RH en continu dans le cadre de vos politiques, permissions, journaux d'audit, preuves et garde-fous ; seuls les points réellement sensibles escaladent.",
  },
  {
    id: "dirigeant", engineMode: "enterprise_autonomous", supervisor: "dirigeant", order: 5,
    label: "Dirigeant + Pierre",
    tagline: "Le dirigeant supervise Pierre directement.",
    description: "Pas d'équipe RH interne nécessaire pour beaucoup d'entreprises : le dirigeant supervise Pierre directement. Les décisions réservées à un humain (légal, disciplinaire, médical) restent gouvernées et lui remontent.",
  },
];

const BY_ID = new Map(PRODUCT_AUTONOMY_MODES.map((m) => [m.id, m]));
const BY_ENGINE = new Map<AutonomyMode, ProductAutonomyMode>();
for (const m of PRODUCT_AUTONOMY_MODES) if (!BY_ENGINE.has(m.engineMode)) BY_ENGINE.set(m.engineMode, m);

export function getProductMode(id: ProductAutonomyModeId): ProductAutonomyMode | null { return BY_ID.get(id) ?? null; }
export function isProductModeId(x: unknown): x is ProductAutonomyModeId { return typeof x === "string" && BY_ID.has(x as ProductAutonomyModeId); }

/** Mode PRODUIT canonique pour un mode MOTEUR P8 (présentation). enterprise_autonomous → « governed »
 *  (le cadrage « dirigeant » partage ce mode moteur ; la colonne P8 ne stocke que le mode moteur). */
export function productModeForEngine(engineMode: string): ProductAutonomyMode {
  return BY_ENGINE.get(engineMode as AutonomyMode) ?? BY_ID.get("validation")!;
}

/** Mode moteur P8 (validé) pour un mode produit — c'est CE mode qui est passé à createMission. */
export function engineModeFor(id: ProductAutonomyModeId): AutonomyMode {
  const m = BY_ID.get(id);
  const mode = m?.engineMode ?? "normal";
  return (AUTONOMY_MODES as readonly string[]).includes(mode) ? mode : "normal"; // garde-fou : jamais un mode inconnu
}

// ── Actions RH REPRÉSENTATIVES (ActionKind RÉELS de P8) pour dériver la matrice ──────────
// (action, risque, sensibilité, effet externe) réalistes ; la DÉCISION vient de decideValidation.
export interface RepresentativeAction {
  readonly key: string;
  readonly label: string;
  readonly action: ActionKind;
  readonly risk: RiskLevel;
  readonly sensitivity: Sensitivity;
  readonly externalSideEffect: boolean;
}

export const REPRESENTATIVE_HR_ACTIONS: readonly RepresentativeAction[] = [
  { key: "deadline_reminder", label: "Rappel d'échéance (période d'essai, visite médicale)", action: "deadline_reminder", risk: "low", sensitivity: "normal", externalSideEffect: true },
  { key: "status_update", label: "Mise à jour de statut de dossier", action: "status_update", risk: "low", sensitivity: "normal", externalSideEffect: false },
  { key: "create_task", label: "Créer une tâche RH", action: "create_task", risk: "low", sensitivity: "normal", externalSideEffect: false },
  { key: "standard_report", label: "Préparer un rapport RH standard", action: "standard_report", risk: "low", sensitivity: "normal", externalSideEffect: false },
  { key: "acknowledge_receipt", label: "Accuser réception d'un document salarié", action: "acknowledge_receipt", risk: "low", sensitivity: "normal", externalSideEffect: true },
  { key: "contract", label: "Établir un contrat de travail", action: "contract", risk: "medium", sensitivity: "sensitive", externalSideEffect: true },
  { key: "amendment", label: "Préparer un avenant", action: "amendment", risk: "medium", sensitivity: "sensitive", externalSideEffect: true },
  { key: "compensation", label: "Décision de rémunération / augmentation", action: "compensation", risk: "high", sensitivity: "sensitive", externalSideEffect: true },
  { key: "final_recruitment_decision", label: "Décision finale de recrutement", action: "final_recruitment_decision", risk: "medium", sensitivity: "sensitive", externalSideEffect: true },
  { key: "sanction", label: "Sanction disciplinaire", action: "sanction", risk: "high", sensitivity: "restricted", externalSideEffect: true },
  { key: "termination", label: "Rupture de contrat", action: "termination", risk: "high", sensitivity: "restricted", externalSideEffect: true },
  { key: "dismissal", label: "Licenciement", action: "dismissal", risk: "critical", sensitivity: "restricted", externalSideEffect: true },
  { key: "sensitive_medical", label: "Traitement d'un dossier médical sensible", action: "sensitive_medical", risk: "high", sensitivity: "restricted", externalSideEffect: false },
  { key: "harassment_flagged", label: "Signalement de harcèlement", action: "harassment_flagged", risk: "high", sensitivity: "restricted", externalSideEffect: false },
];

// ── Buckets de présentation (dérivés de la ValidationDecision RÉELLE) ────────────────────
export type AutonomyBucket = "alone" | "notify" | "prepare" | "validation" | "human_only" | "blocked";

/** Mappe une décision RÉELLE du moteur + sensibilité vers un bucket produit lisible. */
export function bucketForDecision(decision: ValidationDecision, sensitivity: Sensitivity): AutonomyBucket {
  if (decision === "BLOCK_AND_ESCALATE") return "blocked";
  if (decision === "AUTO_EXECUTE") return "alone";
  if (decision === "EXECUTE_AND_NOTIFY") return "notify";
  if (decision === "PREPARE_AND_OPTIONALLY_REVIEW") return "prepare";
  // HUMAN_APPROVAL_REQUIRED : réservé humain si restreint, sinon validation humaine.
  return sensitivity === "restricted" ? "human_only" : "validation";
}

export interface MatrixEntry extends RepresentativeAction { readonly decision: ValidationDecision; readonly bucket: AutonomyBucket; }
export interface AutonomyMatrix {
  readonly productModeId: ProductAutonomyModeId;
  readonly engineMode: AutonomyMode;
  readonly supervisor: SupervisorFraming;
  readonly entries: readonly MatrixEntry[];
  readonly buckets: Readonly<Record<AutonomyBucket, readonly string[]>>; // keys d'actions par bucket
}

/**
 * DÉRIVE la matrice « ce que Pierre fait seul / notifie / prépare / en validation / réservé humain /
 * bloqué » pour un mode produit, en appelant le moteur RÉEL de P8 (decideValidation) sur chaque action
 * représentative. AUCUNE logique RH n'est réimplémentée ici — c'est une projection du moteur.
 */
export function deriveAutonomyMatrix(id: ProductAutonomyModeId): AutonomyMatrix {
  const engineMode = engineModeFor(id);
  const supervisor = BY_ID.get(id)?.supervisor ?? "human_team";
  const buckets: Record<AutonomyBucket, string[]> = { alone: [], notify: [], prepare: [], validation: [], human_only: [], blocked: [] };
  const entries: MatrixEntry[] = REPRESENTATIVE_HR_ACTIONS.map((a) => {
    const decision = decideValidation({ mode: engineMode, action: a.action, risk: a.risk, sensitivity: a.sensitivity, external_side_effect: a.externalSideEffect });
    const bucket = bucketForDecision(decision, a.sensitivity);
    buckets[bucket].push(a.key);
    return { ...a, decision, bucket };
  });
  return { productModeId: id, engineMode, supervisor, entries, buckets };
}

/** Un mode produit AUTO-EXÉCUTE-t-il cette action ? (jamais pour les gardes dures — preuve anti-cosmétique). */
export function willExecuteAlone(id: ProductAutonomyModeId, a: RepresentativeAction): boolean {
  const decision = decideValidation({ mode: engineModeFor(id), action: a.action, risk: a.risk, sensitivity: a.sensitivity, external_side_effect: a.externalSideEffect });
  return isExecutable(decision);
}

/** Libellé humain d'un bucket (copie produit). */
export const BUCKET_LABEL: Readonly<Record<AutonomyBucket, string>> = {
  alone: "Pierre le fait seul",
  notify: "Pierre le fait et vous notifie",
  prepare: "Pierre prépare, vous décidez",
  validation: "Pierre propose, un humain valide",
  human_only: "Réservé à une décision humaine",
  blocked: "Bloqué — escalade requise",
};

/** Cadrage produit global (framing marketing correct — jamais « assistant » / « copilote »). */
export const PIERRE_PRODUCT_FRAMING = {
  headline: "Pierre — votre employé IA RH",
  subhead: "Votre équipe RH opérationnelle : plus rapide, plus intelligente et bien moins chère qu'une équipe RH senior complète.",
  governance: "Gouverné par vos permissions, politiques, journaux d'audit, limites légales et décisions réservées à un humain.",
  hybrid: "Fonctionne en hybride avec vos équipes — ou directement sous la supervision du dirigeant.",
} as const;

export function requiresHumanFor(id: ProductAutonomyModeId, a: RepresentativeAction): boolean {
  const decision = decideValidation({ mode: engineModeFor(id), action: a.action, risk: a.risk, sensitivity: a.sensitivity, external_side_effect: a.externalSideEffect });
  return requiresHumanApproval(decision);
}
