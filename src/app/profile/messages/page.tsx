"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bell,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileText,
  Filter,
  Inbox,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  MessageCircle,
  MessagesSquare,
  Network,
  PackageCheck,
  Pin,
  PinOff,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User2,
  Waypoints,
  X,
} from "lucide-react";

import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { AGENTS } from "@/lib/agent-catalog";
import { getSessionClient } from "@/lib/auth/session-client";
import { useAuthGate } from "@/lib/auth/useAuthGate";
import { cn } from "@/lib/utils";

// ── PHASE 3.1 / 3.4 — Couche messages read-only ──────────────────────────────
// Lecture seule. Aucune écriture en DB. Aucune exécution.
// PHASE 3.1 : Pierre data read-only.
// PHASE 3.4 : + CloneOS History read-only (fusionné).
// Fallback démo si non connecté ou tables vides.
import {
  loadMessageCenterReadOnlyItems,
  DATA_MODE_LABELS,
  hasCloneOSHistoryMessageItems,
  countCloneOSHistoryMessageItems,
  type MessageCenterDataMode,
  type MessageCenterItem,
} from "@/lib/clonestore/messages";

// ── PHASE 3.16 / 3.17 — Contexte système feed read-only ──────────────────────
// PHASE 3.16 : feed Empreinte Entreprise.
// PHASE 3.17 : feed unifié Empreinte + Historique CloneOS (merge read-only).
// Lecture seule. Aucune écriture DB. Aucun POST. Aucun message envoyé.
// Aucune exécution CloneOS. localStorage reste le fallback actif.
import {
  loadProfileMessagesContextFeed,
  type ProfileMessagesContextFeedReadResult,
} from "@/lib/clonestore/messages";

// ── PHASE 4.2 — Command Center Preview (simulation runtime read-only) ─────────
// POST simulation-only via postRuntimeIntegrationSimulation (au clic uniquement).
// Aucune mission créée. Aucun message/email/document envoyé. Aucun appel IA.
// Aucun moteur Pierre appelé. CloneVoice non actif. Scale 80k non prouvé.
import {
  postRuntimeIntegrationSimulation,
  buildRuntimeIntegrationPreviewSnapshot,
  buildRuntimeIntegrationPreviewBadges,
  buildRuntimeIntegrationPreviewCards,
  buildRuntimeIntegrationPreviewSections,
  type RuntimeIntegrationPreviewSnapshot,
  // ── PHASE 4.3 — Mission Draft (brouillon local/in-memory, aucune mission en base) ──
  buildRuntimeMissionDraftFromIntegrationResult,
  buildRuntimeMissionDraftLocalPreview,
  validateRuntimeMissionDraft,
  type RuntimeMissionDraftSnapshot,
  // ── PHASE 4.5 — Safe Apply localStorage-first (sauvegarde brouillon, no-execution) ──
  persistRuntimeMissionDraftWithFallback,
  restoreRuntimeMissionDraftWithFallback,
  buildRuntimeMissionDraftSafeApplyUiSnapshot,
  buildRuntimeMissionDraftSafeApplyUiBadges,
  buildRuntimeMissionDraftSafeApplyUiCards,
  type RuntimeMissionDraftSafeApplyUiSnapshot,
  type RuntimeMissionDraftSafeApplyRestoreResult,
  isRuntimeMissionDraftServerPersistenceEnabled,
  // ── PHASE 4.7 — Restore UI Polish (statut local/serveur, source effective, read-only) ──
  buildRuntimeMissionDraftRestoreUiSnapshot,
  buildRuntimeMissionDraftRestoreUiBadges,
  buildRuntimeMissionDraftRestoreUiCards,
  buildRuntimeMissionDraftRestoreUiWarnings,
  // ── PHASE 4.9 — Controlled Mission Promotion Preview (read-only, aperçu au clic) ──
  buildRuntimeMissionPromotionContract,
  buildRuntimeMissionPromotionSnapshot,
  buildRuntimeMissionPromotionBadges,
  buildRuntimeMissionPromotionCards,
  buildRuntimeMissionPromotionSections,
  type RuntimeMissionPromotionSnapshot,
  // ── PHASE 5.1 — Controlled Mission Safe Apply (localStorage-first, no-execution) ──
  createLocalControlledMission,
  loadLocalControlledMissions,
  validateControlledMissionSafeApplyInput,
  buildLocalControlledMissionBadges,
  buildLocalControlledMissionSectionBadges,
  buildControlledMissionUserFacingWarnings,
  getLocalControlledMissionStatusLabel,
  CONTROLLED_MISSION_SAFE_APPLY_BUTTON_LABEL,
  CONTROLLED_MISSION_SAFE_APPLY_MICROCOPY,
  CONTROLLED_MISSION_SAFE_APPLY_SUCCESS,
  CONTROLLED_MISSION_SAFE_APPLY_ALREADY_CREATED,
  type LocalControlledMission,
  type ControlledMissionSafeApplyResult,
  // ── PHASE 5.2 — Controlled Mission Local Review (validation humaine locale) ──
  startLocalControlledMissionReview,
  approveLocalControlledMission,
  requestChangesForLocalControlledMission,
  blockLocalControlledMission,
  archiveReviewedLocalControlledMission,
  buildControlledMissionReviewChecklist,
  getControlledMissionReviewState,
  buildControlledMissionReviewBadges,
  CONTROLLED_MISSION_REVIEW_START_LABEL,
  CONTROLLED_MISSION_REVIEW_APPROVE_LABEL,
  CONTROLLED_MISSION_REVIEW_REQUEST_CHANGES_LABEL,
  CONTROLLED_MISSION_REVIEW_BLOCK_LABEL,
  CONTROLLED_MISSION_REVIEW_MICROCOPY,
  CONTROLLED_MISSION_REVIEW_NO_PIERRE,
  CONTROLLED_MISSION_REVIEW_APPROVED_MESSAGE,
  CONTROLLED_MISSION_REVIEW_PANEL_GUARDRAIL,
  type LocalControlledMissionReviewResult,
  // ── PHASE 5.3 — Controlled Mission Preflight (readiness gate locale) ──
  runLocalControlledMissionPreflight,
  getControlledMissionPreflightState,
  buildControlledMissionPreflightBadges,
  getControlledMissionReadinessLevelLabel,
  CONTROLLED_MISSION_PREFLIGHT_RUN_LABEL,
  CONTROLLED_MISSION_PREFLIGHT_MICROCOPY,
  CONTROLLED_MISSION_PREFLIGHT_WHAT_IT_DOES,
  CONTROLLED_MISSION_PREFLIGHT_NO_PIERRE,
  CONTROLLED_MISSION_PREFLIGHT_READY_MESSAGE,
  CONTROLLED_MISSION_PREFLIGHT_PANEL_GUARDRAIL,
  type LocalControlledMissionPreflightResult,
  // ── PHASE 5.4 — Controlled Mission Server Persistence (design-only) ──
  buildGovernedControlledMissionServerDraft,
  buildControlledMissionServerPersistenceReadiness,
  buildControlledMissionServerPersistenceBadges,
  summarizeControlledMissionServerPersistenceDraft,
  CONTROLLED_MISSION_SERVER_PERSISTENCE_MICROCOPY,
  CONTROLLED_MISSION_SERVER_PERSISTENCE_WHAT_IT_DOES,
  CONTROLLED_MISSION_SERVER_PERSISTENCE_PANEL_GUARDRAIL,
  CONTROLLED_MISSION_SERVER_PERSISTENCE_NO_DATA,
  CONTROLLED_MISSION_SERVER_PERSISTENCE_STILL_LOCAL,
  CONTROLLED_MISSION_SERVER_PERSISTENCE_FACTS,
  CONTROLLED_MISSION_SERVER_PERSISTENCE_VIEW_DRAFT_LABEL,
  CONTROLLED_MISSION_SERVER_PERSISTENCE_VIEW_REQUIREMENTS_LABEL,
  // ── PHASE 5.5 — Controlled Mission Server Persistence Manual Activation QA ──
  buildControlledMissionServerPersistenceManualActivationQa,
  buildControlledMissionServerPersistenceManualActivationRunbook,
  buildControlledMissionServerManualQaBadges,
  getControlledMissionServerManualQaCategoryLabel,
  CONTROLLED_MISSION_SERVER_MANUAL_QA_VIEW_CHECKLIST_LABEL,
  CONTROLLED_MISSION_SERVER_MANUAL_QA_VIEW_RUNBOOK_LABEL,
  CONTROLLED_MISSION_SERVER_MANUAL_QA_MICROCOPY,
  CONTROLLED_MISSION_SERVER_MANUAL_QA_WHAT_IT_DOES,
  CONTROLLED_MISSION_SERVER_MANUAL_QA_DO_NOT_APPLY,
  CONTROLLED_MISSION_SERVER_MANUAL_QA_NO_DATA,
  CONTROLLED_MISSION_SERVER_MANUAL_QA_PANEL_GUARDRAIL,
  CONTROLLED_MISSION_SERVER_MANUAL_QA_FACTS,
  // ── PHASE 5.6 — Controlled Mission Server Restore UI (design-only) ──
  buildControlledMissionServerRestoreDesignState,
  buildControlledMissionServerRestoreBadges,
  CONTROLLED_MISSION_SERVER_RESTORE_MICROCOPY,
  CONTROLLED_MISSION_SERVER_RESTORE_WHAT_IT_DOES,
  CONTROLLED_MISSION_SERVER_RESTORE_NO_GET,
  CONTROLLED_MISSION_SERVER_RESTORE_LOCAL_SOURCE,
  CONTROLLED_MISSION_SERVER_RESTORE_PANEL_GUARDRAIL,
  CONTROLLED_MISSION_SERVER_RESTORE_FACTS,
  CONTROLLED_MISSION_SERVER_RESTORE_VIEW_STATE_LABEL,
  CONTROLLED_MISSION_SERVER_RESTORE_VIEW_FUTURE_LABEL,
  // ── PHASE 5.7 — Controlled Mission Server Persistence Final Gate (design-only) ──
  buildControlledMissionServerPersistenceFinalGateReport,
  buildControlledMissionFinalGateBadges,
  getControlledMissionFinalGateVerdictLabel,
  getControlledMissionFinalGateLevelLabel,
  CONTROLLED_MISSION_FINAL_GATE_MICROCOPY,
  CONTROLLED_MISSION_FINAL_GATE_WHAT_IT_DOES,
  CONTROLLED_MISSION_FINAL_GATE_SERVER_INACTIVE,
  CONTROLLED_MISSION_FINAL_GATE_NO_ROUTE,
  CONTROLLED_MISSION_FINAL_GATE_NO_EXECUTION,
  CONTROLLED_MISSION_FINAL_GATE_PANEL_GUARDRAIL,
  CONTROLLED_MISSION_FINAL_GATE_VIEW_REPORT_LABEL,
  CONTROLLED_MISSION_FINAL_GATE_VIEW_INVARIANTS_LABEL,
  CONTROLLED_MISSION_FINAL_GATE_VIEW_NEXT_STEPS_LABEL,
  // ── PHASE 5.8 — Controlled Mission Persistence Transition Plan (design-only) ──
  buildControlledMissionPersistenceTransitionPlan,
  buildControlledMissionTransitionBadges,
  getControlledMissionTransitionStatusLabel,
  getControlledMissionTransitionLevelLabel,
  getControlledMissionTransitionPhaseStatusLabel,
  CONTROLLED_MISSION_TRANSITION_MICROCOPY,
  CONTROLLED_MISSION_TRANSITION_WHAT_IT_DOES,
  CONTROLLED_MISSION_TRANSITION_LOCAL_SOURCE,
  CONTROLLED_MISSION_TRANSITION_NO_GET_POST,
  CONTROLLED_MISSION_TRANSITION_NO_EXECUTION,
  CONTROLLED_MISSION_TRANSITION_PANEL_GUARDRAIL,
  CONTROLLED_MISSION_TRANSITION_VIEW_PLAN_LABEL,
  CONTROLLED_MISSION_TRANSITION_VIEW_RISKS_LABEL,
  CONTROLLED_MISSION_TRANSITION_VIEW_ROLLBACK_LABEL,
  CONTROLLED_MISSION_TRANSITION_VIEW_NEXT_STEPS_LABEL,
  // ── PHASE 5.9 — Controlled Mission Persistence Operator Handbook (design-only) ──
  buildControlledMissionPersistenceOperatorHandbook,
  buildControlledMissionHandbookBadges,
  getControlledMissionHandbookStatusLabel,
  CONTROLLED_MISSION_HANDBOOK_MICROCOPY,
  CONTROLLED_MISSION_HANDBOOK_WHAT_IT_DOES,
  CONTROLLED_MISSION_HANDBOOK_LOCAL_SOURCE,
  CONTROLLED_MISSION_HANDBOOK_NO_GET_POST,
  CONTROLLED_MISSION_HANDBOOK_NO_EXECUTION,
  CONTROLLED_MISSION_HANDBOOK_PANEL_GUARDRAIL,
  CONTROLLED_MISSION_HANDBOOK_VIEW_HANDBOOK_LABEL,
  CONTROLLED_MISSION_HANDBOOK_VIEW_WORKFLOWS_LABEL,
  CONTROLLED_MISSION_HANDBOOK_VIEW_PLAYBOOKS_LABEL,
  CONTROLLED_MISSION_HANDBOOK_VIEW_COMMANDS_LABEL,
  CONTROLLED_MISSION_HANDBOOK_VIEW_DECISIONS_LABEL,
  // ── PHASE 5.10 — Controlled Mission Persistence Phase 5 Closure (design-only) ──
  buildControlledMissionPersistencePhase5ClosureReport,
  buildControlledMissionClosureBadges,
  getControlledMissionClosureStatusLabel,
  CONTROLLED_MISSION_CLOSURE_MICROCOPY,
  CONTROLLED_MISSION_CLOSURE_WHAT_IT_DOES,
  CONTROLLED_MISSION_CLOSURE_LOCAL_SOURCE,
  CONTROLLED_MISSION_CLOSURE_NO_GET_POST,
  CONTROLLED_MISSION_CLOSURE_NO_EXECUTION,
  CONTROLLED_MISSION_CLOSURE_NEXT_P6,
  CONTROLLED_MISSION_CLOSURE_PANEL_GUARDRAIL,
  CONTROLLED_MISSION_CLOSURE_VIEW_CLOSURE_LABEL,
  CONTROLLED_MISSION_CLOSURE_VIEW_BLOCKS_LABEL,
  CONTROLLED_MISSION_CLOSURE_VIEW_RISKS_LABEL,
  CONTROLLED_MISSION_CLOSURE_VIEW_P6_LABEL,
  CONTROLLED_MISSION_CLOSURE_VIEW_VERDICT_LABEL,
  // ── PHASE 6.1 — Pierre Sellable Completion Master Audit (audit-only) ──
  buildPierreSellableCompletionMasterAuditReport,
  buildPierreSellableAuditBadges,
  getPierreSellableAuditStatusLabel,
  getPierreSellableLevelLabel,
  getPierreSellableClassificationLabel,
  PIERRE_SELLABLE_AUDIT_MICROCOPY,
  PIERRE_SELLABLE_AUDIT_WHAT_IT_DOES,
  PIERRE_SELLABLE_AUDIT_NOT_PUBLIC_COMPLETE,
  PIERRE_SELLABLE_AUDIT_NEXT_P6_2,
  PIERRE_SELLABLE_AUDIT_PANEL_GUARDRAIL,
  PIERRE_SELLABLE_AUDIT_VIEW_AUDIT_LABEL,
  PIERRE_SELLABLE_AUDIT_VIEW_BLOCKERS_LABEL,
  PIERRE_SELLABLE_AUDIT_VIEW_P6_LABEL,
  PIERRE_SELLABLE_AUDIT_VIEW_CRITERIA_LABEL,
  // ── PHASE 6.2 — Pierre Real Workflow Completion Pack (5 scénarios, proof) ──
  buildPierreRealWorkflowCompletionPack,
  buildPierreWorkflowPackBadges,
  getPierreWorkflowPackStatusLabel,
  PIERRE_WORKFLOW_PACK_MICROCOPY,
  PIERRE_WORKFLOW_PACK_VALUE_NO_RUNTIME,
  PIERRE_WORKFLOW_PACK_SENSITIVE_BLOCKED,
  PIERRE_WORKFLOW_PACK_NOT_PUBLIC_COMPLETE,
  PIERRE_WORKFLOW_PACK_NEXT_P6_3,
  PIERRE_WORKFLOW_PACK_PANEL_GUARDRAIL,
  PIERRE_WORKFLOW_PACK_VIEW_SCENARIOS_LABEL,
  PIERRE_WORKFLOW_PACK_VIEW_DELIVERABLES_LABEL,
  PIERRE_WORKFLOW_PACK_VIEW_VALIDATIONS_LABEL,
  PIERRE_WORKFLOW_PACK_VIEW_RISKS_LABEL,
  PIERRE_WORKFLOW_PACK_VIEW_VALUE_LABEL,
  // ── PHASE 6.3 — Pierre State/Server Activation Decision Gate (decision-only) ──
  buildPierreStateServerActivationDecisionGate,
  buildPierreDecisionGateBadges,
  getPierreDecisionGateStatusLabel,
  getPierreDecisionGateStrategyLabel,
  getPierreDecisionGateDecisionLabel,
  PIERRE_DECISION_GATE_MICROCOPY,
  PIERRE_DECISION_GATE_SALE_VS_LAUNCH,
  PIERRE_DECISION_GATE_RUNTIME_INACTIVE,
  PIERRE_DECISION_GATE_SERVER_INACTIVE,
  PIERRE_DECISION_GATE_NEXT_P6_4,
  PIERRE_DECISION_GATE_PANEL_GUARDRAIL,
  PIERRE_DECISION_GATE_VIEW_DECISION_LABEL,
  PIERRE_DECISION_GATE_VIEW_CONDITIONS_LABEL,
  PIERRE_DECISION_GATE_VIEW_NOGO_LABEL,
  PIERRE_DECISION_GATE_VIEW_APPROVALS_LABEL,
  PIERRE_DECISION_GATE_VIEW_ROLLBACK_LABEL,
  PIERRE_DECISION_GATE_VIEW_P6_LABEL,
  // ── PHASE 6.4 — Pierre Channels & Identity Final (readiness) ──
  buildPierreChannelsIdentityFinalReport,
  buildPierreIdentityBadges,
  PIERRE_IDENTITY_TITLE,
  getPierreIdentityStatusLabel,
  getPierreIdentityModeLabel,
  getPierreChannelStatusLabel,
  PIERRE_IDENTITY_MICROCOPY,
  PIERRE_IDENTITY_DRAFT_ONLY,
  PIERRE_IDENTITY_DOMAIN_NOT_CONNECTED,
  PIERRE_IDENTITY_SALE_VS_EMAIL,
  PIERRE_IDENTITY_NEXT_P6_5,
  PIERRE_IDENTITY_PANEL_GUARDRAIL,
  PIERRE_IDENTITY_VIEW_IDENTITY_LABEL,
  PIERRE_IDENTITY_VIEW_CHANNELS_LABEL,
  PIERRE_IDENTITY_VIEW_EMAIL_LABEL,
  PIERRE_IDENTITY_VIEW_PERMISSIONS_LABEL,
  PIERRE_IDENTITY_VIEW_TEMPLATES_LABEL,
  PIERRE_IDENTITY_VIEW_DOMAIN_LABEL,
  // ── PHASE 6.5 — Pierre Customer Activation E2E Final (proof path) ──
  buildPierreCustomerActivationE2EFinalReport,
  buildPierreActivationBadges,
  getPierreActivationStatusLabel,
  getPierreActivationPathStatusLabel,
  PIERRE_ACTIVATION_TITLE,
  PIERRE_ACTIVATION_MICROCOPY,
  PIERRE_ACTIVATION_FIRST_VALUE,
  PIERRE_ACTIVATION_NO_AUTONOMOUS,
  PIERRE_ACTIVATION_STRIPE_FUTURE,
  PIERRE_ACTIVATION_NEXT_P6_6,
  PIERRE_ACTIVATION_PANEL_GUARDRAIL,
  PIERRE_ACTIVATION_VIEW_JOURNEY_LABEL,
  PIERRE_ACTIVATION_VIEW_FIRST_VALUE_LABEL,
  PIERRE_ACTIVATION_VIEW_ACCESS_LABEL,
  PIERRE_ACTIVATION_VIEW_SCENARIOS_LABEL,
  PIERRE_ACTIVATION_VIEW_EVIDENCE_LABEL,
  PIERRE_ACTIVATION_VIEW_BLOCKERS_LABEL,
  // ── PHASE 6.6 — Pierre Sellable Gate Final (verdict contrôlé) ──
  buildPierreSellableGateFinalReport,
  buildPierreGateBadges,
  getPierreGateStatusLabel,
  getPierreSellabilityLevelLabel,
  getPierreSellabilityVerdictLabel,
  PIERRE_GATE_MICROCOPY,
  PIERRE_GATE_CONTROLLED_SELLABLE,
  PIERRE_GATE_NOT_PUBLIC,
  PIERRE_GATE_REMAINING,
  PIERRE_GATE_NEXT_PHASE,
  PIERRE_GATE_PANEL_GUARDRAIL,
  PIERRE_GATE_VIEW_VERDICT_LABEL,
  PIERRE_GATE_VIEW_EVIDENCE_LABEL,
  PIERRE_GATE_VIEW_ALLOWED_LABEL,
  PIERRE_GATE_VIEW_FORBIDDEN_LABEL,
  PIERRE_GATE_VIEW_CONDITIONS_LABEL,
  PIERRE_GATE_VIEW_BLOCKERS_LABEL,
  // ── PHASE 7.1 — External Go-Live Proofs Gate (preuves externes) ──
  buildExternalGoLiveProofsReport,
  buildExternalGoLiveBadges,
  getExternalGoLiveStatusLabel,
  getExternalProofClassificationLabel,
  getExternalPublicLaunchVerdictLabel,
  getFirstLiveCustomerReadinessLabel,
  EXTERNAL_GOLIVE_MICROCOPY,
  EXTERNAL_GOLIVE_NO_INVENTED,
  EXTERNAL_GOLIVE_NOT_PUBLIC,
  EXTERNAL_GOLIVE_MANUAL,
  EXTERNAL_GOLIVE_NEXT_PHASE,
  EXTERNAL_GOLIVE_PANEL_GUARDRAIL,
  EXTERNAL_GOLIVE_VIEW_STRIPE_LABEL,
  EXTERNAL_GOLIVE_VIEW_SUPABASE_LABEL,
  EXTERNAL_GOLIVE_VIEW_DOMAIN_LABEL,
  EXTERNAL_GOLIVE_VIEW_CUSTOMER_LABEL,
  EXTERNAL_GOLIVE_VIEW_MANUAL_LABEL,
  EXTERNAL_GOLIVE_VIEW_BLOCKERS_LABEL,
  // ── PHASE 7.2 — First Live Customer Controlled Run (premier client réel) ──
  buildFirstLiveCustomerControlledRunReport,
  buildFlcBadges,
  getFlcRunStatusLabel,
  getFlcRiskLabel,
  FLC_MICROCOPY,
  FLC_NOT_PUBLIC,
  FLC_NO_INVENTED,
  FLC_GO_LIVE_MANUAL,
  FLC_NEXT_PHASE,
  FLC_PANEL_GUARDRAIL,
  FLC_VIEW_QUALIFICATION_LABEL,
  FLC_VIEW_RUNBOOK_LABEL,
  FLC_VIEW_EVIDENCE_LABEL,
  FLC_VIEW_NOGO_LABEL,
  FLC_VIEW_ROLLBACK_LABEL,
  FLC_VIEW_NEXT_LABEL,
  // ── PHASE 7.3 — First Customer Evidence Review (audit preuves réelles) ──
  buildFirstCustomerEvidenceReviewReport,
  buildFcerBadges,
  getEvidenceReviewStatusLabel,
  getEvidenceCategoryLabel,
  FCER_MICROCOPY,
  FCER_NO_AUTO_VALIDATION,
  FCER_NOT_PUBLIC,
  FCER_GO_LIVE_MANUAL,
  FCER_NEXT_PHASE,
  FCER_PANEL_GUARDRAIL,
  FCER_VIEW_MATRIX_LABEL,
  FCER_VIEW_RULES_LABEL,
  FCER_VIEW_CRITERIA_LABEL,
  FCER_VIEW_LAUNCH_GATE_LABEL,
  FCER_VIEW_GOLIVE_LABEL,
  FCER_VIEW_DECISION_LABEL,
  // ── PHASE 7.4 — Customer Evidence Applied / Second Customer (application contrôlée) ──
  buildCustomerEvidenceAppliedSecondCustomerReport,
  buildCeaBadges,
  getEvidenceApplicationStatusLabel,
  getAppliedEvidenceCategoryLabel,
  CEA_MICROCOPY,
  CEA_NO_APPLY_WITHOUT_REAL,
  CEA_NOT_PUBLIC,
  CEA_GO_LIVE_MANUAL,
  CEA_NEXT_PHASE,
  CEA_PANEL_GUARDRAIL,
  CEA_VIEW_APPLICATION_LABEL,
  CEA_VIEW_CONTRIBUTION_LABEL,
  CEA_VIEW_SECOND_CUSTOMER_LABEL,
  CEA_VIEW_COMPARISON_LABEL,
  CEA_VIEW_SAFETY_GATE_LABEL,
  CEA_VIEW_RUNBOOK_LABEL,
  // ── PHASE 7.5 — Second Customer Controlled Run / Public Launch Prep ──
  buildSecondCustomerControlledRunPublicLaunchPrepReport,
  buildSc2Badges,
  getSc2RunStatusLabel,
  getSc2RiskLabel,
  SC2_MICROCOPY,
  SC2_NOT_STARTED,
  SC2_MULTI_UNPROVEN,
  SC2_NOT_PUBLIC,
  SC2_NEXT_PHASE,
  SC2_PANEL_GUARDRAIL,
  SC2_VIEW_QUALIFICATION_LABEL,
  SC2_VIEW_RUNBOOK_LABEL,
  SC2_VIEW_EVIDENCE_LABEL,
  SC2_VIEW_COMPARISON_LABEL,
  SC2_VIEW_REPRODUCIBILITY_LABEL,
  SC2_VIEW_LAUNCH_PREP_LABEL,
  // ── PHASE 7.6 — Public Launch Final Review Gate (verdict final Phase 7) ──
  buildPublicLaunchFinalReviewGateReport,
  buildPlfBadges,
  getPlfReviewStatusLabel,
  PLF_MICROCOPY,
  PLF_INTERNAL_VS_EXTERNAL,
  PLF_SELLABLE_LIMITS,
  PLF_NOT_PUBLIC,
  PLF_NEXT_REAL,
  PLF_PANEL_GUARDRAIL,
  PLF_VIEW_VERDICT_LABEL,
  PLF_VIEW_BLOCKERS_LABEL,
  PLF_VIEW_PROOFS_LABEL,
  PLF_VIEW_CLAIMS_LABEL,
  PLF_VIEW_ACTIONS_LABEL,
  PLF_VIEW_CLOSURE_LABEL,
} from "@/lib/clonestore/runtime-integration";

// ── PHASE 2.5 — Imports TECH (lecture locale, aucune exécution) ───────────────
// Ces imports fournissent les types et labels — jamais d'écriture DB.
import {
  PIERRE_EMPLOYEE_RUNTIME_CONTRACT,
} from "@/lib/clonestore/employees/employee-registry";
import type {
  CloneOSCommandCenterResult,
} from "@/lib/clonestore/cloneos";
import type {
  CloneBriefExecutiveSummary,
  CloneBriefType,
} from "@/lib/clonestore/brief";
import type {
  GlobalTraceEventType,
} from "@/lib/clonestore/trace";
import type {
  GlobalGuardDecision,
} from "@/lib/clonestore/guard";

// ── Types ─────────────────────────────────────────────────────────────────────

type OrderRow = {
  id: string;
  agent_slug: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
};

// ── PHASE 2.5 — 4 onglets exacts (restructuré depuis 6 catégories) ────────────
// preparations → fusionné dans suivis
// envoyes → fusionné dans livraisons
// 4 onglets : suivis | briefings | livraisons | alertes

type MessageCenterTab = "suivis" | "briefings" | "livraisons" | "alertes";

// Ancien alias pour compatibilité locale
type MessageCategory = MessageCenterTab;

type MessageCenterPriority = "low" | "normal" | "high" | "urgent";
// Alias pour compatibilité
type MessagePriority = "normal" | "important" | "critical";

type MessageCenterStatus =
  | "unread"
  | "read"
  | "pending"
  | "done"
  | "blocked"
  | "requires_validation"
  | "delivered"
  | "archived";

// Alias pour compatibilité
type MessageStatus =
  | "new"
  | "in_progress"
  | "waiting_validation"
  | "delivered"
  | "sent"
  | "archived";

type MessageCenterSource =
  | "cloneos"
  | "clonetrace"
  | "clonebrief"
  | "cloneguard"
  | "pierre"
  | "system";

// Alias pour compatibilité
type MessageSource =
  | "CloneOS"
  | "CloneTrace"
  | "CloneGuard"
  | "CloneBrief"
  | "Pierre"
  | "Système";

type MessageCenterActionKind =
  | "open_cockpit_pierre"
  | "open_technologies"
  | "open_cockpit"
  | "validate"
  | "read_only"
  | "archive";

type MessageCenterFilter = {
  tab: MessageCenterTab | "all";
  query: string;
  showUnreadOnly: boolean;
};

type MessageItem = {
  id: string;
  title: string;
  summary: string;
  body: string;
  source: MessageSource;
  tab: MessageCenterTab;
  // categories gardées pour compatibilité interne
  categories: MessageCategory[];
  priority: MessagePriority;
  status: MessageStatus;
  createdAt: string;
  updatedAt: string;
  dueAt?: string;
  employees: string[];
  tags: string[];
  deliverables?: string[];
  // Liens PHASE 2.5
  href?: string;
  actionKind?: MessageCenterActionKind;
  // Données TECH conceptuelles (lecture seule, jamais exécutées)
  traceEventType?: GlobalTraceEventType;
  guardDecision?: GlobalGuardDecision;
  briefType?: CloneBriefType;
  cloneOSStatus?: CloneOSCommandCenterResult["status"];
  actions: Array<{
    label: string;
    tone: "primary" | "neutral" | "danger";
    href?: string;
    readOnly?: boolean;
  }>;
};

// ── PHASE 2.5 — 4 onglets (CategoryDefinition) ───────────────────────────────

type CategoryDefinition = {
  key: MessageCenterTab;
  label: string;
  shortLabel: string;
  eyebrow: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  emptyTitle: string;
  emptyText: string;
};

const CATEGORIES: CategoryDefinition[] = [
  {
    key: "suivis",
    label: "Suivis",
    shortLabel: "Suivis",
    eyebrow: "Missions et relances",
    description:
      "Missions en cours, demandes CloneOS analysées, tâches planifiées, relances, dossiers ouverts.",
    icon: Waypoints,
    emptyTitle: "Aucun suivi actif",
    emptyText:
      "Soumettez une demande via le centre de commandement. CloneOS créera les suivis de mission ici.",
  },
  {
    key: "briefings",
    label: "Briefings",
    shortLabel: "Briefs",
    eyebrow: "Synthèses exécutives",
    description:
      "Résumés CloneBrief, briefings du jour, synthèses hebdomadaires, activité des employés IA.",
    icon: MessageCircle,
    emptyTitle: "Aucun briefing disponible",
    emptyText:
      "Les briefings apparaîtront ici dès que CloneBrief produira des synthèses.",
  },
  {
    key: "livraisons",
    label: "Livraisons",
    shortLabel: "Livrés",
    eyebrow: "Documents et artefacts",
    description:
      "Documents prêts à validation, emails préparés, synthèses de mission, livrables Pierre.",
    icon: PackageCheck,
    emptyTitle: "Aucune livraison disponible",
    emptyText:
      "Les livrables préparés par Pierre apparaîtront ici — plan-only pour l'instant.",
  },
  {
    key: "alertes",
    label: "Alertes",
    shortLabel: "Alertes",
    eyebrow: "Guard · Validation · Risques",
    description:
      "Validations humaines requises, actions bloquées / refusées, risques critiques, anomalies.",
    icon: ShieldAlert,
    emptyTitle: "Aucune alerte",
    emptyText:
      "CloneGuard remontera ici les validations, blocages et refus dès qu'une action sera analysée.",
  },
];

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  read: "clonestore.messages.read.v1",
  pinned: "clonestore.messages.pinned.v1",
  archived: "clonestore.messages.archived.v1",
};

// ── PHASE 2.5 — Données mock structurées opérationnelles ─────────────────────
// Données réalistes non mensongères.
// Jamais : "email envoyé", "document réel généré", "mission exécutée".
// Sources nommées d'après les technologies TECH-07/08/09/06.

function buildInitialMessages(ownedEmployees: string[]): MessageItem[] {
  const pierreSlug = PIERRE_EMPLOYEE_RUNTIME_CONTRACT.slug;
  const employees = ownedEmployees.length > 0 ? ownedEmployees : [pierreSlug.charAt(0).toUpperCase() + pierreSlug.slice(1)];

  return [
    // ── Suivis ────────────────────────────────────────────────────────────────
    {
      id: "msg-suivi-cloneos-001",
      title: "Demande RH analysée par CloneOS",
      summary:
        "CloneOS a classifié la demande, routé Pierre et préparé un plan de mission — lecture seule, aucune action exécutée.",
      body:
        "CloneOS a traité la demande via le pipeline TECH-08 : classification (domaine RH, intention create_document), routage vers Pierre, plan de mission préparé avec 3 tâches, évaluation CloneGuard (allow / prepare_only), trace préparée. Plan uniquement — non exécuté. Pierre est disponible pour la mission dès validation humaine.",
      source: "CloneOS",
      tab: "suivis",
      categories: ["suivis"],
      priority: "important",
      status: "in_progress",
      createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
      employees: employees.includes("Pierre") ? ["Pierre"] : employees.slice(0, 1),
      tags: ["CloneOS", "plan préparé", "non exécuté", "RH"],
      deliverables: ["Plan de mission (non exécuté)", "Classification domaine RH"],
      traceEventType: "mission_created",
      cloneOSStatus: "ready_for_execution",
      actions: [
        {
          label: "Ouvrir le cockpit Pierre",
          tone: "primary",
          href: "/agents/pierre/use",
        },
        { label: "Lecture seule — aucune action exécutée", tone: "neutral", readOnly: true },
      ],
    },
    {
      id: "msg-suivi-absence-001",
      title: "Suivi d'absence — information manquante",
      summary:
        "Pierre a identifié un dossier d'absence incomplet. Information manquante avant de continuer.",
      body:
        "La demande d'absence a été analysée. CloneOS a détecté une information manquante (justificatif médical ou motif précis). La mission reste en attente de complétion. Pierre est le seul employé IA actif en V1 — domaine RH. Aucune action n'a été prise en autonomie.",
      source: "Pierre",
      tab: "suivis",
      categories: ["suivis"],
      priority: "important",
      status: "waiting_validation",
      createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      dueAt: new Date(Date.now() + 1000 * 60 * 60 * 3).toISOString(),
      employees: ["Pierre"],
      tags: ["absence", "information manquante", "dossier incomplet"],
      deliverables: ["Note d'analyse", "Liste informations requises"],
      traceEventType: "validation_requested",
      actions: [
        {
          label: "Compléter dans le cockpit",
          tone: "primary",
          href: "/agents/pierre/use",
        },
        { label: "Lecture seule", tone: "neutral", readOnly: true },
      ],
    },
    {
      id: "msg-suivi-onboarding-001",
      title: "Plan d'onboarding préparé — non exécuté",
      summary:
        "Pierre a préparé les étapes d'onboarding. Plan prêt à validation humaine avant toute exécution.",
      body:
        "Pack onboarding structuré par Pierre : checklist manager, email d'accueil (brouillon), documents préparés. CloneGuard a évalué chaque étape. L'email externe attend une validation humaine avant envoi. Aucun document n'a été envoyé. Pierre ne peut pas agir en autonomie sur des actions sensibles.",
      source: "Pierre",
      tab: "suivis",
      categories: ["suivis"],
      priority: "normal",
      status: "in_progress",
      createdAt: new Date(Date.now() - 1000 * 60 * 48).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 16).toISOString(),
      employees: ["Pierre"],
      tags: ["onboarding", "plan préparé", "non exécuté", "validation requise"],
      deliverables: ["Checklist onboarding", "Brouillon email accueil (non envoyé)"],
      traceEventType: "action_requires_validation",
      actions: [
        {
          label: "Valider dans le cockpit Pierre",
          tone: "primary",
          href: "/agents/pierre/use",
        },
      ],
    },

    // ── Briefings ─────────────────────────────────────────────────────────────
    {
      id: "msg-brief-daily-001",
      title: "Briefing du jour — activité Pierre",
      summary:
        "Synthèse CloneBrief des actions du jour : missions analysées, validations en attente, blocages.",
      body:
        "CloneBrief a généré un résumé exécutif de la journée. Missions analysées par CloneOS : 3. Validations en attente : 1 (email externe RH). Blocages Guard : 0. Pierre est disponible pour les missions RH. Aucune action exécutée en autonomie — lecture seule. Ce briefing est une synthèse locale, non persistée.",
      source: "CloneBrief",
      tab: "briefings",
      categories: ["briefings"],
      priority: "normal",
      status: "delivered",
      createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
      employees: ["Pierre", "CloneOS"],
      tags: ["briefing", "quotidien", "CloneBrief", "synthèse"],
      deliverables: ["Synthèse du jour", "Indicateurs clés"],
      briefType: "daily",
      actions: [
        { label: "Lire dans Mon espace", tone: "primary", href: "/profile/agents" },
      ],
    },
    {
      id: "msg-brief-validations-001",
      title: "Synthèse des validations en attente",
      summary:
        "CloneBrief liste les actions qui nécessitent votre décision avant toute exécution.",
      body:
        "1 validation humaine requise : email RH externe préparé par Pierre. CloneGuard bloque l'envoi en autonomie. Décision attendue : approuver, refuser ou modifier. Ce résumé est une synthèse locale CloneBrief — aucune action n'est prise automatiquement.",
      source: "CloneBrief",
      tab: "briefings",
      categories: ["briefings"],
      priority: "important",
      status: "waiting_validation",
      createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
      employees: ["Pierre", "CloneGuard"],
      tags: ["validations", "briefing", "CloneGuard", "en attente"],
      deliverables: ["Liste validations", "Résumé Guard"],
      briefType: "validation",
      guardDecision: "require_validation",
      actions: [
        { label: "Voir les alertes", tone: "primary" },
        { label: "Cockpit Pierre", tone: "neutral", href: "/agents/pierre/use" },
      ],
    },

    // ── Livraisons ────────────────────────────────────────────────────────────
    {
      id: "msg-delivery-document-001",
      title: "Brouillon de document RH prêt à validation",
      summary:
        "Pierre a préparé un document RH. Il est en attente de validation humaine — non signé, non envoyé.",
      body:
        "Le document RH demandé est structuré et prêt. Pierre a préparé le contenu, CloneGuard a évalué la conformité. Le document n'a pas été envoyé ni signé. La validation humaine est requise avant toute diffusion externe. Lecture seule — aucune action exécutée depuis la messagerie.",
      source: "Pierre",
      tab: "livraisons",
      categories: ["livraisons"],
      priority: "important",
      status: "delivered",
      createdAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 210).toISOString(),
      employees: ["Pierre"],
      tags: ["livrable", "document RH", "validation requise", "non envoyé"],
      deliverables: ["Brouillon document RH", "Note de conformité Guard"],
      traceEventType: "document_prepared",
      actions: [
        {
          label: "Ouvrir dans le cockpit Pierre",
          tone: "primary",
          href: "/agents/pierre/use",
        },
        { label: "Lecture seule depuis la messagerie", tone: "neutral", readOnly: true },
      ],
    },
    {
      id: "msg-delivery-email-001",
      title: "Brouillon d'email préparé — non envoyé",
      summary:
        "Pierre a rédigé un email RH. Il est en attente de validation humaine avant envoi éventuel.",
      body:
        "Un email externe RH a été rédigé par Pierre. CloneGuard a bloqué l'envoi automatique : validation humaine obligatoire avant toute communication externe. L'email est disponible en lecture dans le cockpit Pierre. Aucun email n'a été envoyé depuis la messagerie.",
      source: "Pierre",
      tab: "livraisons",
      categories: ["livraisons"],
      priority: "important",
      status: "waiting_validation",
      createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
      employees: ["Pierre", "CloneGuard"],
      tags: ["email", "brouillon", "non envoyé", "validation"],
      deliverables: ["Brouillon email (non envoyé)", "Motif Guard"],
      traceEventType: "email_prepared",
      guardDecision: "require_validation",
      actions: [
        { label: "Voir le brouillon", tone: "primary", href: "/agents/pierre/use" },
        { label: "Non envoyable depuis la messagerie", tone: "neutral", readOnly: true },
      ],
    },
    {
      id: "msg-delivery-synthesis-001",
      title: "Synthèse de mission disponible",
      summary:
        "CloneTrace a préparé une synthèse de la mission. Lecture seule — non persistée.",
      body:
        "La mission RH analysée dispose d'une synthèse opérationnelle : plan des tâches, décisions Guard, événements de trace, statut final. Cette synthèse est préparée localement — non persistée en base. CloneTrace : aperçu de trace disponible.",
      source: "CloneTrace",
      tab: "livraisons",
      categories: ["livraisons"],
      priority: "normal",
      status: "delivered",
      createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 160).toISOString(),
      employees: ["Pierre", "CloneOS"],
      tags: ["synthèse", "trace", "lecture seule", "non persistée"],
      deliverables: ["Synthèse mission", "Aperçu CloneTrace"],
      traceEventType: "task_completed",
      actions: [
        { label: "Voir Mon espace", tone: "primary", href: "/profile/agents" },
      ],
    },

    // ── Alertes ───────────────────────────────────────────────────────────────
    {
      id: "msg-alert-validation-001",
      title: "Validation humaine requise — action sensible",
      summary:
        "CloneGuard a détecté un sujet sensible. L'action reste bloquée en attente de décision humaine.",
      body:
        "Une action RH touche un sujet sensible (email externe, document sensible ou risque élevé). CloneGuard applique l'invariant : validation humaine obligatoire avant toute exécution. Pierre ne peut pas agir en autonomie. Aucune action n'est exécutée automatiquement. Décision requise : approuver, refuser ou modifier depuis le cockpit Pierre.",
      source: "CloneGuard",
      tab: "alertes",
      categories: ["alertes"],
      priority: "critical",
      status: "waiting_validation",
      createdAt: new Date(Date.now() - 1000 * 60 * 32).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 28).toISOString(),
      employees: ["Pierre", "CloneGuard"],
      tags: ["validation humaine", "CloneGuard", "sensible", "bloqué"],
      deliverables: ["Note de risque Guard", "Action en attente"],
      traceEventType: "action_requires_validation",
      guardDecision: "require_validation",
      actions: [
        { label: "Décider dans le cockpit Pierre", tone: "danger", href: "/agents/pierre/use" },
        { label: "Lecture seule ici", tone: "neutral", readOnly: true },
      ],
    },
    {
      id: "msg-alert-blocked-001",
      title: "Action bloquée — domaine non couvert",
      summary:
        "CloneOS a détecté que le domaine demandé n'a aucun employé IA actif disponible en V1.",
      body:
        "La demande concerne un domaine non couvert en V1 (finance, support, administratif, etc.). Pierre est le seul employé IA actif — domaine RH uniquement. Les autres domaines seront activés avec de futurs employés IA. Aucun employé actif disponible pour ce domaine.",
      source: "CloneOS",
      tab: "alertes",
      categories: ["alertes"],
      priority: "important",
      status: "new",
      createdAt: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
      employees: ["CloneOS"],
      tags: ["domaine non couvert", "aucun employé actif", "V1"],
      deliverables: [],
      cloneOSStatus: "blocked",
      actions: [
        { label: "Voir les employés disponibles", tone: "primary", href: "/profile/agents" },
        { label: "Voir les technologies", tone: "neutral", href: "/profile/technologies" },
      ],
    },
    {
      id: "msg-alert-refused-001",
      title: "Action refusée — invariant absolu CloneGuard",
      summary:
        "Paie officielle, licenciement, décision légale ou signature de contrat : refusés en autonomie IA.",
      body:
        "CloneGuard a refusé l'action via un invariant absolu : paie officielle / exécution paie / licenciement / décision légale / signature de contrat. Ces actions ne peuvent JAMAIS être exécutées par un employé IA CloneStore en autonomie. Décision humaine exclusive obligatoire. Aucun contournement possible.",
      source: "CloneGuard",
      tab: "alertes",
      categories: ["alertes"],
      priority: "critical",
      status: "new",
      createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      employees: ["CloneGuard"],
      tags: ["refusé", "invariant absolu", "paie", "licenciement", "légal"],
      deliverables: ["Motif de refus Guard"],
      guardDecision: "refuse",
      cloneOSStatus: "refused",
      actions: [
        { label: "Voir les règles Guard", tone: "primary", href: "/profile/technologies" },
        { label: "Non exécutable en autonomie IA", tone: "danger", readOnly: true },
      ],
    },
  ];
}

// ── PHASE 2.5 — Helpers messages center ──────────────────────────────────────
// Ces helpers préparent l'intégration future des données réelles.
// Pour l'instant, ils opèrent sur les données mock structurées.

function buildMessagesFromCloneOSPreview(
  result: Partial<CloneOSCommandCenterResult>,
  baseItems: MessageItem[],
): MessageItem[] {
  if (!result.status) return baseItems;
  const isAlert = result.status === "blocked" || result.status === "refused" || result.status === "requires_validation";
  if (!isAlert) return baseItems;
  return baseItems.filter((item) => item.tab === "alertes");
}

function buildMessagesFromTracePreview(
  eventType: GlobalTraceEventType,
  baseItems: MessageItem[],
): MessageItem[] {
  const traceItems = baseItems.filter(
    (item) => item.traceEventType === eventType,
  );
  return traceItems.length > 0 ? traceItems : baseItems;
}

function buildMessagesFromGuardPreview(
  decision: GlobalGuardDecision,
  baseItems: MessageItem[],
): MessageItem[] {
  return baseItems.filter((item) => item.guardDecision === decision);
}

function buildMessagesFromBriefPreview(
  briefType: CloneBriefType,
  baseItems: MessageItem[],
): MessageItem[] {
  return baseItems.filter((item) => item.briefType === briefType);
}

function groupMessagesByTab(
  items: MessageItem[],
): Record<MessageCenterTab, MessageItem[]> {
  return {
    suivis: items.filter((item) => item.tab === "suivis"),
    briefings: items.filter((item) => item.tab === "briefings"),
    livraisons: items.filter((item) => item.tab === "livraisons"),
    alertes: items.filter((item) => item.tab === "alertes"),
  };
}

function filterMessages(
  items: MessageItem[],
  filter: MessageCenterFilter,
  archivedIds: string[],
): MessageItem[] {
  return items
    .filter((item) => !archivedIds.includes(item.id))
    .filter((item) =>
      filter.tab === "all" ? true : item.tab === filter.tab,
    )
    .filter((item) => {
      const q = filter.query.trim().toLowerCase();
      if (!q) return true;
      const haystack = [
        item.title,
        item.summary,
        item.body,
        item.source,
        item.status,
        item.priority,
        item.tab,
        ...item.employees,
        ...item.tags,
        ...(item.deliverables ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
}

function countUnreadByTab(
  items: MessageItem[],
  readIds: string[],
  archivedIds: string[],
): Record<MessageCenterTab | "all", number> {
  const visible = items.filter(
    (item) => !archivedIds.includes(item.id) && !readIds.includes(item.id),
  );
  return {
    all: visible.length,
    suivis: visible.filter((item) => item.tab === "suivis").length,
    briefings: visible.filter((item) => item.tab === "briefings").length,
    livraisons: visible.filter((item) => item.tab === "livraisons").length,
    alertes: visible.filter((item) => item.tab === "alertes").length,
  };
}

function countUrgentAlerts(
  items: MessageItem[],
  archivedIds: string[],
): number {
  return items.filter(
    (item) =>
      !archivedIds.includes(item.id) &&
      item.tab === "alertes" &&
      (item.priority === "critical" || item.status === "waiting_validation"),
  ).length;
}

// ── Helpers d'affichage ───────────────────────────────────────────────────────

function safeArrayFromStorage(key: string) {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function saveArrayToStorage(key: string, value: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: MessageStatus) {
  if (status === "new") return "Nouveau";
  if (status === "in_progress") return "En cours";
  if (status === "waiting_validation") return "Validation requise";
  if (status === "delivered") return "Livré";
  if (status === "sent") return "Envoyé";
  if (status === "archived") return "Archivé";
  return "—";
}

function priorityLabel(priority: MessagePriority) {
  if (priority === "critical") return "Critique";
  if (priority === "important") return "Important";
  return "Normal";
}

function tabTone(tab: MessageCenterTab) {
  if (tab === "suivis") return "border-[#42a38a]/20 bg-[#42a38a]/10 text-[#158260]";
  if (tab === "briefings") return "border-[#c99a4d]/24 bg-[#c99a4d]/12 text-[#8f682d]";
  if (tab === "livraisons") return "border-[#7a6cff]/20 bg-[#7a6cff]/10 text-[#5c4ad3]";
  if (tab === "alertes") return "border-[#b84a4a]/22 bg-[#b84a4a]/10 text-[#b84a4a]";
  return "border-[#303747]/14 bg-[#303747]/7 text-[#303747]";
}

function priorityTone(priority: MessagePriority) {
  if (priority === "critical") return "border-[#b84a4a]/24 bg-[#b84a4a]/10 text-[#b84a4a]";
  if (priority === "important") return "border-[#c99a4d]/24 bg-[#c99a4d]/12 text-[#8f682d]";
  return "border-white/60 bg-white/42 text-[var(--cs-ink-3)]";
}

function statusTone(status: MessageStatus) {
  if (status === "waiting_validation") {
    return "border-[#b84a4a]/24 bg-[#b84a4a]/10 text-[#b84a4a]";
  }
  if (status === "delivered" || status === "sent") {
    return "border-[rgba(21,130,96,0.18)] bg-[rgba(21,130,96,0.09)] text-[var(--cs-success)]";
  }
  if (status === "in_progress") {
    return "border-[#6f83ff]/20 bg-[#6f83ff]/10 text-[#4f63d5]";
  }
  return "border-white/60 bg-white/42 text-[var(--cs-ink-3)]";
}

function getAgentName(slug: string) {
  const normalized = slug.toLowerCase();
  return AGENTS.find((agent) => agent.slug === normalized)?.name ?? normalized;
}

// ── Composants ────────────────────────────────────────────────────────────────

function ActionButton({
  children,
  href,
  onClick,
  primary = false,
  danger = false,
  icon,
  disabled = false,
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  primary?: boolean;
  danger?: boolean;
  icon?: ReactNode;
  disabled?: boolean;
}) {
  const className = cn(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition",
    primary ? "clone-liquid-button clone-liquid-button--dark" : "clone-liquid-button",
    danger && "border-[#b84a4a]/20 bg-[#b84a4a]/8 text-[#b84a4a]",
    disabled && "pointer-events-none opacity-55"
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        <span>{children}</span>
        {icon}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      <span>{children}</span>
      {icon}
    </button>
  );
}

function TabButton({
  category,
  count,
  unread,
  active,
  onClick,
}: {
  category: CategoryDefinition;
  count: number;
  unread: number;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = category.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition",
        active
          ? "border-white/70 bg-white/62 text-[var(--cs-ink-1)] shadow-[inset_0_1px_0_rgba(255,255,255,0.76),0_12px_30px_rgba(38,32,22,0.06)]"
          : "border-white/42 bg-white/24 text-[var(--cs-ink-3)]"
      )}
    >
      <Icon className="h-4 w-4" />
      {category.label}
      <span className="rounded-full bg-white/46 px-2 py-0.5 text-xs">{count}</span>
      {unread > 0 ? (
        <span className="h-2.5 w-2.5 rounded-full bg-[#667cff] shadow-[0_0_12px_rgba(102,124,255,0.5)]" />
      ) : null}
    </button>
  );
}

function EmptyState({
  title,
  text,
  icon,
}: {
  title: string;
  text: string;
  icon: ReactNode;
}) {
  return (
    <LiquidGlass variant="clear" intensity="soft" className="rounded-[1.75rem] p-6">
      <div className="grid min-h-[280px] place-items-center text-center">
        <div className="max-w-md">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-[1.25rem] border border-white/60 bg-white/42 text-[#667cff] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
            {icon}
          </div>
          <p className="text-lg font-semibold tracking-[-0.04em] text-[var(--cs-ink-1)]">
            {title}
          </p>
          <p className="mt-2 text-sm leading-7 text-[var(--cs-ink-3)]">{text}</p>
          <p className="mt-3 text-xs font-semibold text-[var(--cs-ink-4)]">
            Lecture seule — aucune action exécutée depuis la messagerie.
          </p>
        </div>
      </div>
    </LiquidGlass>
  );
}

// ── AlertesBanner ─────────────────────────────────────────────────────────────
// Bannière visible si des alertes Guard sont en attente.
// CloneGuard bloque cette action en autonomie. Validation humaine nécessaire.

function AlertesBanner({ urgentCount }: { urgentCount: number }) {
  if (urgentCount === 0) return null;

  return (
    <div className="flex items-start gap-3 rounded-[1.35rem] border border-[#b84a4a]/22 bg-[#b84a4a]/08 p-4">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#b84a4a]" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#b84a4a]">
          {urgentCount} alerte{urgentCount > 1 ? "s" : ""} en attente de décision humaine
        </p>
        <p className="mt-1 text-xs leading-5 text-[#b84a4a]/80">
          CloneGuard bloque les actions sensibles en autonomie. Validation humaine nécessaire
          avant toute exécution. Aucun employé IA ne peut agir seul.
        </p>
      </div>
      <Link
        href="/agents/pierre/use"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#b84a4a]/24 bg-[#b84a4a]/10 px-3 py-1.5 text-xs font-bold text-[#b84a4a] transition hover:bg-[#b84a4a]/16"
      >
        Cockpit Pierre
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProfileMessagesPage() {
  const { authState } = useAuthGate();

  const supabase = useMemo(() => {
    try {
      return getSessionClient() as SupabaseClient;
    } catch {
      return null;
    }
  }, []);

  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ── PHASE 3.1 / 3.4 — Real data state ───────────────────────────────────────
  // Données réelles depuis Supabase (lecture seule) ou fallback démo.
  // PHASE 3.4 : inclut les items CloneOS History (fusionnés dans loadMessageCenterReadOnlyItems).
  const [dataMode, setDataMode] = useState<MessageCenterDataMode>("demo_fallback");
  const [realMessageItems, setRealMessageItems] = useState<MessageCenterItem[]>([]);

  // ── PHASE 3.16 / 3.17 — Contexte système feed read-only ──────────────────────
  // Feed unifié Empreinte Entreprise + Historique CloneOS local.
  // localStorage-only. Aucun write DB. Aucun POST. Aucun message envoyé.
  // Aucune exécution CloneOS. localStorage reste le fallback actif.
  const [contextFeedResult, setContextFeedResult] =
    useState<ProfileMessagesContextFeedReadResult | null>(null);

  // ── PHASE 4.2 — Command Center Preview (simulation-only, au clic) ────────────
  const [runtimePreviewInput, setRuntimePreviewInput] = useState("");
  const [runtimePreviewSnapshot, setRuntimePreviewSnapshot] =
    useState<RuntimeIntegrationPreviewSnapshot | null>(null);
  const [runtimePreviewLoading, setRuntimePreviewLoading] = useState(false);
  const [runtimePreviewError, setRuntimePreviewError] = useState<string | null>(null);

  // ── PHASE 4.3 — Brouillon de mission (local/in-memory, au clic) ──────────────
  const [runtimeMissionDraftPreview, setRuntimeMissionDraftPreview] =
    useState<RuntimeMissionDraftSnapshot | null>(null);
  const [runtimeMissionDraftError, setRuntimeMissionDraftError] = useState<string | null>(null);

  // Simulation déclenchée UNIQUEMENT au clic "Simuler". Jamais au montage.
  // POST simulation-only — aucune mission créée, aucun write, aucun appel IA.
  const runRuntimeSimulation = useCallback(async (text: string) => {
    const raw = text.trim();
    if (!raw) {
      setRuntimePreviewError("Saisis une commande pour prévisualiser le plan runtime.");
      return;
    }
    setRuntimePreviewLoading(true);
    setRuntimePreviewError(null);
    // Nouvelle simulation → reset du brouillon local + statut safe apply précédents.
    setRuntimeMissionDraftPreview(null);
    setRuntimeMissionDraftError(null);
    setRuntimeMissionDraftPersistUi(null);
    setRuntimeMissionDraftPersistError(null);
    setRestoredRuntimeMissionDraftTitle(null);
    setRuntimeMissionDraftRestoreResult(null);
    setRuntimeMissionPromotionUi(null);
    setRuntimeMissionPromotionError(null);
    try {
      const response = await postRuntimeIntegrationSimulation({ raw_text: raw, mode: "simulation" });
      if (response.ok && response.result) {
        setRuntimePreviewSnapshot(buildRuntimeIntegrationPreviewSnapshot(response.result));
      } else {
        setRuntimePreviewError(response.error?.message ?? "Simulation indisponible.");
      }
    } catch {
      setRuntimePreviewError("Simulation indisponible — réessayer.");
    } finally {
      setRuntimePreviewLoading(false);
    }
  }, []);

  // ── PHASE 4.3 — Préparer un brouillon de mission LOCAL (au clic uniquement) ──
  // Aucune mission créée en base. Aucun fetch. Aucun write. Aucun appel Pierre.
  const handlePrepareRuntimeMissionDraft = useCallback(() => {
    if (!runtimePreviewSnapshot) {
      setRuntimeMissionDraftError("Lance une simulation puis prépare un brouillon local.");
      return;
    }
    try {
      const draft = buildRuntimeMissionDraftFromIntegrationResult(runtimePreviewSnapshot.result, {
        source: "command_center_preview",
      });
      const validation = validateRuntimeMissionDraft(draft);
      if (!validation.valid) {
        setRuntimeMissionDraftError("Brouillon non conforme — invariants no-execution.");
        return;
      }
      setRuntimeMissionDraftError(null);
      setRuntimeMissionDraftPreview(buildRuntimeMissionDraftLocalPreview(draft));
      // Nouveau brouillon → reset du statut safe apply + aperçu promotion précédents.
      setRuntimeMissionDraftPersistUi(null);
      setRuntimeMissionDraftPersistError(null);
      setRuntimeMissionPromotionUi(null);
      setRuntimeMissionPromotionError(null);
    } catch {
      setRuntimeMissionDraftError("Brouillon indisponible.");
    }
  }, [runtimePreviewSnapshot]);

  // ── PHASE 4.5 — Safe Apply : sauvegarde locale + serveur best-effort flaggé ───
  const [runtimeMissionDraftPersistUi, setRuntimeMissionDraftPersistUi] =
    useState<RuntimeMissionDraftSafeApplyUiSnapshot | null>(null);
  const [runtimeMissionDraftPersistLoading, setRuntimeMissionDraftPersistLoading] = useState(false);
  const [runtimeMissionDraftPersistError, setRuntimeMissionDraftPersistError] = useState<string | null>(null);
  const [restoredRuntimeMissionDraftTitle, setRestoredRuntimeMissionDraftTitle] = useState<string | null>(null);

  // ── PHASE 4.7 — Statut restore UI (statut local/serveur, source effective) ──
  // Dérivé des résultats P4.5 existants. Aucun fetch, aucun write, aucune exécution.
  const [runtimeMissionDraftRestoreResult, setRuntimeMissionDraftRestoreResult] =
    useState<RuntimeMissionDraftSafeApplyRestoreResult | null>(null);
  const [runtimeMissionDraftLastLocalSavedAt, setRuntimeMissionDraftLastLocalSavedAt] =
    useState<string | null>(null);
  const [runtimeMissionDraftLastAttemptAt, setRuntimeMissionDraftLastAttemptAt] =
    useState<string | null>(null);

  // Sauvegarde du brouillon — au clic uniquement. localStorage-first.
  // La sauvegarde concerne uniquement le brouillon, pas une mission réelle.
  const handleSaveRuntimeMissionDraft = useCallback(async () => {
    if (!runtimePreviewSnapshot) {
      setRuntimeMissionDraftPersistError("Prépare un brouillon avant de le sauvegarder.");
      return;
    }
    setRuntimeMissionDraftPersistLoading(true);
    setRuntimeMissionDraftPersistError(null);
    try {
      const draft = buildRuntimeMissionDraftFromIntegrationResult(runtimePreviewSnapshot.result, {
        source: "command_center_preview",
      });
      const result = await persistRuntimeMissionDraftWithFallback(draft);
      setRuntimeMissionDraftPersistUi(buildRuntimeMissionDraftSafeApplyUiSnapshot(result));
      if (result.local_saved) setRuntimeMissionDraftLastLocalSavedAt(result.attempted_at);
      setRuntimeMissionDraftLastAttemptAt(result.attempted_at);
    } catch {
      setRuntimeMissionDraftPersistError("Sauvegarde indisponible.");
    } finally {
      setRuntimeMissionDraftPersistLoading(false);
    }
  }, [runtimePreviewSnapshot]);

  // Restauration du dernier brouillon local — au clic uniquement.
  const handleRestoreRuntimeMissionDraft = useCallback(async () => {
    setRuntimeMissionDraftPersistError(null);
    try {
      const result = await restoreRuntimeMissionDraftWithFallback({ force_local_only: true });
      setRuntimeMissionDraftRestoreResult(result);
      setRuntimeMissionDraftLastAttemptAt(result.attempted_at);
      if (result.draft) {
        setRestoredRuntimeMissionDraftTitle(result.draft.title);
      } else {
        setRestoredRuntimeMissionDraftTitle(null);
        setRuntimeMissionDraftPersistError("Aucun brouillon local à restaurer.");
      }
    } catch {
      setRuntimeMissionDraftPersistError("Restauration indisponible.");
    }
  }, []);

  // ── PHASE 4.7 — Snapshot statut restore (pur, dérivé, aucun appel réseau) ─────
  // Construit après sauvegarde locale / tentative serveur / restore local, et à
  // l'état initial sans auto-call. Le serveur reste feature-flaggé (activation P4.6).
  const runtimeMissionDraftRestoreUi = useMemo(
    () =>
      buildRuntimeMissionDraftRestoreUiSnapshot({
        lastPersistResult: runtimeMissionDraftPersistUi?.result ?? null,
        lastRestoreResult: runtimeMissionDraftRestoreResult,
        featureFlagEnabled: isRuntimeMissionDraftServerPersistenceEnabled(),
        localSavedAt: runtimeMissionDraftLastLocalSavedAt,
        lastAttemptAt: runtimeMissionDraftLastAttemptAt,
        manualActivationKnown: false,
      }),
    [
      runtimeMissionDraftPersistUi,
      runtimeMissionDraftRestoreResult,
      runtimeMissionDraftLastLocalSavedAt,
      runtimeMissionDraftLastAttemptAt,
    ]
  );

  // ── PHASE 4.9 — Aperçu promotion en mission contrôlée (read-only, au clic) ────
  // Aucune promotion appliquée, aucune mission réelle, aucune exécution,
  // aucun appel Pierre / IA, aucun write. Aperçu construit UNIQUEMENT au clic.
  const [runtimeMissionPromotionUi, setRuntimeMissionPromotionUi] =
    useState<RuntimeMissionPromotionSnapshot | null>(null);
  const [runtimeMissionPromotionError, setRuntimeMissionPromotionError] = useState<string | null>(null);

  const handlePreviewControlledMissionPromotion = useCallback(() => {
    if (!runtimePreviewSnapshot) {
      setRuntimeMissionPromotionError("Prépare un brouillon avant de prévisualiser la promotion.");
      return;
    }
    try {
      const draft = buildRuntimeMissionDraftFromIntegrationResult(runtimePreviewSnapshot.result, {
        source: "command_center_preview",
      });
      const validation = validateRuntimeMissionDraft(draft);
      if (!validation.valid) {
        setRuntimeMissionPromotionError("Brouillon non conforme — aperçu de promotion indisponible.");
        return;
      }
      const contract = buildRuntimeMissionPromotionContract(draft);
      setRuntimeMissionPromotionUi(buildRuntimeMissionPromotionSnapshot(contract));
      setRuntimeMissionPromotionError(null);
    } catch {
      setRuntimeMissionPromotionError("Aperçu de promotion indisponible.");
    }
  }, [runtimePreviewSnapshot]);

  // ── PHASE 5.1 — Controlled Mission Safe Apply (localStorage-first) ────────────
  // Crée une mission contrôlée LOCALE au clic. Jamais exécutée, jamais envoyée,
  // jamais persistée serveur, jamais connectée à Pierre runtime. localStorage only.
  const [localControlledMissions, setLocalControlledMissions] = useState<LocalControlledMission[]>([]);
  const [controlledMissionSafeApplyResult, setControlledMissionSafeApplyResult] =
    useState<ControlledMissionSafeApplyResult | null>(null);

  const reloadLocalControlledMissions = useCallback(() => {
    try {
      setLocalControlledMissions(loadLocalControlledMissions());
    } catch {
      setLocalControlledMissions([]);
    }
  }, []);

  // Lecture seule au montage (affichage). Aucun write, aucune exécution.
  useEffect(() => {
    reloadLocalControlledMissions();
  }, [reloadLocalControlledMissions]);

  const handleCreateLocalControlledMission = useCallback(() => {
    if (!runtimeMissionPromotionUi) return;
    try {
      const result = createLocalControlledMission(runtimeMissionPromotionUi.contract, {});
      setControlledMissionSafeApplyResult(result);
      reloadLocalControlledMissions();
    } catch {
      setControlledMissionSafeApplyResult(null);
    }
  }, [runtimeMissionPromotionUi, reloadLocalControlledMissions]);

  // ── PHASE 5.2 — Controlled Mission Local Review (validation humaine locale) ───
  // Revue / décision LOCALE. Même approuvée, la mission n'est PAS exécutée :
  // aucun runtime, aucun serveur, aucun Pierre, aucune IA, aucun email/document.
  const [controlledMissionReviewResult, setControlledMissionReviewResult] =
    useState<LocalControlledMissionReviewResult | null>(null);

  const handleStartReview = useCallback(
    (id: string) => {
      setControlledMissionReviewResult(startLocalControlledMissionReview(id));
      reloadLocalControlledMissions();
    },
    [reloadLocalControlledMissions]
  );

  const handleApproveLocal = useCallback(
    (id: string) => {
      setControlledMissionReviewResult(approveLocalControlledMission(id, "Revue humaine locale terminée."));
      reloadLocalControlledMissions();
    },
    [reloadLocalControlledMissions]
  );

  const handleRequestChanges = useCallback(
    (id: string) => {
      setControlledMissionReviewResult(
        requestChangesForLocalControlledMission(id, ["Compléter les informations manquantes."], "Modifications demandées localement.")
      );
      reloadLocalControlledMissions();
    },
    [reloadLocalControlledMissions]
  );

  const handleBlockLocal = useCallback(
    (id: string) => {
      setControlledMissionReviewResult(blockLocalControlledMission(id, "Bloquée localement après revue.", "Blocage local."));
      reloadLocalControlledMissions();
    },
    [reloadLocalControlledMissions]
  );

  const handleArchiveLocalControlledMission = useCallback(
    (id: string) => {
      setControlledMissionReviewResult(archiveReviewedLocalControlledMission(id));
      reloadLocalControlledMissions();
    },
    [reloadLocalControlledMissions]
  );

  // ── PHASE 5.3 — Controlled Mission Preflight (readiness gate locale) ──────────
  // Preflight LOCAL au clic. « ready » = candidate future exécution gouvernée,
  // JAMAIS exécution. Aucun runtime, aucun serveur, aucun Pierre, aucune IA.
  const [controlledMissionPreflightResult, setControlledMissionPreflightResult] =
    useState<LocalControlledMissionPreflightResult | null>(null);

  const handleRunPreflight = useCallback(
    (id: string) => {
      setControlledMissionPreflightResult(runLocalControlledMissionPreflight(id));
      reloadLocalControlledMissions();
    },
    [reloadLocalControlledMissions]
  );

  // ── PHASE 5.4 — Controlled Mission Server Persistence (design-only) ───────────
  // Lecture seule. « Voir le draft serveur » / « Voir prérequis serveur ».
  // Aucune persistance, aucune donnée envoyée, aucune mission serveur créée.
  const [serverDraftViewId, setServerDraftViewId] = useState<string | null>(null);
  const [serverReqViewId, setServerReqViewId] = useState<string | null>(null);

  // ── PHASE 5.5 — Server Persistence Manual Activation QA (lecture seule) ───────
  // « Voir checklist QA » / « Voir runbook manuel ». Aucune activation.
  const [showServerQaChecklist, setShowServerQaChecklist] = useState(false);
  const [showServerQaRunbook, setShowServerQaRunbook] = useState(false);

  // ── PHASE 5.6 — Server Restore UI (design-only, lecture seule) ────────────────
  // « Voir état restore » / « Voir parcours futur ». Aucun GET serveur.
  const [showRestoreState, setShowRestoreState] = useState(false);
  const [showRestoreFuture, setShowRestoreFuture] = useState(false);

  // ── PHASE 5.7 — Final Gate P5 (design-only, lecture seule) ────────────────────
  // « Voir final gate » / « Voir invariants » / « Voir prochaines étapes ».
  const [showFinalGate, setShowFinalGate] = useState(false);
  const [showFinalInvariants, setShowFinalInvariants] = useState(false);
  const [showFinalNextSteps, setShowFinalNextSteps] = useState(false);

  // ── PHASE 5.8 — Transition Plan (design-only, lecture seule) ──────────────────
  const [showTransitionPlan, setShowTransitionPlan] = useState(false);
  const [showTransitionRisks, setShowTransitionRisks] = useState(false);
  const [showTransitionRollback, setShowTransitionRollback] = useState(false);
  const [showTransitionNextSteps, setShowTransitionNextSteps] = useState(false);

  // ── PHASE 5.9 — Operator Handbook (design-only, lecture seule) ────────────────
  const [showHandbook, setShowHandbook] = useState(false);
  const [showHandbookWorkflows, setShowHandbookWorkflows] = useState(false);
  const [showHandbookPlaybooks, setShowHandbookPlaybooks] = useState(false);
  const [showHandbookCommands, setShowHandbookCommands] = useState(false);
  const [showHandbookDecisions, setShowHandbookDecisions] = useState(false);

  // ── PHASE 5.10 — Phase 5 Closure (design-only, lecture seule) ─────────────────
  const [showClosure, setShowClosure] = useState(false);
  const [showClosureBlocks, setShowClosureBlocks] = useState(false);
  const [showClosureRisks, setShowClosureRisks] = useState(false);
  const [showClosureP6, setShowClosureP6] = useState(false);
  const [showClosureVerdict, setShowClosureVerdict] = useState(false);

  // ── PHASE 6.1 — Pierre Sellable Master Audit (audit-only, lecture seule) ──────
  const [showSellableAudit, setShowSellableAudit] = useState(false);
  const [showSellableBlockers, setShowSellableBlockers] = useState(false);
  const [showSellableP6, setShowSellableP6] = useState(false);
  const [showSellableCriteria, setShowSellableCriteria] = useState(false);

  // ── PHASE 6.2 — Pierre Workflow Pack (5 scénarios, lecture seule) ─────────────
  const [showWorkflowScenarios, setShowWorkflowScenarios] = useState(false);
  const [showWorkflowDeliverables, setShowWorkflowDeliverables] = useState(false);
  const [showWorkflowValidations, setShowWorkflowValidations] = useState(false);
  const [showWorkflowRisks, setShowWorkflowRisks] = useState(false);
  const [showWorkflowValue, setShowWorkflowValue] = useState(false);

  // ── PHASE 6.3 — Pierre Decision Gate (decision-only, lecture seule) ───────────
  const [showGateDecision, setShowGateDecision] = useState(false);
  const [showGateConditions, setShowGateConditions] = useState(false);
  const [showGateNoGo, setShowGateNoGo] = useState(false);
  const [showGateApprovals, setShowGateApprovals] = useState(false);
  const [showGateRollback, setShowGateRollback] = useState(false);
  const [showGateP6, setShowGateP6] = useState(false);

  // ── PHASE 6.4 — Pierre Identité & canaux (readiness, lecture seule) ───────────
  const [showIdentity, setShowIdentity] = useState(false);
  const [showIdentityChannels, setShowIdentityChannels] = useState(false);
  const [showIdentityEmail, setShowIdentityEmail] = useState(false);
  const [showIdentityPermissions, setShowIdentityPermissions] = useState(false);
  const [showIdentityTemplates, setShowIdentityTemplates] = useState(false);
  const [showIdentityDomain, setShowIdentityDomain] = useState(false);

  // ── PHASE 6.5 — Pierre Activation client E2E (proof path, lecture seule) ──────
  const [showActJourney, setShowActJourney] = useState(false);
  const [showActFirstValue, setShowActFirstValue] = useState(false);
  const [showActAccess, setShowActAccess] = useState(false);
  const [showActScenarios, setShowActScenarios] = useState(false);
  const [showActEvidence, setShowActEvidence] = useState(false);
  const [showActBlockers, setShowActBlockers] = useState(false);

  // ── PHASE 6.6 — Pierre Sellable Gate Final (verdict contrôlé, lecture seule) ──
  const [showGateVerdict, setShowGateVerdict] = useState(false);
  const [showGateEvidence, setShowGateEvidence] = useState(false);
  const [showGateAllowed, setShowGateAllowed] = useState(false);
  const [showGateForbidden, setShowGateForbidden] = useState(false);
  const [showSGateConditions, setShowSGateConditions] = useState(false);
  const [showGateBlockers, setShowGateBlockers] = useState(false);

  // ── PHASE 7.1 — External Go-Live Proofs Gate (preuves externes, lecture seule) ──
  const [showEglStripe, setShowEglStripe] = useState(false);
  const [showEglSupabase, setShowEglSupabase] = useState(false);
  const [showEglDomain, setShowEglDomain] = useState(false);
  const [showEglCustomer, setShowEglCustomer] = useState(false);
  const [showEglManual, setShowEglManual] = useState(false);
  const [showEglBlockers, setShowEglBlockers] = useState(false);

  // ── PHASE 7.2 — First Live Customer Controlled Run (premier client réel, lecture seule) ──
  const [showFlcQualification, setShowFlcQualification] = useState(false);
  const [showFlcRunbook, setShowFlcRunbook] = useState(false);
  const [showFlcEvidence, setShowFlcEvidence] = useState(false);
  const [showFlcNoGo, setShowFlcNoGo] = useState(false);
  const [showFlcRollback, setShowFlcRollback] = useState(false);
  const [showFlcNext, setShowFlcNext] = useState(false);

  // ── PHASE 7.3 — First Customer Evidence Review (audit preuves réelles, lecture seule) ──
  const [showFcerMatrix, setShowFcerMatrix] = useState(false);
  const [showFcerRules, setShowFcerRules] = useState(false);
  const [showFcerCriteria, setShowFcerCriteria] = useState(false);
  const [showFcerLaunchGate, setShowFcerLaunchGate] = useState(false);
  const [showFcerGoLive, setShowFcerGoLive] = useState(false);
  const [showFcerDecision, setShowFcerDecision] = useState(false);

  // ── PHASE 7.4 — Customer Evidence Applied / Second Customer (application contrôlée, lecture seule) ──
  const [showCeaApplication, setShowCeaApplication] = useState(false);
  const [showCeaContribution, setShowCeaContribution] = useState(false);
  const [showCeaSecondCustomer, setShowCeaSecondCustomer] = useState(false);
  const [showCeaComparison, setShowCeaComparison] = useState(false);
  const [showCeaSafetyGate, setShowCeaSafetyGate] = useState(false);
  const [showCeaRunbook, setShowCeaRunbook] = useState(false);

  // ── PHASE 7.5 — Second Customer Controlled Run / Public Launch Prep (lecture seule) ──
  const [showSc2Qualification, setShowSc2Qualification] = useState(false);
  const [showSc2Runbook, setShowSc2Runbook] = useState(false);
  const [showSc2Evidence, setShowSc2Evidence] = useState(false);
  const [showSc2Comparison, setShowSc2Comparison] = useState(false);
  const [showSc2Reproducibility, setShowSc2Reproducibility] = useState(false);
  const [showSc2LaunchPrep, setShowSc2LaunchPrep] = useState(false);

  // ── PHASE 7.6 — Public Launch Final Review Gate (verdict final Phase 7, lecture seule) ──
  const [showPlfVerdict, setShowPlfVerdict] = useState(false);
  const [showPlfBlockers, setShowPlfBlockers] = useState(false);
  const [showPlfProofs, setShowPlfProofs] = useState(false);
  const [showPlfClaims, setShowPlfClaims] = useState(false);
  const [showPlfActions, setShowPlfActions] = useState(false);
  const [showPlfClosure, setShowPlfClosure] = useState(false);

  const [activeTab, setActiveTab] = useState<MessageCenterTab | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [readIds, setReadIds] = useState<string[]>([]);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [archivedIds, setArchivedIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!supabase) {
      setLoading(false);
      setAuthReady(true);
      setDataMode("demo_fallback");
      setError(
        "Configuration Supabase manquante. La messagerie s'affiche en aperçu local."
      );
      return;
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      const currentUserId = authData.user?.id ?? null;
      setUserId(currentUserId);

      if (!currentUserId) {
        setOrders([]);
        setDataMode("auth_required");
        setLoading(false);
        setAuthReady(true);
        return;
      }

      const { data, error: ordersError } = await supabase
        .from("orders")
        .select("id, agent_slug, status, started_at, ended_at")
        .eq("user_id", currentUserId)
        .order("started_at", { ascending: false });

      if (ordersError) throw ordersError;
      setOrders((data ?? []) as OrderRow[]);

      // ── PHASE 3.1 — Charger les données réelles read-only ─────────────────
      // Lecture seule depuis pierre_missions, pierre_tasks, pierre_documents,
      // pierre_outbound_emails. Aucun write. Fallback démo si vide ou erreur.
      const realResult = await loadMessageCenterReadOnlyItems(supabase, currentUserId);
      setDataMode(realResult.mode);
      setRealMessageItems(realResult.items);
    } catch (loadError) {
      setDataMode("error");
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Impossible de charger la messagerie CloneStore."
      );
      setOrders([]);
    } finally {
      setLoading(false);
      setAuthReady(true);
    }
  }, [supabase]);

  useEffect(() => {
    setReadIds(safeArrayFromStorage(STORAGE_KEYS.read));
    setPinnedIds(safeArrayFromStorage(STORAGE_KEYS.pinned));
    setArchivedIds(safeArrayFromStorage(STORAGE_KEYS.archived));
    void load();
  }, [load]);

  // ── PHASE 3.17 — Charger le contexte système unifié en lecture seule ─────────
  // Client-only. localStorage. Aucun write. Aucun POST. Aucun message envoyé.
  // Aucune exécution CloneOS — plan-only / read-only.
  useEffect(() => {
    const result = loadProfileMessagesContextFeed();
    setContextFeedResult(result);
  }, []);

  useEffect(() => {
    saveArrayToStorage(STORAGE_KEYS.read, readIds);
  }, [readIds]);

  useEffect(() => {
    saveArrayToStorage(STORAGE_KEYS.pinned, pinnedIds);
  }, [pinnedIds]);

  useEffect(() => {
    saveArrayToStorage(STORAGE_KEYS.archived, archivedIds);
  }, [archivedIds]);

  const activeOrders = useMemo(
    () => orders.filter((order) => order.status.toLowerCase() === "active"),
    [orders]
  );

  const ownedEmployeeNames = useMemo(() => {
    const names = activeOrders.map((order) => getAgentName(order.agent_slug));
    return Array.from(new Set(names));
  }, [activeOrders]);

  const allMessages = useMemo(
    () => buildInitialMessages(ownedEmployeeNames),
    [ownedEmployeeNames]
  );

  const filter = useMemo<MessageCenterFilter>(
    () => ({ tab: activeTab, query, showUnreadOnly: false }),
    [activeTab, query]
  );

  const visibleMessages = useMemo(() => {
    return filterMessages(allMessages, filter, archivedIds)
      .sort((a, b) => {
        const pinnedA = pinnedIds.includes(a.id) ? 1 : 0;
        const pinnedB = pinnedIds.includes(b.id) ? 1 : 0;
        if (pinnedA !== pinnedB) return pinnedB - pinnedA;
        const criticalA = a.priority === "critical" ? 1 : 0;
        const criticalB = b.priority === "critical" ? 1 : 0;
        if (criticalA !== criticalB) return criticalB - criticalA;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [filter, allMessages, archivedIds, pinnedIds]);

  const selectedMessage = useMemo(() => {
    if (selectedId) {
      const exact = visibleMessages.find((message) => message.id === selectedId);
      if (exact) return exact;
    }
    return visibleMessages[0] ?? null;
  }, [selectedId, visibleMessages]);

  useEffect(() => {
    if (!selectedMessage) return;
    setSelectedId(selectedMessage.id);
  }, [selectedMessage]);

  const groupedByTab = useMemo(
    () => groupMessagesByTab(allMessages.filter((item) => !archivedIds.includes(item.id))),
    [allMessages, archivedIds]
  );

  const unreadByTab = useMemo(
    () => countUnreadByTab(allMessages, readIds, archivedIds),
    [allMessages, readIds, archivedIds]
  );

  const urgentAlertCount = useMemo(
    () => countUrgentAlerts(allMessages, archivedIds),
    [allMessages, archivedIds]
  );

  const totalVisible = allMessages.filter(
    (item) => !archivedIds.includes(item.id)
  ).length;

  function togglePinned(id: string) {
    setPinnedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function markRead(id: string) {
    setReadIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  function archiveMessage(id: string) {
    setArchivedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  function restoreArchived() {
    setArchivedIds([]);
  }

  return (
    <main className="cs-page">
      <div className="cs-page-shell">
        <div className="space-y-5">
          {/* Hero */}
          <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <span className="cs-pill">
                  <MessagesSquare className="h-3.5 w-3.5 text-[#667cff]" />
                  Messages CloneStore
                </span>
                <span className="cs-pill">
                  <ShieldCheck className="h-3.5 w-3.5 text-[var(--cs-success)]" />
                  4 onglets opérationnels
                </span>
                <span className="cs-pill">
                  <BadgeCheck className="h-3.5 w-3.5 text-[var(--cs-violet)]" />
                  Pierre actif — RH
                </span>
                <span className="cs-pill">
                  <Bell className="h-3.5 w-3.5 text-[#b84a4a]" />
                  {unreadByTab.all} non lu{unreadByTab.all !== 1 ? "s" : ""}
                </span>
                {urgentAlertCount > 0 ? (
                  <span className="cs-pill">
                    <ShieldAlert className="h-3.5 w-3.5 text-[#b84a4a]" />
                    {urgentAlertCount} alerte{urgentAlertCount > 1 ? "s" : ""} Guard
                  </span>
                ) : null}
              </div>

              <h1 className="cs-heading mt-4 text-[clamp(2.1rem,4vw,4.7rem)] leading-[0.94]">
                Messages CloneStore
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--cs-ink-3)] md:text-base">
                Suivez vos missions, briefings, livraisons et alertes depuis un seul centre.
                Lecture seule — aucune action exécutée depuis la messagerie.
                Pierre est le seul employé IA actif en V1.
              </p>
            </div>

            {/* Liens utiles PHASE 2.5 */}
            <div className="flex flex-wrap items-center gap-2">
              <ActionButton href="/profile/agents" icon={<LayoutDashboard className="h-4 w-4" />}>
                Mon espace
              </ActionButton>
              <ActionButton href="/agents/pierre/use" primary icon={<Sparkles className="h-4 w-4" />}>
                Cockpit Pierre
              </ActionButton>
              <ActionButton href="/profile/technologies" icon={<Network className="h-4 w-4" />}>
                Technologies
              </ActionButton>
            </div>
          </section>

          {/* Bannière alertes Guard */}
          <AlertesBanner urgentCount={urgentAlertCount} />

          {/* ── PHASE 3.1 — Badge données réelles / démo locale ────────────────
              Affiche l'état des données : réelles read-only, démo locale,
              connexion requise, ou aperçu démo si erreur.
              Lecture seule — aucune action exécutée depuis la messagerie. */}
          {dataMode !== "demo_fallback" ? (
            <div className={cn(
              "flex flex-col gap-2 rounded-[1.25rem] border px-4 py-3",
              dataMode === "real_readonly"
                ? "border-[rgba(21,130,96,0.22)] bg-[rgba(21,130,96,0.08)]"
                : dataMode === "auth_required"
                  ? "border-[#6f83ff]/22 bg-[#6f83ff]/07"
                  : "border-[#c99a4d]/22 bg-[#c99a4d]/07"
            )}>
              <div className="flex items-center gap-3">
                <ShieldCheck className={cn(
                  "h-4 w-4 shrink-0",
                  dataMode === "real_readonly" ? "text-[var(--cs-success)]" :
                  dataMode === "auth_required" ? "text-[#6f83ff]" : "text-[#c99a4d]"
                )} />
                <p className={cn(
                  "text-xs font-semibold",
                  dataMode === "real_readonly" ? "text-[var(--cs-success)]" :
                  dataMode === "auth_required" ? "text-[#4f63d5]" : "text-[#8f682d]"
                )}>
                  {DATA_MODE_LABELS[dataMode]}
                  {" — "}
                  Lecture seule — aucune action exécutée depuis la messagerie.
                </p>
              </div>
              {/* PHASE 3.4 — Badge CloneOS History connecté */}
              {dataMode === "real_readonly" && hasCloneOSHistoryMessageItems(realMessageItems) ? (
                <div className="flex items-center gap-2 pl-7">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--cs-success)]" />
                  <p className="text-[0.68rem] font-semibold text-[var(--cs-success)]">
                    CloneOS History connecté — {countCloneOSHistoryMessageItems(realMessageItems)} commande{countCloneOSHistoryMessageItems(realMessageItems) !== 1 ? "s" : ""} — lecture seule
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-[1.25rem] border border-white/45 bg-white/22 px-4 py-3">
              <FileText className="h-4 w-4 shrink-0 text-[var(--cs-ink-4)]" />
              <p className="text-xs font-semibold text-[var(--cs-ink-4)]">
                {DATA_MODE_LABELS["demo_fallback"]}
                {" — "}
                Lecture seule — aucune action exécutée depuis la messagerie.
              </p>
            </div>
          )}

          {error ? (
            <LiquidGlass variant="clear" intensity="soft" className="rounded-[1.4rem] p-4">
              <div className="flex items-start gap-3 text-[#b84a4a]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="text-sm font-medium leading-6">{error}</p>
              </div>
            </LiquidGlass>
          ) : null}

          {/* ── PHASE 3.17 — Contexte système CloneStore (feed unifié) ──────────
              Fusion read-only Empreinte Entreprise (P3.16) + Historique CloneOS.
              Lecture seule. Aucune action exécutée. Aucun message envoyé.
              Aucune exécution CloneOS. localStorage reste le fallback actif. */}
          {contextFeedResult ? (
            contextFeedResult.has_enterprise_footprint || contextFeedResult.has_cloneos_history ? (
              <LiquidGlass
                variant="panel"
                intensity="medium"
                className="rounded-[1.75rem] p-4 md:p-5"
              >
                {/* En-tête */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className="cs-pill">
                        <Waypoints className="h-3.5 w-3.5 text-[#667cff]" />
                        Contexte système CloneStore
                      </span>
                      {contextFeedResult.has_enterprise_footprint ? (
                        <span className="cs-pill">
                          <BriefcaseBusiness className="h-3.5 w-3.5 text-[#667cff]" />
                          Empreinte Entreprise
                        </span>
                      ) : null}
                      {contextFeedResult.has_cloneos_history ? (
                        <span className="cs-pill">
                          <Network className="h-3.5 w-3.5 text-[var(--cs-violet)]" />
                          Historique CloneOS local
                        </span>
                      ) : null}
                      <span className="cs-pill">
                        <FileText className="h-3.5 w-3.5 text-[var(--cs-ink-4)]" />
                        Lecture seule
                      </span>
                      <span className="cs-pill">
                        <ShieldCheck className="h-3.5 w-3.5 text-[var(--cs-success)]" />
                        Aucune action exécutée
                      </span>
                      <span className="cs-pill">
                        <ShieldCheck className="h-3.5 w-3.5 text-[var(--cs-success)]" />
                        Aucun message envoyé
                      </span>
                    </div>
                    <p className="mt-3 text-base font-semibold tracking-[-0.03em] text-[var(--cs-ink-1)]">
                      {contextFeedResult.summary.company_name || "Contexte système"}
                    </p>
                    <p className="mt-1.5 text-xs leading-5 text-[var(--cs-ink-4)]">
                      Empreinte : {contextFeedResult.has_enterprise_footprint ? "oui" : "non"} ·
                      {" "}Historique CloneOS : {contextFeedResult.has_cloneos_history ? "oui" : "non"} ·
                      {" "}{contextFeedResult.summary.total_items_count} élément
                      {contextFeedResult.summary.total_items_count !== 1 ? "s" : ""} ·
                      {" "}{contextFeedResult.summary.warnings_count} avertissement
                      {contextFeedResult.summary.warnings_count !== 1 ? "s" : ""}.
                      {" "}localStorage reste le fallback actif.
                    </p>
                  </div>

                  {/* Accès rapide */}
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link
                      href="/profile/onboarding"
                      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/50 bg-white/30 px-3 text-xs font-semibold text-[var(--cs-ink-3)] transition hover:bg-white/44"
                    >
                      Onboarding
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <Link
                      href="/agents/pierre/use"
                      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#667cff]/22 bg-[#667cff]/08 px-3 text-xs font-semibold text-[#4f63d5] transition hover:bg-[#667cff]/14"
                    >
                      Cockpit Pierre
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Sections */}
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {contextFeedResult.sections
                    .filter((section) => section.kind !== "recommendations")
                    .map((section) => (
                      <div
                        key={section.id}
                        className="rounded-[1.35rem] border border-white/45 bg-white/20 p-4"
                      >
                        <div className="flex items-center gap-2">
                          {section.kind === "cloneos_history" ? (
                            <Network className="h-4 w-4 text-[var(--cs-violet)]" />
                          ) : (
                            <BriefcaseBusiness className="h-4 w-4 text-[#667cff]" />
                          )}
                          <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                            {section.title}
                          </p>
                        </div>
                        <p className="mt-1 text-[0.68rem] leading-5 text-[var(--cs-ink-4)]">
                          {section.description}
                        </p>
                        <div className="mt-3 grid gap-2">
                          {section.items.map((item) => (
                            <div
                              key={item.id}
                              className={cn(
                                "flex items-start gap-2.5 rounded-[1rem] border px-3 py-2",
                                item.severity === "blocking"
                                  ? "border-[#b84a4a]/20 bg-[#b84a4a]/06"
                                  : item.severity === "warning"
                                  ? "border-[#c99a4d]/20 bg-[#c99a4d]/06"
                                  : "border-white/45 bg-white/24"
                              )}
                            >
                              <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--cs-ink-4)]" />
                              <div className="min-w-0 flex-1">
                                <p className="text-[0.72rem] font-semibold text-[var(--cs-ink-2)]">
                                  {item.title}
                                </p>
                                <p className="mt-0.5 line-clamp-2 text-[0.66rem] leading-4 text-[var(--cs-ink-4)]">
                                  {item.body}
                                </p>
                              </div>
                              {item.action_href ? (
                                <Link
                                  href={item.action_href}
                                  className="shrink-0 text-[0.64rem] font-bold text-[#4f63d5] hover:underline"
                                >
                                  {item.action_label ?? "→"}
                                </Link>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>

                {/* Recommendations */}
                {contextFeedResult.recommendations.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {contextFeedResult.recommendations.slice(0, 4).map((rec) => (
                      <span
                        key={rec.id}
                        className="inline-flex items-center gap-1 rounded-full border border-white/45 bg-white/22 px-3 py-1.5 text-[0.66rem] font-semibold text-[var(--cs-ink-3)]"
                      >
                        {rec.text}
                        {rec.href ? (
                          <Link href={rec.href} className="ml-1 font-bold text-[#4f63d5]">
                            →
                          </Link>
                        ) : null}
                      </span>
                    ))}
                  </div>
                ) : null}
              </LiquidGlass>
            ) : (
              /* Empty state contexte système */
              <LiquidGlass variant="clear" intensity="soft" className="rounded-[1.55rem] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <Waypoints className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cs-ink-4)]" />
                    <div>
                      <p className="text-sm font-semibold text-[var(--cs-ink-2)]">
                        Contexte système CloneStore
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[var(--cs-ink-4)]">
                        Aucun contexte système disponible pour l'instant.
                        Configurez l'Empreinte Entreprise et lancez une demande CloneOS pour
                        enrichir ce feed. localStorage reste le fallback actif.
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link
                      href="/profile/onboarding"
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#667cff]/22 bg-[#667cff]/08 px-3 py-1.5 text-xs font-semibold text-[#4f63d5] transition hover:bg-[#667cff]/14"
                    >
                      Onboarding
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <Link
                      href="/profile/agents"
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/50 bg-white/30 px-3 py-1.5 text-xs font-semibold text-[var(--cs-ink-3)] transition hover:bg-white/44"
                    >
                      Mon espace
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </LiquidGlass>
            )
          ) : null}

          {/* ── PHASE 4.2 — Command Center Preview (simulation runtime read-only) ──
              Simulation uniquement, au clic. Aucune mission créée. Aucun message
              envoyé. Aucun appel IA. CloneVoice non actif. Scale 80k non prouvé. */}
          <LiquidGlass variant="panel" intensity="medium" className="rounded-[1.75rem] p-4 md:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="cs-eyebrow">Command Center Preview</p>
                <h2 className="mt-2 text-[1.1rem] font-semibold tracking-[-0.03em] text-[var(--cs-ink-1)]">
                  Prévisualisation Runtime CloneOS
                </h2>
                <p className="mt-1.5 text-xs leading-5 text-[var(--cs-ink-4)]">
                  Saisis une commande pour prévisualiser le plan runtime CloneOS → Pierre.
                  Simulation uniquement — aucune mission créée, aucun appel IA.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Simulation uniquement",
                  "Lecture seule",
                  "Aucune mission créée",
                  "Aucun message envoyé",
                  "Aucun appel IA",
                  "CloneVoice non actif",
                  "Scale 80k non prouvé",
                ].map((b) => (
                  <span key={b} className="inline-flex items-center rounded-full border border-white/50 bg-white/26 px-2.5 py-1 text-[0.6rem] font-semibold text-[var(--cs-ink-4)]">
                    {b}
                  </span>
                ))}
              </div>
            </div>

            {/* Saisie + exemples */}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                value={runtimePreviewInput}
                onChange={(e) => setRuntimePreviewInput(e.target.value)}
                placeholder="Ex : Préparer l'onboarding d'un salarié…"
                className="min-h-11 flex-1 rounded-full border border-white/55 bg-white/34 px-4 text-sm font-medium text-[var(--cs-ink-1)] outline-none placeholder:text-[var(--cs-ink-4)]"
              />
              <button
                type="button"
                onClick={() => void runRuntimeSimulation(runtimePreviewInput)}
                disabled={runtimePreviewLoading}
                className="clone-liquid-button clone-liquid-button--dark min-h-11 shrink-0 px-5 text-sm font-semibold disabled:opacity-55"
              >
                {runtimePreviewLoading ? "Simulation…" : "Simuler"}
              </button>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                { label: "Préparer l'onboarding d'un salarié", blocked: false },
                { label: "Gérer une absence salarié", blocked: false },
                { label: "Préparer une synthèse pré-paie", blocked: false },
                { label: "Exécuter le licenciement d'un salarié", blocked: true },
              ].map((ex) => (
                <button
                  key={ex.label}
                  type="button"
                  onClick={() => {
                    setRuntimePreviewInput(ex.label);
                    void runRuntimeSimulation(ex.label);
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.66rem] font-semibold transition",
                    ex.blocked
                      ? "border-[#b84a4a]/22 bg-[#b84a4a]/06 text-[#b84a4a] hover:bg-[#b84a4a]/12"
                      : "border-white/50 bg-white/26 text-[var(--cs-ink-3)] hover:bg-white/40"
                  )}
                >
                  {ex.label}
                  {ex.blocked ? <span className="text-[0.58rem] opacity-80">· sera bloqué par CloneGuard</span> : null}
                </button>
              ))}
            </div>

            {runtimePreviewError ? (
              <p className="mt-3 text-xs font-semibold text-[#b84a4a]">{runtimePreviewError}</p>
            ) : null}

            {/* Résultat */}
            {runtimePreviewSnapshot ? (
              <div className="mt-4 grid gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {buildRuntimeIntegrationPreviewBadges(runtimePreviewSnapshot).map((badge) => (
                    <span
                      key={badge.id}
                      className={cn(
                        "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.6rem] font-semibold",
                        badge.tone === "success" ? "border-[rgba(21,130,96,0.2)] bg-[rgba(21,130,96,0.07)] text-[var(--cs-success)]"
                        : badge.tone === "danger" ? "border-[#b84a4a]/22 bg-[#b84a4a]/08 text-[#b84a4a]"
                        : badge.tone === "warning" ? "border-[#c99a4d]/22 bg-[#c99a4d]/08 text-[#8f682d]"
                        : badge.tone === "info" ? "border-[#6f83ff]/20 bg-[#6f83ff]/07 text-[#4f63d5]"
                        : "border-white/50 bg-white/22 text-[var(--cs-ink-4)]"
                      )}
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  {buildRuntimeIntegrationPreviewCards(runtimePreviewSnapshot).map((card) => (
                    <div key={card.id} className="rounded-[1.1rem] border border-white/50 bg-white/20 p-3">
                      <p className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-[var(--cs-ink-4)]">{card.label}</p>
                      <p className="mt-1 text-[0.78rem] font-semibold text-[var(--cs-ink-1)]">{card.value}</p>
                      {card.sub_label ? <p className="mt-0.5 text-[0.6rem] leading-4 text-[var(--cs-ink-4)]">{card.sub_label}</p> : null}
                    </div>
                  ))}
                </div>

                <div className="grid gap-2 lg:grid-cols-2">
                  {buildRuntimeIntegrationPreviewSections(runtimePreviewSnapshot).map((section) => (
                    <div key={section.id} className="rounded-[1.1rem] border border-white/48 bg-white/18 p-3">
                      <p className="text-[0.66rem] font-bold uppercase tracking-[0.1em] text-[var(--cs-ink-3)]">{section.title}</p>
                      <div className="mt-1.5 grid gap-1">
                        {section.lines.map((line, i) => (
                          <p key={i} className="text-[0.66rem] leading-5 text-[var(--cs-ink-4)]">{line}</p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-[1.25rem] border border-white/45 bg-white/16 p-4 text-center">
                <p className="text-xs font-semibold text-[var(--cs-ink-3)]">
                  Saisis une commande pour prévisualiser le plan runtime.
                </p>
                <p className="mt-1 text-[0.6rem] text-[var(--cs-ink-4)]">
                  Simulation uniquement · Aucune mission créée · CloneVoice non actif · Scale 80k non prouvé.
                </p>
              </div>
            )}

            {/* ── PHASE 4.3 — Brouillon de mission (local/in-memory) ────────────
                Aucune mission créée en base. Aucun appel Pierre. No-execution. */}
            <div className="mt-4 border-t border-white/40 pt-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[0.7rem] font-semibold text-[var(--cs-ink-2)]">Brouillon de mission</p>
                  <p className="text-[0.6rem] text-[var(--cs-ink-4)]">
                    Brouillon local · Aucune mission créée en base · Aucun appel Pierre · No-execution.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handlePrepareRuntimeMissionDraft}
                  disabled={!runtimePreviewSnapshot}
                  className="clone-liquid-button min-h-10 shrink-0 px-4 text-xs font-semibold disabled:opacity-50"
                >
                  Préparer un brouillon local
                </button>
              </div>

              {runtimeMissionDraftError ? (
                <p className="mt-2 text-xs font-semibold text-[#b84a4a]">{runtimeMissionDraftError}</p>
              ) : null}

              {runtimeMissionDraftPreview ? (
                <div className="mt-3 grid gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[0.72rem] font-semibold text-[var(--cs-ink-1)]">
                      {runtimeMissionDraftPreview.draft.title}
                    </span>
                    <span className="text-[0.6rem] text-[var(--cs-ink-4)]">· {runtimeMissionDraftPreview.draft.status}</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {runtimeMissionDraftPreview.badges.map((badge) => (
                      <span
                        key={badge.id}
                        className={cn(
                          "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.6rem] font-semibold",
                          badge.tone === "success" ? "border-[rgba(21,130,96,0.2)] bg-[rgba(21,130,96,0.07)] text-[var(--cs-success)]"
                          : badge.tone === "danger" ? "border-[#b84a4a]/22 bg-[#b84a4a]/08 text-[#b84a4a]"
                          : badge.tone === "warning" ? "border-[#c99a4d]/22 bg-[#c99a4d]/08 text-[#8f682d]"
                          : badge.tone === "violet" ? "border-[#7a6cff]/20 bg-[#7a6cff]/07 text-[#5c4ad3]"
                          : badge.tone === "info" ? "border-[#6f83ff]/20 bg-[#6f83ff]/07 text-[#4f63d5]"
                          : "border-white/50 bg-white/22 text-[var(--cs-ink-4)]"
                        )}
                      >
                        {badge.label}
                      </span>
                    ))}
                  </div>

                  <p className="text-[0.66rem] leading-5 text-[var(--cs-ink-4)]">
                    {runtimeMissionDraftPreview.draft.objective}
                  </p>

                  <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                    {runtimeMissionDraftPreview.cards.slice(0, 4).map((card) => (
                      <div key={card.id} className="rounded-[1.1rem] border border-white/50 bg-white/20 p-3">
                        <p className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-[var(--cs-ink-4)]">{card.label}</p>
                        <p className="mt-1 text-[0.74rem] font-semibold text-[var(--cs-ink-1)]">{card.value}</p>
                        {card.sub_label ? <p className="mt-0.5 line-clamp-1 text-[0.58rem] text-[var(--cs-ink-4)]">{card.sub_label}</p> : null}
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-2 lg:grid-cols-2">
                    {runtimeMissionDraftPreview.sections.map((section) => (
                      <div key={section.id} className="rounded-[1.1rem] border border-white/48 bg-white/18 p-3">
                        <p className="text-[0.64rem] font-bold uppercase tracking-[0.1em] text-[var(--cs-ink-3)]">{section.title}</p>
                        <div className="mt-1.5 grid gap-1">
                          {section.lines.map((line, i) => (
                            <p key={i} className="text-[0.62rem] leading-5 text-[var(--cs-ink-4)]">{line}</p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-[0.62rem] text-[var(--cs-ink-4)]">
                  Lance une simulation puis prépare un brouillon local.
                </p>
              )}

              {/* ── PHASE 4.5 — Safe Apply (sauvegarde localStorage-first) ──────
                  La sauvegarde concerne uniquement le brouillon, pas une mission
                  réelle. Aucune exécution. Le serveur reste optionnel et feature-flaggé. */}
              <div className="mt-4 border-t border-white/40 pt-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[0.6rem] text-[var(--cs-ink-4)]">
                    localStorage-first · La sauvegarde concerne uniquement le brouillon, pas une mission réelle.
                    Aucune exécution n&apos;est déclenchée. Le serveur reste optionnel et feature-flaggé.
                  </p>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSaveRuntimeMissionDraft()}
                      disabled={!runtimeMissionDraftPreview || runtimeMissionDraftPersistLoading}
                      className="clone-liquid-button clone-liquid-button--dark min-h-9 px-4 text-[0.7rem] font-semibold disabled:opacity-50"
                    >
                      {runtimeMissionDraftPersistLoading ? "Sauvegarde…" : "Sauvegarder le brouillon localement"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRestoreRuntimeMissionDraft()}
                      className="clone-liquid-button min-h-9 px-4 text-[0.7rem] font-semibold"
                    >
                      Restaurer le dernier brouillon local
                    </button>
                  </div>
                </div>

                {runtimeMissionDraftPersistError ? (
                  <p className="mt-2 text-[0.66rem] font-semibold text-[#b84a4a]">{runtimeMissionDraftPersistError}</p>
                ) : null}

                {restoredRuntimeMissionDraftTitle ? (
                  <p className="mt-2 text-[0.64rem] text-[var(--cs-ink-4)]">
                    Dernier brouillon local restauré : <span className="font-semibold text-[var(--cs-ink-2)]">{restoredRuntimeMissionDraftTitle}</span>
                  </p>
                ) : null}

                {runtimeMissionDraftPersistUi ? (
                  <div className="mt-3 grid gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {buildRuntimeMissionDraftSafeApplyUiBadges(runtimeMissionDraftPersistUi).map((badge) => (
                        <span
                          key={badge.id}
                          className={cn(
                            "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.6rem] font-semibold",
                            badge.tone === "success" ? "border-[rgba(21,130,96,0.2)] bg-[rgba(21,130,96,0.07)] text-[var(--cs-success)]"
                            : badge.tone === "danger" ? "border-[#b84a4a]/22 bg-[#b84a4a]/08 text-[#b84a4a]"
                            : badge.tone === "warning" ? "border-[#c99a4d]/22 bg-[#c99a4d]/08 text-[#8f682d]"
                            : badge.tone === "violet" ? "border-[#7a6cff]/20 bg-[#7a6cff]/07 text-[#5c4ad3]"
                            : badge.tone === "info" ? "border-[#6f83ff]/20 bg-[#6f83ff]/07 text-[#4f63d5]"
                            : "border-white/50 bg-white/22 text-[var(--cs-ink-4)]"
                          )}
                        >
                          {badge.label}
                        </span>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
                      {buildRuntimeMissionDraftSafeApplyUiCards(runtimeMissionDraftPersistUi).map((card) => (
                        <div key={card.id} className="rounded-[1rem] border border-white/48 bg-white/18 p-2.5">
                          <p className="text-[0.56rem] font-bold uppercase tracking-[0.1em] text-[var(--cs-ink-4)]">{card.label}</p>
                          <p className="mt-1 text-[0.68rem] font-semibold text-[var(--cs-ink-1)]">{card.value}</p>
                          {card.sub_label ? <p className="mt-0.5 line-clamp-1 text-[0.54rem] text-[var(--cs-ink-4)]">{card.sub_label}</p> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* ── PHASE 4.7 — Statut brouillon runtime (read-only, statut local/serveur) ──
                    Polish UI/observability uniquement. Aucune nouvelle persistance, aucun
                    write, aucun appel réseau, aucune exécution. Serveur feature-flaggé. */}
                <div className="mt-4 border-t border-white/40 pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[0.7rem] font-semibold text-[var(--cs-ink-2)]">Statut brouillon runtime</p>
                    <span className="rounded-full border border-white/50 bg-white/25 px-2.5 py-1 text-[0.56rem] font-semibold text-[var(--cs-ink-3)]">
                      {runtimeMissionDraftRestoreUi.source_label}
                    </span>
                  </div>

                  <p className="mt-1 text-[0.6rem] leading-5 text-[var(--cs-ink-4)]">
                    Le panneau résume la source effective, le statut local et le statut serveur, la dernière
                    sauvegarde locale et la dernière tentative serveur. Le fallback local protège le brouillon,
                    et l&apos;activation P4.6 reste requise quand le flag serveur est false.
                  </p>
                  <p className="mt-1 text-[0.6rem] leading-5 text-[var(--cs-ink-4)]">
                    La restauration ne crée pas de mission réelle. La sauvegarde serveur reste feature-flaggée et
                    manuelle. Aucune exécution n&apos;est déclenchée. Aucun appel Pierre / IA.
                  </p>

                  <div className="mt-2 rounded-[1.1rem] border border-white/48 bg-white/18 p-3">
                    <p className="text-[0.72rem] font-semibold text-[var(--cs-ink-1)]">
                      {runtimeMissionDraftRestoreUi.status_title}
                    </p>
                    <p className="mt-0.5 text-[0.62rem] leading-5 text-[var(--cs-ink-4)]">
                      {runtimeMissionDraftRestoreUi.status_body}
                    </p>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {buildRuntimeMissionDraftRestoreUiBadges(runtimeMissionDraftRestoreUi).map((badge) => (
                      <span
                        key={badge.id}
                        className={cn(
                          "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.6rem] font-semibold",
                          badge.tone === "success" ? "border-[rgba(21,130,96,0.2)] bg-[rgba(21,130,96,0.07)] text-[var(--cs-success)]"
                          : badge.tone === "danger" ? "border-[#b84a4a]/22 bg-[#b84a4a]/08 text-[#b84a4a]"
                          : badge.tone === "warning" ? "border-[#c99a4d]/22 bg-[#c99a4d]/08 text-[#8f682d]"
                          : badge.tone === "violet" ? "border-[#7a6cff]/20 bg-[#7a6cff]/07 text-[#5c4ad3]"
                          : badge.tone === "info" ? "border-[#6f83ff]/20 bg-[#6f83ff]/07 text-[#4f63d5]"
                          : "border-white/50 bg-white/22 text-[var(--cs-ink-4)]"
                        )}
                      >
                        {badge.label}
                      </span>
                    ))}
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
                    {buildRuntimeMissionDraftRestoreUiCards(runtimeMissionDraftRestoreUi).map((card) => (
                      <div key={card.id} className="rounded-[1rem] border border-white/48 bg-white/18 p-2.5">
                        <p className="text-[0.56rem] font-bold uppercase tracking-[0.1em] text-[var(--cs-ink-4)]">{card.label}</p>
                        <p className="mt-1 text-[0.68rem] font-semibold text-[var(--cs-ink-1)]">{card.value}</p>
                        {card.sub_label ? <p className="mt-0.5 line-clamp-1 text-[0.54rem] text-[var(--cs-ink-4)]">{card.sub_label}</p> : null}
                      </div>
                    ))}
                  </div>

                  {buildRuntimeMissionDraftRestoreUiWarnings(runtimeMissionDraftRestoreUi).length > 0 ? (
                    <div className="mt-2 grid gap-1">
                      {buildRuntimeMissionDraftRestoreUiWarnings(runtimeMissionDraftRestoreUi).map((warning) => (
                        <p
                          key={warning.id}
                          className={cn(
                            "text-[0.58rem] leading-4",
                            warning.tone === "warning" ? "text-[#8f682d]" : "text-[var(--cs-ink-4)]"
                          )}
                        >
                          • <span className="font-semibold">{warning.label}</span> — {warning.detail}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* ── PHASE 4.9 — Aperçu : promotion en mission contrôlée (read-only) ──
                  Aperçu du contrat de promotion P4.8. La promotion n'est PAS appliquée,
                  aucune mission réelle créée, aucune exécution, aucun appel Pierre / IA. */}
              <div className="mt-4 border-t border-white/40 pt-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[0.7rem] font-semibold text-[var(--cs-ink-2)]">Promotion en mission contrôlée (aperçu)</p>
                    <p className="text-[0.6rem] leading-5 text-[var(--cs-ink-4)]">
                      Aperçu du contrat de promotion. La promotion n&apos;est pas appliquée — Aucune mission réelle créée.
                      Validation humaine requise. Aucune exécution n&apos;est déclenchée. Aucun appel Pierre / IA.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handlePreviewControlledMissionPromotion}
                    disabled={!runtimeMissionDraftPreview}
                    className="clone-liquid-button min-h-9 shrink-0 px-4 text-[0.7rem] font-semibold disabled:opacity-50"
                  >
                    Prévisualiser la promotion
                  </button>
                </div>

                {runtimeMissionPromotionError ? (
                  <p className="mt-2 text-[0.66rem] font-semibold text-[#b84a4a]">{runtimeMissionPromotionError}</p>
                ) : null}

                {runtimeMissionPromotionUi ? (
                  <div className="mt-3 grid gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[0.72rem] font-semibold text-[var(--cs-ink-1)]">
                        {runtimeMissionPromotionUi.status_label}
                      </span>
                      <span className="text-[0.6rem] text-[var(--cs-ink-4)]">· verdict : {runtimeMissionPromotionUi.verdict}</span>
                    </div>

                    <p className="text-[0.62rem] leading-5 text-[var(--cs-ink-4)]">
                      {runtimeMissionPromotionUi.contract.decision.message}
                    </p>

                    <div className="flex flex-wrap gap-1.5">
                      {buildRuntimeMissionPromotionBadges(runtimeMissionPromotionUi).map((badge) => (
                        <span
                          key={badge.id}
                          className={cn(
                            "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.6rem] font-semibold",
                            badge.tone === "success" ? "border-[rgba(21,130,96,0.2)] bg-[rgba(21,130,96,0.07)] text-[var(--cs-success)]"
                            : badge.tone === "danger" ? "border-[#b84a4a]/22 bg-[#b84a4a]/08 text-[#b84a4a]"
                            : badge.tone === "warning" ? "border-[#c99a4d]/22 bg-[#c99a4d]/08 text-[#8f682d]"
                            : badge.tone === "violet" ? "border-[#7a6cff]/20 bg-[#7a6cff]/07 text-[#5c4ad3]"
                            : badge.tone === "info" ? "border-[#6f83ff]/20 bg-[#6f83ff]/07 text-[#4f63d5]"
                            : "border-white/50 bg-white/22 text-[var(--cs-ink-4)]"
                          )}
                        >
                          {badge.label}
                        </span>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                      {buildRuntimeMissionPromotionCards(runtimeMissionPromotionUi).map((card) => (
                        <div key={card.id} className="rounded-[1rem] border border-white/48 bg-white/18 p-2.5">
                          <p className="text-[0.56rem] font-bold uppercase tracking-[0.1em] text-[var(--cs-ink-4)]">{card.label}</p>
                          <p className="mt-1 text-[0.68rem] font-semibold text-[var(--cs-ink-1)]">{card.value}</p>
                          {card.sub_label ? <p className="mt-0.5 line-clamp-1 text-[0.54rem] text-[var(--cs-ink-4)]">{card.sub_label}</p> : null}
                        </div>
                      ))}
                    </div>

                    <div className="grid gap-2 lg:grid-cols-2">
                      {buildRuntimeMissionPromotionSections(runtimeMissionPromotionUi).map((section) => (
                        <div key={section.id} className="rounded-[1.1rem] border border-white/48 bg-white/18 p-3">
                          <p className="text-[0.64rem] font-bold uppercase tracking-[0.1em] text-[var(--cs-ink-3)]">{section.title}</p>
                          <div className="mt-1.5 grid gap-1">
                            {section.lines.map((line, i) => (
                              <p key={i} className="text-[0.62rem] leading-5 text-[var(--cs-ink-4)]">{line}</p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* ── PHASE 5.1 — Safe apply : créer une mission contrôlée locale ──
                        localStorage-first · Aucune exécution · Aucun envoi · Non persisté serveur. */}
                    {(() => {
                      const safeApplyCheck = validateControlledMissionSafeApplyInput(runtimeMissionPromotionUi.contract);
                      const safeApplyExistingId = `localcm_${runtimeMissionPromotionUi.contract.promotion_id}`;
                      const safeApplyAlready = localControlledMissions.some((m) => m.id === safeApplyExistingId);
                      return (
                        <div className="border-t border-white/40 pt-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-[0.6rem] leading-5 text-[var(--cs-ink-4)]">
                              {CONTROLLED_MISSION_SAFE_APPLY_MICROCOPY}. Cette mission est préparée, pas exécutée.
                            </p>
                            <button
                              type="button"
                              onClick={handleCreateLocalControlledMission}
                              disabled={!safeApplyCheck.can_safe_apply || safeApplyAlready}
                              className="clone-liquid-button clone-liquid-button--dark min-h-9 shrink-0 px-4 text-[0.7rem] font-semibold disabled:opacity-50"
                            >
                              {safeApplyAlready ? CONTROLLED_MISSION_SAFE_APPLY_ALREADY_CREATED : CONTROLLED_MISSION_SAFE_APPLY_BUTTON_LABEL}
                            </button>
                          </div>
                          {!safeApplyCheck.can_safe_apply && safeApplyCheck.reason ? (
                            <p className="mt-2 text-[0.62rem] font-semibold text-[#8f682d]">{safeApplyCheck.reason}</p>
                          ) : null}
                          {controlledMissionSafeApplyResult?.status === "created" ? (
                            <p className="mt-2 text-[0.64rem] font-semibold text-[var(--cs-success)]">
                              {CONTROLLED_MISSION_SAFE_APPLY_SUCCESS}{" "}
                              <a href="#missions-controlees-locales" className="underline">Voir les missions contrôlées locales</a>
                            </p>
                          ) : null}
                          {controlledMissionSafeApplyResult?.status === "already_exists" ? (
                            <p className="mt-2 text-[0.62rem] text-[var(--cs-ink-4)]">Déjà créée localement.</p>
                          ) : null}
                          {controlledMissionSafeApplyResult?.status === "local_save_failed" ? (
                            <p className="mt-2 text-[0.62rem] font-semibold text-[#b84a4a]">Échec de la sauvegarde locale. Aucune exécution n&apos;a eu lieu.</p>
                          ) : null}
                        </div>
                      );
                    })()}
                  </div>
                ) : null}
              </div>

              {/* ── PHASE 5.1 — Missions contrôlées locales (localStorage-first, read-only) ──
                  Mission préparée, pas exécutée. Aucune persistance serveur. Aucun appel Pierre / IA. */}
              <div id="missions-controlees-locales" className="mt-4 border-t border-white/40 pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[0.7rem] font-semibold text-[var(--cs-ink-2)]">
                    Missions contrôlées locales ({localControlledMissions.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {buildLocalControlledMissionSectionBadges().map((badge) => (
                      <span
                        key={badge.id}
                        className="inline-flex items-center rounded-full border border-[#6f83ff]/20 bg-[#6f83ff]/07 px-2.5 py-1 text-[0.58rem] font-semibold text-[#4f63d5]"
                      >
                        {badge.label}
                      </span>
                    ))}
                  </div>
                </div>

                <p className="mt-1 text-[0.6rem] leading-5 text-[var(--cs-ink-4)]">
                  Cette mission est préparée, pas exécutée. Pierre ne travaille pas encore en autonomie sur cette mission.
                  Aucune donnée n&apos;est envoyée au serveur dans cette phase. La persistance serveur et l&apos;exécution
                  gouvernée seront traitées dans une phase ultérieure.
                </p>

                <p className="mt-1 rounded-[1rem] border border-[#6f83ff]/18 bg-[#6f83ff]/06 px-3 py-2 text-[0.58rem] leading-4 text-[#4f63d5]">
                  {CONTROLLED_MISSION_REVIEW_PANEL_GUARDRAIL}
                </p>

                {controlledMissionReviewResult && !controlledMissionReviewResult.ok && controlledMissionReviewResult.reason ? (
                  <p className="mt-1 text-[0.58rem] font-semibold text-[#8f682d]">{controlledMissionReviewResult.reason}</p>
                ) : null}

                <p className="mt-1 rounded-[1rem] border border-[#7a6cff]/18 bg-[#7a6cff]/06 px-3 py-2 text-[0.58rem] leading-4 text-[#5c4ad3]">
                  {CONTROLLED_MISSION_PREFLIGHT_PANEL_GUARDRAIL}
                </p>

                {controlledMissionPreflightResult && controlledMissionPreflightResult.ok ? (
                  <p className="mt-1 text-[0.58rem] font-semibold text-[var(--cs-success)]">{CONTROLLED_MISSION_PREFLIGHT_READY_MESSAGE}</p>
                ) : controlledMissionPreflightResult && controlledMissionPreflightResult.reason ? (
                  <p className="mt-1 text-[0.58rem] font-semibold text-[#8f682d]">{controlledMissionPreflightResult.reason}</p>
                ) : null}

                {/* ── PHASE 5.5 — Activation serveur : QA manuelle uniquement (lecture seule) ──
                    Aucune activation. SQL non appliqué. Flag off. Aucune route. Aucune exécution. */}
                {(() => {
                  const serverManualQa = buildControlledMissionServerPersistenceManualActivationQa();
                  const serverManualRunbook = buildControlledMissionServerPersistenceManualActivationRunbook();
                  return (
                    <div className="mt-2 rounded-[1.25rem] border border-[#3f8f74]/18 bg-[#3f8f74]/05 p-3">
                      <p className="text-[0.62rem] font-semibold text-[#2c6f58]">Activation serveur — QA manuelle uniquement</p>
                      <p className="mt-1 text-[0.56rem] leading-4 text-[var(--cs-ink-4)]">
                        {CONTROLLED_MISSION_SERVER_MANUAL_QA_MICROCOPY}. {CONTROLLED_MISSION_SERVER_MANUAL_QA_WHAT_IT_DOES} {CONTROLLED_MISSION_SERVER_MANUAL_QA_DO_NOT_APPLY} {CONTROLLED_MISSION_SERVER_MANUAL_QA_NO_DATA}
                      </p>
                      <p className="mt-1 rounded-[1rem] border border-[#3f8f74]/18 bg-white/22 px-3 py-2 text-[0.56rem] leading-4 text-[#2c6f58]">
                        {CONTROLLED_MISSION_SERVER_MANUAL_QA_PANEL_GUARDRAIL}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {buildControlledMissionServerManualQaBadges().map((badge) => (
                          <span
                            key={badge.id}
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.54rem] font-semibold",
                              badge.tone === "success" ? "border-[rgba(21,130,96,0.2)] bg-[rgba(21,130,96,0.07)] text-[var(--cs-success)]"
                              : badge.tone === "danger" ? "border-[#b84a4a]/22 bg-[#b84a4a]/08 text-[#b84a4a]"
                              : badge.tone === "warning" ? "border-[#c99a4d]/22 bg-[#c99a4d]/08 text-[#8f682d]"
                              : badge.tone === "info" ? "border-[#6f83ff]/20 bg-[#6f83ff]/07 text-[#4f63d5]"
                              : "border-white/50 bg-white/22 text-[var(--cs-ink-4)]"
                            )}
                          >
                            {badge.label}
                          </span>
                        ))}
                      </div>
                      <div className="mt-1 grid gap-0.5">
                        {CONTROLLED_MISSION_SERVER_MANUAL_QA_FACTS.map((fact, i) => (
                          <p key={i} className="text-[0.56rem] leading-4 text-[var(--cs-ink-4)]">• {fact}</p>
                        ))}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <button type="button" onClick={() => setShowServerQaChecklist((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">
                          {CONTROLLED_MISSION_SERVER_MANUAL_QA_VIEW_CHECKLIST_LABEL}
                        </button>
                        <button type="button" onClick={() => setShowServerQaRunbook((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">
                          {CONTROLLED_MISSION_SERVER_MANUAL_QA_VIEW_RUNBOOK_LABEL}
                        </button>
                      </div>
                      {showServerQaChecklist ? (
                        <div className="mt-1.5 grid gap-0.5">
                          <span className="text-[0.56rem] font-semibold text-[var(--cs-ink-2)]">Checklist QA ({serverManualQa.steps.length} étapes) — {serverManualQa.current_status}</span>
                          {serverManualQa.steps.map((qaStep) => (
                            <p key={qaStep.id} className="text-[0.54rem] leading-4 text-[var(--cs-ink-4)]">
                              ○ [{getControlledMissionServerManualQaCategoryLabel(qaStep.category)}] {qaStep.label}
                            </p>
                          ))}
                        </div>
                      ) : null}
                      {showServerQaRunbook ? (
                        <div className="mt-1.5 grid gap-1">
                          <span className="text-[0.56rem] font-semibold text-[var(--cs-ink-2)]">{serverManualRunbook.title}</span>
                          {serverManualRunbook.sections.map((sec, i) => (
                            <div key={i} className="grid gap-0.5">
                              <span className="text-[0.54rem] font-semibold text-[var(--cs-ink-3)]">{sec.heading}</span>
                              {sec.items.map((item, j) => (
                                <p key={j} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {item}</p>
                              ))}
                            </div>
                          ))}
                          <div className="mt-0.5 grid gap-0.5">
                            {serverManualRunbook.do_not_apply_reminders.map((r, i) => (
                              <p key={i} className="text-[0.52rem] leading-4 text-[#8f682d]">! {r}</p>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })()}

                {/* ── PHASE 5.6 — Restauration serveur : non active (UI design-only, lecture seule) ──
                    Aucun GET serveur. localStorage source active. SQL non appliqué. Aucune exécution. */}
                {(() => {
                  const restoreState = buildControlledMissionServerRestoreDesignState(localControlledMissions);
                  return (
                    <div className="mt-2 rounded-[1.25rem] border border-[#6f83ff]/16 bg-[#6f83ff]/05 p-3">
                      <p className="text-[0.62rem] font-semibold text-[#4f63d5]">Restauration serveur — non active</p>
                      <p className="mt-1 text-[0.56rem] leading-4 text-[var(--cs-ink-4)]">
                        {CONTROLLED_MISSION_SERVER_RESTORE_MICROCOPY}. {CONTROLLED_MISSION_SERVER_RESTORE_WHAT_IT_DOES} {CONTROLLED_MISSION_SERVER_RESTORE_NO_GET} {CONTROLLED_MISSION_SERVER_RESTORE_LOCAL_SOURCE}
                      </p>
                      <p className="mt-1 rounded-[1rem] border border-[#6f83ff]/16 bg-white/22 px-3 py-2 text-[0.56rem] leading-4 text-[#4f63d5]">
                        {CONTROLLED_MISSION_SERVER_RESTORE_PANEL_GUARDRAIL}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {buildControlledMissionServerRestoreBadges().map((badge) => (
                          <span
                            key={badge.id}
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.54rem] font-semibold",
                              badge.tone === "success" ? "border-[rgba(21,130,96,0.2)] bg-[rgba(21,130,96,0.07)] text-[var(--cs-success)]"
                              : badge.tone === "danger" ? "border-[#b84a4a]/22 bg-[#b84a4a]/08 text-[#b84a4a]"
                              : badge.tone === "warning" ? "border-[#c99a4d]/22 bg-[#c99a4d]/08 text-[#8f682d]"
                              : badge.tone === "info" ? "border-[#6f83ff]/20 bg-[#6f83ff]/07 text-[#4f63d5]"
                              : "border-white/50 bg-white/22 text-[var(--cs-ink-4)]"
                            )}
                          >
                            {badge.label}
                          </span>
                        ))}
                      </div>
                      <div className="mt-1 grid gap-0.5">
                        <span className="text-[0.56rem] font-semibold text-[var(--cs-ink-2)]">
                          Missions locales : {restoreState.local_rows_available} · candidates future restauration : {restoreState.eligible_local_rows} · lignes serveur chargées : {restoreState.server_rows_loaded}
                        </span>
                        {CONTROLLED_MISSION_SERVER_RESTORE_FACTS.map((fact, i) => (
                          <p key={i} className="text-[0.56rem] leading-4 text-[var(--cs-ink-4)]">• {fact}</p>
                        ))}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <button type="button" onClick={() => setShowRestoreState((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">
                          {CONTROLLED_MISSION_SERVER_RESTORE_VIEW_STATE_LABEL}
                        </button>
                        <button type="button" onClick={() => setShowRestoreFuture((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">
                          {CONTROLLED_MISSION_SERVER_RESTORE_VIEW_FUTURE_LABEL}
                        </button>
                      </div>
                      {showRestoreState ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {restoreState.display_cards.map((rcard) => (
                            <p key={rcard.id} className="text-[0.54rem] leading-4 text-[var(--cs-ink-4)]">
                              ○ {rcard.title} — {rcard.badge} · {rcard.description}
                            </p>
                          ))}
                        </div>
                      ) : null}
                      {showRestoreFuture ? (
                        <div className="mt-1.5 grid gap-0.5">
                          <span className="text-[0.56rem] font-semibold text-[var(--cs-ink-2)]">Parcours futur (design)</span>
                          {restoreState.restore_timeline_preview.map((item, i) => (
                            <p key={item.id} className="text-[0.54rem] leading-4 text-[var(--cs-ink-4)]">
                              {i + 1}. {item.label} — {item.description}
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })()}

                {/* ── PHASE 5.7 — Final Gate P5 (design-only, lecture seule) ──
                    Fermeture P5.1 → P5.6. Aucune activation, aucune production, aucune exécution. */}
                {(() => {
                  const finalGate = buildControlledMissionServerPersistenceFinalGateReport();
                  return (
                    <div className="mt-2 rounded-[1.25rem] border border-[#7a6cff]/18 bg-[#7a6cff]/05 p-3">
                      <p className="text-[0.62rem] font-semibold text-[#5c4ad3]">Final Gate P5 — Persistance serveur contrôlée</p>
                      <p className="mt-1 text-[0.56rem] leading-4 text-[var(--cs-ink-4)]">
                        {CONTROLLED_MISSION_FINAL_GATE_MICROCOPY}. {CONTROLLED_MISSION_FINAL_GATE_WHAT_IT_DOES} {CONTROLLED_MISSION_FINAL_GATE_SERVER_INACTIVE} {CONTROLLED_MISSION_FINAL_GATE_NO_ROUTE} {CONTROLLED_MISSION_FINAL_GATE_NO_EXECUTION}
                      </p>
                      <p className="mt-1 rounded-[1rem] border border-[#7a6cff]/18 bg-white/22 px-3 py-2 text-[0.56rem] leading-4 text-[#5c4ad3]">
                        {CONTROLLED_MISSION_FINAL_GATE_PANEL_GUARDRAIL}
                      </p>
                      <p className="mt-1 text-[0.6rem] font-semibold text-[var(--cs-ink-2)]">
                        Verdict : {getControlledMissionFinalGateVerdictLabel(finalGate.overall_verdict)} · Readiness {finalGate.readiness_score}% · {getControlledMissionFinalGateLevelLabel(finalGate.readiness_level)}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {buildControlledMissionFinalGateBadges(finalGate.overall_verdict).map((badge) => (
                          <span
                            key={badge.id}
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.54rem] font-semibold",
                              badge.tone === "success" ? "border-[rgba(21,130,96,0.2)] bg-[rgba(21,130,96,0.07)] text-[var(--cs-success)]"
                              : badge.tone === "danger" ? "border-[#b84a4a]/22 bg-[#b84a4a]/08 text-[#b84a4a]"
                              : badge.tone === "warning" ? "border-[#c99a4d]/22 bg-[#c99a4d]/08 text-[#8f682d]"
                              : badge.tone === "info" ? "border-[#6f83ff]/20 bg-[#6f83ff]/07 text-[#4f63d5]"
                              : "border-white/50 bg-white/22 text-[var(--cs-ink-4)]"
                            )}
                          >
                            {badge.label}
                          </span>
                        ))}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <button type="button" onClick={() => setShowFinalGate((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">
                          {CONTROLLED_MISSION_FINAL_GATE_VIEW_REPORT_LABEL}
                        </button>
                        <button type="button" onClick={() => setShowFinalInvariants((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">
                          {CONTROLLED_MISSION_FINAL_GATE_VIEW_INVARIANTS_LABEL}
                        </button>
                        <button type="button" onClick={() => setShowFinalNextSteps((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">
                          {CONTROLLED_MISSION_FINAL_GATE_VIEW_NEXT_STEPS_LABEL}
                        </button>
                      </div>
                      {showFinalGate ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {finalGate.sections.map((sec) => (
                            <p key={sec.id} className="text-[0.54rem] leading-4 text-[var(--cs-ink-4)]">
                              {sec.status === "passed" ? "✓" : sec.status === "warning" ? "!" : sec.status === "failed" ? "✗" : "○"} {sec.title} — {sec.score}% · {sec.summary}
                            </p>
                          ))}
                          <span className="mt-0.5 text-[0.54rem] font-semibold text-[var(--cs-ink-3)]">Command matrix</span>
                          {finalGate.command_matrix.map((c, i) => (
                            <p key={i} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {c.command} → {c.expected}</p>
                          ))}
                        </div>
                      ) : null}
                      {showFinalInvariants ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {finalGate.invariants.map((inv) => (
                            <p key={inv.id} className="text-[0.54rem] leading-4 text-[var(--cs-ink-4)]">• {inv.label} : {inv.expected}</p>
                          ))}
                        </div>
                      ) : null}
                      {showFinalNextSteps ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {finalGate.required_next_steps.map((stepText, i) => (
                            <p key={i} className="text-[0.54rem] leading-4 text-[var(--cs-ink-4)]">• {stepText}</p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })()}

                {/* ── PHASE 5.8 — Plan de transition (design-only, lecture seule) ──
                    localStorage → serveur futur. Aucune activation, aucune route, aucun GET/POST, aucune exécution. */}
                {(() => {
                  const transitionPlan = buildControlledMissionPersistenceTransitionPlan();
                  return (
                    <div className="mt-2 rounded-[1.25rem] border border-[#3f8f74]/16 bg-[#3f8f74]/05 p-3">
                      <p className="text-[0.62rem] font-semibold text-[#2c6f58]">Plan de transition — persistance contrôlée</p>
                      <p className="mt-1 text-[0.56rem] leading-4 text-[var(--cs-ink-4)]">
                        {CONTROLLED_MISSION_TRANSITION_MICROCOPY}. {CONTROLLED_MISSION_TRANSITION_WHAT_IT_DOES} {CONTROLLED_MISSION_TRANSITION_LOCAL_SOURCE} {CONTROLLED_MISSION_TRANSITION_NO_GET_POST} {CONTROLLED_MISSION_TRANSITION_NO_EXECUTION}
                      </p>
                      <p className="mt-1 rounded-[1rem] border border-[#3f8f74]/16 bg-white/22 px-3 py-2 text-[0.56rem] leading-4 text-[#2c6f58]">
                        {CONTROLLED_MISSION_TRANSITION_PANEL_GUARDRAIL}
                      </p>
                      <p className="mt-1 text-[0.6rem] font-semibold text-[var(--cs-ink-2)]">
                        Statut : {getControlledMissionTransitionStatusLabel(transitionPlan.transition_status)} · Readiness {transitionPlan.readiness_score}% · {getControlledMissionTransitionLevelLabel(transitionPlan.readiness_level)} · {transitionPlan.current_source} → {transitionPlan.future_source}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {buildControlledMissionTransitionBadges().map((badge) => (
                          <span
                            key={badge.id}
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.54rem] font-semibold",
                              badge.tone === "success" ? "border-[rgba(21,130,96,0.2)] bg-[rgba(21,130,96,0.07)] text-[var(--cs-success)]"
                              : badge.tone === "danger" ? "border-[#b84a4a]/22 bg-[#b84a4a]/08 text-[#b84a4a]"
                              : badge.tone === "warning" ? "border-[#c99a4d]/22 bg-[#c99a4d]/08 text-[#8f682d]"
                              : badge.tone === "info" ? "border-[#6f83ff]/20 bg-[#6f83ff]/07 text-[#4f63d5]"
                              : "border-white/50 bg-white/22 text-[var(--cs-ink-4)]"
                            )}
                          >
                            {badge.label}
                          </span>
                        ))}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <button type="button" onClick={() => setShowTransitionPlan((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">
                          {CONTROLLED_MISSION_TRANSITION_VIEW_PLAN_LABEL}
                        </button>
                        <button type="button" onClick={() => setShowTransitionRisks((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">
                          {CONTROLLED_MISSION_TRANSITION_VIEW_RISKS_LABEL}
                        </button>
                        <button type="button" onClick={() => setShowTransitionRollback((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">
                          {CONTROLLED_MISSION_TRANSITION_VIEW_ROLLBACK_LABEL}
                        </button>
                        <button type="button" onClick={() => setShowTransitionNextSteps((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">
                          {CONTROLLED_MISSION_TRANSITION_VIEW_NEXT_STEPS_LABEL}
                        </button>
                      </div>
                      {showTransitionPlan ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {transitionPlan.phases.map((tphase) => (
                            <p key={tphase.id} className="text-[0.54rem] leading-4 text-[var(--cs-ink-4)]">
                              ○ {tphase.label} — [{getControlledMissionTransitionPhaseStatusLabel(tphase.status)}] {tphase.objective}
                            </p>
                          ))}
                          <span className="mt-0.5 text-[0.54rem] font-semibold text-[var(--cs-ink-3)]">Politique no-execution</span>
                          {transitionPlan.no_execution_policy.items.map((item, i) => (
                            <p key={i} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {item}</p>
                          ))}
                        </div>
                      ) : null}
                      {showTransitionRisks ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {transitionPlan.risks.map((risk) => (
                            <p key={risk.id} className="text-[0.54rem] leading-4 text-[var(--cs-ink-4)]">• [{risk.severity}] {risk.label} → {risk.mitigation}</p>
                          ))}
                        </div>
                      ) : null}
                      {showTransitionRollback ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {transitionPlan.rollback_plan.steps.map((stepText, i) => (
                            <p key={i} className="text-[0.54rem] leading-4 text-[var(--cs-ink-4)]">• {stepText}</p>
                          ))}
                        </div>
                      ) : null}
                      {showTransitionNextSteps ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {transitionPlan.required_next_steps.map((stepText, i) => (
                            <p key={i} className="text-[0.54rem] leading-4 text-[var(--cs-ink-4)]">• {stepText}</p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })()}

                {/* ── PHASE 5.9 — Handbook opérateur (design-only, lecture seule) ──
                    Documentation P5.1 → P5.8. Aucune activation, aucune route, aucun GET/POST, aucune exécution. */}
                {(() => {
                  const handbook = buildControlledMissionPersistenceOperatorHandbook();
                  return (
                    <div className="mt-2 rounded-[1.25rem] border border-[#6f83ff]/16 bg-[#6f83ff]/05 p-3">
                      <p className="text-[0.62rem] font-semibold text-[#4f63d5]">Handbook opérateur — persistance contrôlée</p>
                      <p className="mt-1 text-[0.56rem] leading-4 text-[var(--cs-ink-4)]">
                        {CONTROLLED_MISSION_HANDBOOK_MICROCOPY}. {CONTROLLED_MISSION_HANDBOOK_WHAT_IT_DOES} {CONTROLLED_MISSION_HANDBOOK_LOCAL_SOURCE} {CONTROLLED_MISSION_HANDBOOK_NO_GET_POST} {CONTROLLED_MISSION_HANDBOOK_NO_EXECUTION}
                      </p>
                      <p className="mt-1 rounded-[1rem] border border-[#6f83ff]/16 bg-white/22 px-3 py-2 text-[0.56rem] leading-4 text-[#4f63d5]">
                        {CONTROLLED_MISSION_HANDBOOK_PANEL_GUARDRAIL}
                      </p>
                      <p className="mt-1 text-[0.6rem] font-semibold text-[var(--cs-ink-2)]">
                        Statut : {getControlledMissionHandbookStatusLabel(handbook.handbook_status)} · Audience : {handbook.audience.join(", ")} · Workflows : {handbook.operator_workflows.length} · Playbooks : {handbook.verification_playbooks.length + handbook.incident_playbooks.length}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {buildControlledMissionHandbookBadges().map((badge) => (
                          <span
                            key={badge.id}
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.54rem] font-semibold",
                              badge.tone === "success" ? "border-[rgba(21,130,96,0.2)] bg-[rgba(21,130,96,0.07)] text-[var(--cs-success)]"
                              : badge.tone === "danger" ? "border-[#b84a4a]/22 bg-[#b84a4a]/08 text-[#b84a4a]"
                              : badge.tone === "warning" ? "border-[#c99a4d]/22 bg-[#c99a4d]/08 text-[#8f682d]"
                              : badge.tone === "info" ? "border-[#6f83ff]/20 bg-[#6f83ff]/07 text-[#4f63d5]"
                              : "border-white/50 bg-white/22 text-[var(--cs-ink-4)]"
                            )}
                          >
                            {badge.label}
                          </span>
                        ))}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <button type="button" onClick={() => setShowHandbook((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">
                          {CONTROLLED_MISSION_HANDBOOK_VIEW_HANDBOOK_LABEL}
                        </button>
                        <button type="button" onClick={() => setShowHandbookWorkflows((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">
                          {CONTROLLED_MISSION_HANDBOOK_VIEW_WORKFLOWS_LABEL}
                        </button>
                        <button type="button" onClick={() => setShowHandbookPlaybooks((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">
                          {CONTROLLED_MISSION_HANDBOOK_VIEW_PLAYBOOKS_LABEL}
                        </button>
                        <button type="button" onClick={() => setShowHandbookCommands((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">
                          {CONTROLLED_MISSION_HANDBOOK_VIEW_COMMANDS_LABEL}
                        </button>
                        <button type="button" onClick={() => setShowHandbookDecisions((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">
                          {CONTROLLED_MISSION_HANDBOOK_VIEW_DECISIONS_LABEL}
                        </button>
                      </div>
                      {showHandbook ? (
                        <div className="mt-1.5 grid gap-0.5">
                          <span className="text-[0.54rem] font-semibold text-[var(--cs-ink-3)]">État actuel</span>
                          {handbook.current_state_summary.map((line, i) => (
                            <p key={i} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {line}</p>
                          ))}
                          <span className="mt-0.5 text-[0.54rem] font-semibold text-[var(--cs-ink-3)]">Inactif</span>
                          {handbook.inactive_capabilities.map((line, i) => (
                            <p key={i} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {line}</p>
                          ))}
                        </div>
                      ) : null}
                      {showHandbookWorkflows ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {handbook.operator_workflows.map((wf) => (
                            <p key={wf.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {wf.title} — {wf.expected_result}</p>
                          ))}
                        </div>
                      ) : null}
                      {showHandbookPlaybooks ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {[...handbook.verification_playbooks, ...handbook.incident_playbooks].map((pb) => (
                            <p key={pb.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {pb.title}</p>
                          ))}
                        </div>
                      ) : null}
                      {showHandbookCommands ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {handbook.command_reference.map((c, i) => (
                            <p key={i} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {c.command} → {c.expected}</p>
                          ))}
                        </div>
                      ) : null}
                      {showHandbookDecisions ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {handbook.decision_matrix.map((d, i) => (
                            <p key={i} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {d.situation} → autorisé : {d.allowed_decision} · interdit : {d.forbidden_decision}</p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })()}

                {/* ── PHASE 5.10 — Clôture Phase 5 (design-only, lecture seule) ──
                    Ferme P5.1 → P5.9. Aucune activation, aucune route, aucun GET/POST, aucune exécution. */}
                {(() => {
                  const closure = buildControlledMissionPersistencePhase5ClosureReport();
                  return (
                    <div className="mt-2 rounded-[1.25rem] border border-[#c99a4d]/18 bg-[#c99a4d]/05 p-3">
                      <p className="text-[0.62rem] font-semibold text-[#8f682d]">Clôture Phase 5 — Controlled Mission Persistence</p>
                      <p className="mt-1 text-[0.56rem] leading-4 text-[var(--cs-ink-4)]">
                        {CONTROLLED_MISSION_CLOSURE_MICROCOPY}. {CONTROLLED_MISSION_CLOSURE_WHAT_IT_DOES} {CONTROLLED_MISSION_CLOSURE_LOCAL_SOURCE} {CONTROLLED_MISSION_CLOSURE_NO_GET_POST} {CONTROLLED_MISSION_CLOSURE_NO_EXECUTION} {CONTROLLED_MISSION_CLOSURE_NEXT_P6}
                      </p>
                      <p className="mt-1 rounded-[1rem] border border-[#c99a4d]/18 bg-white/22 px-3 py-2 text-[0.56rem] leading-4 text-[#8f682d]">
                        {CONTROLLED_MISSION_CLOSURE_PANEL_GUARDRAIL}
                      </p>
                      <p className="mt-1 text-[0.6rem] font-semibold text-[var(--cs-ink-2)]">
                        Statut : {getControlledMissionClosureStatusLabel(closure.closure_status)} · Phase 5 fermée : {closure.phase5_closed ? "oui" : "non"} · Prête pour P6 : {closure.ready_for_p6 ? "oui" : "non"} · Blocs fermés : {closure.closed_blocks.length} · Risques : {closure.risk_matrix.length}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {buildControlledMissionClosureBadges().map((badge) => (
                          <span
                            key={badge.id}
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.54rem] font-semibold",
                              badge.tone === "success" ? "border-[rgba(21,130,96,0.2)] bg-[rgba(21,130,96,0.07)] text-[var(--cs-success)]"
                              : badge.tone === "danger" ? "border-[#b84a4a]/22 bg-[#b84a4a]/08 text-[#b84a4a]"
                              : badge.tone === "warning" ? "border-[#c99a4d]/22 bg-[#c99a4d]/08 text-[#8f682d]"
                              : badge.tone === "info" ? "border-[#6f83ff]/20 bg-[#6f83ff]/07 text-[#4f63d5]"
                              : "border-white/50 bg-white/22 text-[var(--cs-ink-4)]"
                            )}
                          >
                            {badge.label}
                          </span>
                        ))}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <button type="button" onClick={() => setShowClosure((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">
                          {CONTROLLED_MISSION_CLOSURE_VIEW_CLOSURE_LABEL}
                        </button>
                        <button type="button" onClick={() => setShowClosureBlocks((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">
                          {CONTROLLED_MISSION_CLOSURE_VIEW_BLOCKS_LABEL}
                        </button>
                        <button type="button" onClick={() => setShowClosureRisks((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">
                          {CONTROLLED_MISSION_CLOSURE_VIEW_RISKS_LABEL}
                        </button>
                        <button type="button" onClick={() => setShowClosureP6((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">
                          {CONTROLLED_MISSION_CLOSURE_VIEW_P6_LABEL}
                        </button>
                        <button type="button" onClick={() => setShowClosureVerdict((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">
                          {CONTROLLED_MISSION_CLOSURE_VIEW_VERDICT_LABEL}
                        </button>
                      </div>
                      {showClosure ? (
                        <div className="mt-1.5 grid gap-0.5">
                          <span className="text-[0.54rem] font-semibold text-[var(--cs-ink-3)]">Capacités actives</span>
                          {closure.active_capabilities.map((c, i) => (
                            <p key={i} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {c}</p>
                          ))}
                          <span className="mt-0.5 text-[0.54rem] font-semibold text-[var(--cs-ink-3)]">Capacités inactives</span>
                          {closure.inactive_capabilities.map((c, i) => (
                            <p key={i} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {c}</p>
                          ))}
                        </div>
                      ) : null}
                      {showClosureBlocks ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {closure.closed_blocks.map((blk) => (
                            <p key={blk.phase} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">✓ {blk.title} — {blk.evidence}</p>
                          ))}
                        </div>
                      ) : null}
                      {showClosureRisks ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {closure.risk_matrix.map((risk) => (
                            <p key={risk.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• [{risk.severity}] {risk.label} → {risk.mitigation}</p>
                          ))}
                        </div>
                      ) : null}
                      {showClosureP6 ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {closure.p6_readiness_map.map((p6) => (
                            <p key={p6.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {p6.title} [{p6.status}] — {p6.objective}</p>
                          ))}
                        </div>
                      ) : null}
                      {showClosureVerdict ? (
                        <div className="mt-1.5 grid gap-0.5">
                          <p className="text-[0.54rem] font-semibold text-[var(--cs-ink-2)]">{closure.final_verdict}</p>
                          {closure.launch_impact.map((line, i) => (
                            <p key={i} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {line}</p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })()}

                {/* ── PHASE 6.1 — Pierre Sellable Master Audit (audit-only, lecture seule) ──
                    Ne déclare pas Pierre vendable. Aucune activation, aucune route, aucune exécution. */}
                {(() => {
                  const audit = buildPierreSellableCompletionMasterAuditReport();
                  return (
                    <div className="mt-2 rounded-[1.25rem] border border-[#b84a4a]/16 bg-[#b84a4a]/04 p-3">
                      <p className="text-[0.62rem] font-semibold text-[#a33f3f]">Pierre Sellable Audit — vers 100% vendable</p>
                      <p className="mt-1 text-[0.56rem] leading-4 text-[var(--cs-ink-4)]">
                        {PIERRE_SELLABLE_AUDIT_MICROCOPY}. {PIERRE_SELLABLE_AUDIT_WHAT_IT_DOES} {PIERRE_SELLABLE_AUDIT_NOT_PUBLIC_COMPLETE} {PIERRE_SELLABLE_AUDIT_NEXT_P6_2}
                      </p>
                      <p className="mt-1 rounded-[1rem] border border-[#b84a4a]/16 bg-white/22 px-3 py-2 text-[0.56rem] leading-4 text-[#a33f3f]">
                        {PIERRE_SELLABLE_AUDIT_PANEL_GUARDRAIL}
                      </p>
                      <p className="mt-1 text-[0.6rem] font-semibold text-[var(--cs-ink-2)]">
                        Statut : {getPierreSellableAuditStatusLabel(audit.audit_status)} · Score : {audit.overall_sellable_score}% · Niveau : {getPierreSellableLevelLabel(audit.sellable_level)} · Sections : {audit.sections.length} · Blockers : {audit.blocker_matrix.length}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {buildPierreSellableAuditBadges(audit.sellable_level).map((badge) => (
                          <span
                            key={badge.id}
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.54rem] font-semibold",
                              badge.tone === "success" ? "border-[rgba(21,130,96,0.2)] bg-[rgba(21,130,96,0.07)] text-[var(--cs-success)]"
                              : badge.tone === "danger" ? "border-[#b84a4a]/22 bg-[#b84a4a]/08 text-[#b84a4a]"
                              : badge.tone === "warning" ? "border-[#c99a4d]/22 bg-[#c99a4d]/08 text-[#8f682d]"
                              : badge.tone === "info" ? "border-[#6f83ff]/20 bg-[#6f83ff]/07 text-[#4f63d5]"
                              : "border-white/50 bg-white/22 text-[var(--cs-ink-4)]"
                            )}
                          >
                            {badge.label}
                          </span>
                        ))}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <button type="button" onClick={() => setShowSellableAudit((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">
                          {PIERRE_SELLABLE_AUDIT_VIEW_AUDIT_LABEL}
                        </button>
                        <button type="button" onClick={() => setShowSellableBlockers((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">
                          {PIERRE_SELLABLE_AUDIT_VIEW_BLOCKERS_LABEL}
                        </button>
                        <button type="button" onClick={() => setShowSellableP6((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">
                          {PIERRE_SELLABLE_AUDIT_VIEW_P6_LABEL}
                        </button>
                        <button type="button" onClick={() => setShowSellableCriteria((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">
                          {PIERRE_SELLABLE_AUDIT_VIEW_CRITERIA_LABEL}
                        </button>
                      </div>
                      {showSellableAudit ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {audit.sections.map((sec) => (
                            <p key={sec.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {sec.title} [{getPierreSellableClassificationLabel(sec.status)}] — {sec.summary}</p>
                          ))}
                        </div>
                      ) : null}
                      {showSellableBlockers ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {audit.blocker_matrix.map((bl) => (
                            <p key={bl.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• [{bl.severity} · {bl.required_before}] {bl.label} → {bl.owner_phase}</p>
                          ))}
                        </div>
                      ) : null}
                      {showSellableP6 ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {audit.recommended_p6_sequence.map((p6) => (
                            <p key={p6.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {p6.title}{p6.optional ? " (optionnel)" : ""} — {p6.expected_output}</p>
                          ))}
                        </div>
                      ) : null}
                      {showSellableCriteria ? (
                        <div className="mt-1.5 grid gap-0.5">
                          <span className="text-[0.54rem] font-semibold text-[var(--cs-ink-3)]">Pierre est vendable seulement si</span>
                          {audit.sellable_definition.is_sellable_when.map((line, i) => (
                            <p key={i} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {line}</p>
                          ))}
                          <span className="mt-0.5 text-[0.54rem] font-semibold text-[var(--cs-ink-3)]">Pas public-launch complete tant que</span>
                          {audit.sellable_definition.not_public_launch_complete_until.map((line, i) => (
                            <p key={i} className="text-[0.52rem] leading-4 text-[#8f682d]">! {line}</p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })()}

                {/* ── PHASE 6.2 — Pierre 5 scénarios RH vendables (proof pack, lecture seule) ──
                    Aucune exécution autonome. Actions sensibles bloquées/validées. Aucun email réel / document officiel. */}
                {(() => {
                  const workflowPack = buildPierreRealWorkflowCompletionPack();
                  return (
                    <div className="mt-2 rounded-[1.25rem] border border-[#3f8f74]/16 bg-[#3f8f74]/05 p-3">
                      <p className="text-[0.62rem] font-semibold text-[#2c6f58]">Pierre — 5 scénarios RH vendables</p>
                      <p className="mt-1 text-[0.56rem] leading-4 text-[var(--cs-ink-4)]">
                        {PIERRE_WORKFLOW_PACK_MICROCOPY}. {PIERRE_WORKFLOW_PACK_VALUE_NO_RUNTIME} {PIERRE_WORKFLOW_PACK_SENSITIVE_BLOCKED} {PIERRE_WORKFLOW_PACK_NOT_PUBLIC_COMPLETE} {PIERRE_WORKFLOW_PACK_NEXT_P6_3}
                      </p>
                      <p className="mt-1 rounded-[1rem] border border-[#3f8f74]/16 bg-white/22 px-3 py-2 text-[0.56rem] leading-4 text-[#2c6f58]">
                        {PIERRE_WORKFLOW_PACK_PANEL_GUARDRAIL}
                      </p>
                      <p className="mt-1 text-[0.6rem] font-semibold text-[var(--cs-ink-2)]">
                        Statut : {getPierreWorkflowPackStatusLabel(workflowPack.pack_status)} · Scénarios : {workflowPack.scenario_count} · Candidat première vente : {workflowPack.sellable_proof_summary.first_sale_candidate ? "oui" : "non"} · Public launch ready : non
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {buildPierreWorkflowPackBadges().map((badge) => (
                          <span
                            key={badge.id}
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.54rem] font-semibold",
                              badge.tone === "success" ? "border-[rgba(21,130,96,0.2)] bg-[rgba(21,130,96,0.07)] text-[var(--cs-success)]"
                              : badge.tone === "danger" ? "border-[#b84a4a]/22 bg-[#b84a4a]/08 text-[#b84a4a]"
                              : badge.tone === "warning" ? "border-[#c99a4d]/22 bg-[#c99a4d]/08 text-[#8f682d]"
                              : badge.tone === "info" ? "border-[#6f83ff]/20 bg-[#6f83ff]/07 text-[#4f63d5]"
                              : "border-white/50 bg-white/22 text-[var(--cs-ink-4)]"
                            )}
                          >
                            {badge.label}
                          </span>
                        ))}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <button type="button" onClick={() => setShowWorkflowScenarios((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">
                          {PIERRE_WORKFLOW_PACK_VIEW_SCENARIOS_LABEL}
                        </button>
                        <button type="button" onClick={() => setShowWorkflowDeliverables((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">
                          {PIERRE_WORKFLOW_PACK_VIEW_DELIVERABLES_LABEL}
                        </button>
                        <button type="button" onClick={() => setShowWorkflowValidations((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">
                          {PIERRE_WORKFLOW_PACK_VIEW_VALIDATIONS_LABEL}
                        </button>
                        <button type="button" onClick={() => setShowWorkflowRisks((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">
                          {PIERRE_WORKFLOW_PACK_VIEW_RISKS_LABEL}
                        </button>
                        <button type="button" onClick={() => setShowWorkflowValue((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">
                          {PIERRE_WORKFLOW_PACK_VIEW_VALUE_LABEL}
                        </button>
                      </div>
                      {showWorkflowScenarios ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {workflowPack.scenarios.map((sc) => (
                            <p key={sc.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {sc.id} — {sc.title} · {sc.execution_status}</p>
                          ))}
                        </div>
                      ) : null}
                      {showWorkflowDeliverables ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {workflowPack.scenarios.map((sc) => (
                            <p key={sc.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {sc.id} : {sc.expected_deliverables.join(" · ")}</p>
                          ))}
                        </div>
                      ) : null}
                      {showWorkflowValidations ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {workflowPack.scenarios.map((sc) => (
                            <p key={sc.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {sc.id} validations : {sc.human_validations.join(" · ")} | bloqué : {sc.forbidden_outputs.join(" · ")}</p>
                          ))}
                        </div>
                      ) : null}
                      {showWorkflowRisks ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {workflowPack.legal_risk_matrix.map((risk) => (
                            <p key={risk.id} className="text-[0.52rem] leading-4 text-[#8f682d]">! [{risk.severity}] {risk.risk} → {risk.handling}</p>
                          ))}
                        </div>
                      ) : null}
                      {showWorkflowValue ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {workflowPack.scenarios.map((sc) => (
                            <p key={sc.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {sc.id} : {sc.sellable_value}</p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })()}

                {/* ── PHASE 6.3 — Pierre Decision Gate état/serveur/runtime (décision, lecture seule) ──
                    Aucune activation. Aucune route. Aucun SQL. Aucune exécution. Première vente ≠ public launch. */}
                {(() => {
                  const gate = buildPierreStateServerActivationDecisionGate();
                  return (
                    <div className="mt-2 rounded-[1.25rem] border border-[#6f83ff]/16 bg-[#6f83ff]/05 p-3">
                      <p className="text-[0.62rem] font-semibold text-[#4f63d5]">Pierre — Decision Gate état / serveur / runtime</p>
                      <p className="mt-1 text-[0.56rem] leading-4 text-[var(--cs-ink-4)]">
                        {PIERRE_DECISION_GATE_MICROCOPY}. {PIERRE_DECISION_GATE_SALE_VS_LAUNCH} {PIERRE_DECISION_GATE_RUNTIME_INACTIVE} {PIERRE_DECISION_GATE_SERVER_INACTIVE} {PIERRE_DECISION_GATE_NEXT_P6_4}
                      </p>
                      <p className="mt-1 rounded-[1rem] border border-[#6f83ff]/16 bg-white/22 px-3 py-2 text-[0.56rem] leading-4 text-[#4f63d5]">
                        {PIERRE_DECISION_GATE_PANEL_GUARDRAIL}
                      </p>
                      <p className="mt-1 text-[0.6rem] font-semibold text-[var(--cs-ink-2)]">
                        Statut : {getPierreDecisionGateStatusLabel(gate.gate_status)} · Stratégie : {getPierreDecisionGateStrategyLabel(gate.recommended_strategy)} · Première vente : {getPierreDecisionGateDecisionLabel(gate.first_sale_state_strategy.decision)}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {buildPierreDecisionGateBadges().map((badge) => (
                          <span
                            key={badge.id}
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.54rem] font-semibold",
                              badge.tone === "success" ? "border-[rgba(21,130,96,0.2)] bg-[rgba(21,130,96,0.07)] text-[var(--cs-success)]"
                              : badge.tone === "danger" ? "border-[#b84a4a]/22 bg-[#b84a4a]/08 text-[#b84a4a]"
                              : badge.tone === "warning" ? "border-[#c99a4d]/22 bg-[#c99a4d]/08 text-[#8f682d]"
                              : badge.tone === "info" ? "border-[#6f83ff]/20 bg-[#6f83ff]/07 text-[#4f63d5]"
                              : "border-white/50 bg-white/22 text-[var(--cs-ink-4)]"
                            )}
                          >
                            {badge.label}
                          </span>
                        ))}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <button type="button" onClick={() => setShowGateDecision((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{PIERRE_DECISION_GATE_VIEW_DECISION_LABEL}</button>
                        <button type="button" onClick={() => setShowGateConditions((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{PIERRE_DECISION_GATE_VIEW_CONDITIONS_LABEL}</button>
                        <button type="button" onClick={() => setShowGateNoGo((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{PIERRE_DECISION_GATE_VIEW_NOGO_LABEL}</button>
                        <button type="button" onClick={() => setShowGateApprovals((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{PIERRE_DECISION_GATE_VIEW_APPROVALS_LABEL}</button>
                        <button type="button" onClick={() => setShowGateRollback((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{PIERRE_DECISION_GATE_VIEW_ROLLBACK_LABEL}</button>
                        <button type="button" onClick={() => setShowGateP6((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{PIERRE_DECISION_GATE_VIEW_P6_LABEL}</button>
                      </div>
                      {showGateDecision ? (
                        <div className="mt-1.5 grid gap-0.5">
                          <p className="text-[0.54rem] leading-4 text-[var(--cs-ink-3)]">{gate.decision_summary}</p>
                          {gate.state_strategy_items.map((st) => (
                            <p key={st.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {st.title} [{getPierreDecisionGateDecisionLabel(st.decision)} · {st.applies_to}] — {st.reason}</p>
                          ))}
                        </div>
                      ) : null}
                      {showGateConditions ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {gate.activation_conditions.map((c, i) => (<p key={i} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {c}</p>))}
                        </div>
                      ) : null}
                      {showGateNoGo ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {gate.no_go_conditions.map((c, i) => (<p key={i} className="text-[0.52rem] leading-4 text-[#b84a4a]">✗ {c}</p>))}
                        </div>
                      ) : null}
                      {showGateApprovals ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {gate.approval_requirements.map((ap, i) => (<p key={i} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {ap.category} → {ap.required_approver} (self-approve : {ap.can_be_self_approved ? "oui" : "non"})</p>))}
                        </div>
                      ) : null}
                      {showGateRollback ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {gate.rollback_strategy.map((r, i) => (<p key={i} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {r}</p>))}
                        </div>
                      ) : null}
                      {showGateP6 ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {gate.p6_dependency_map.map((p6) => (<p key={p6.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {p6.title}{p6.optional ? " (optionnel)" : ""} — {p6.why}</p>))}
                        </div>
                      ) : null}
                    </div>
                  );
                })()}

                {/* ── PHASE 6.4 — Pierre Identité & canaux (readiness, lecture seule) ──
                    Aucun email réel. Aucun domaine connecté. Brouillons uniquement. Première vente ≠ email production. */}
                {(() => {
                  const identity = buildPierreChannelsIdentityFinalReport();
                  return (
                    <div className="mt-2 rounded-[1.25rem] border border-[#7a6cff]/16 bg-[#7a6cff]/05 p-3">
                      <p className="text-[0.62rem] font-semibold text-[#5c4ad3]">{PIERRE_IDENTITY_TITLE}</p>
                      <p className="mt-1 text-[0.56rem] leading-4 text-[var(--cs-ink-4)]">
                        {PIERRE_IDENTITY_MICROCOPY}. {PIERRE_IDENTITY_DRAFT_ONLY} {PIERRE_IDENTITY_DOMAIN_NOT_CONNECTED} {PIERRE_IDENTITY_SALE_VS_EMAIL} {PIERRE_IDENTITY_NEXT_P6_5}
                      </p>
                      <p className="mt-1 rounded-[1rem] border border-[#7a6cff]/16 bg-white/22 px-3 py-2 text-[0.56rem] leading-4 text-[#5c4ad3]">
                        {PIERRE_IDENTITY_PANEL_GUARDRAIL}
                      </p>
                      <p className="mt-1 text-[0.6rem] font-semibold text-[var(--cs-ink-2)]">
                        Statut : {getPierreIdentityStatusLabel(identity.identity_status)} · Mode : {getPierreIdentityModeLabel(identity.recommended_identity_mode)} · Canaux : {identity.channel_matrix.length} · Templates : {identity.draft_template_matrix.length}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {buildPierreIdentityBadges().map((badge) => (
                          <span
                            key={badge.id}
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.54rem] font-semibold",
                              badge.tone === "success" ? "border-[rgba(21,130,96,0.2)] bg-[rgba(21,130,96,0.07)] text-[var(--cs-success)]"
                              : badge.tone === "danger" ? "border-[#b84a4a]/22 bg-[#b84a4a]/08 text-[#b84a4a]"
                              : badge.tone === "warning" ? "border-[#c99a4d]/22 bg-[#c99a4d]/08 text-[#8f682d]"
                              : badge.tone === "info" ? "border-[#6f83ff]/20 bg-[#6f83ff]/07 text-[#4f63d5]"
                              : "border-white/50 bg-white/22 text-[var(--cs-ink-4)]"
                            )}
                          >
                            {badge.label}
                          </span>
                        ))}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <button type="button" onClick={() => setShowIdentity((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{PIERRE_IDENTITY_VIEW_IDENTITY_LABEL}</button>
                        <button type="button" onClick={() => setShowIdentityChannels((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{PIERRE_IDENTITY_VIEW_CHANNELS_LABEL}</button>
                        <button type="button" onClick={() => setShowIdentityEmail((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{PIERRE_IDENTITY_VIEW_EMAIL_LABEL}</button>
                        <button type="button" onClick={() => setShowIdentityPermissions((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{PIERRE_IDENTITY_VIEW_PERMISSIONS_LABEL}</button>
                        <button type="button" onClick={() => setShowIdentityTemplates((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{PIERRE_IDENTITY_VIEW_TEMPLATES_LABEL}</button>
                        <button type="button" onClick={() => setShowIdentityDomain((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{PIERRE_IDENTITY_VIEW_DOMAIN_LABEL}</button>
                      </div>
                      {showIdentity ? (
                        <div className="mt-1.5 grid gap-0.5">
                          <p className="text-[0.54rem] font-semibold text-[var(--cs-ink-2)]">{identity.pierre_display_identity.employee_name} — {identity.pierre_display_identity.employee_role}</p>
                          <p className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">{identity.pierre_display_identity.long_description}</p>
                          {identity.pierre_display_identity.forbidden_claims.map((c, i) => (<p key={i} className="text-[0.52rem] leading-4 text-[#8f682d]">! {c}</p>))}
                        </div>
                      ) : null}
                      {showIdentityChannels ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {identity.channel_matrix.map((ch) => (<p key={ch.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {ch.channel} [{getPierreChannelStatusLabel(ch.status)}] — {ch.usage}</p>))}
                        </div>
                      ) : null}
                      {showIdentityEmail ? (
                        <div className="mt-1.5 grid gap-0.5">
                          <span className="text-[0.54rem] font-semibold text-[var(--cs-ink-3)]">Première vente</span>
                          {identity.email_identity_strategy.first_sale_mode.map((m, i) => (<p key={i} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {m}</p>))}
                          <span className="mt-0.5 text-[0.54rem] font-semibold text-[var(--cs-ink-3)]">Domaine futur</span>
                          {identity.email_identity_strategy.future_customer_domain_mode.map((m, i) => (<p key={i} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {m}</p>))}
                        </div>
                      ) : null}
                      {showIdentityPermissions ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {identity.permissions_matrix.map((p, i) => (<p key={i} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {p.channel} : brouillon {p.can_prepare_draft ? "oui" : "non"} · envoi réel non · {p.cloneguard_decision}</p>))}
                        </div>
                      ) : null}
                      {showIdentityTemplates ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {identity.draft_template_matrix.map((t) => (<p key={t.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {t.name} (brouillon, validation humaine requise)</p>))}
                        </div>
                      ) : null}
                      {showIdentityDomain ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {identity.domain_readiness_strategy.map((d) => (<p key={d.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">○ {d.label} [{d.status}] · vérifié : non</p>))}
                        </div>
                      ) : null}
                    </div>
                  );
                })()}

                {/* ── PHASE 6.5 — Pierre Activation client E2E (proof path, lecture seule) ──
                    Aucun paiement live. Aucune exécution autonome. Première vente contrôlée ≠ public launch. */}
                {(() => {
                  const activation = buildPierreCustomerActivationE2EFinalReport();
                  return (
                    <div className="mt-2 rounded-[1.25rem] border border-[#3f8f74]/16 bg-[#3f8f74]/05 p-3">
                      <p className="text-[0.62rem] font-semibold text-[#2c6f58]">Pierre — Activation client E2E</p>
                      <p className="mt-1 text-[0.56rem] leading-4 text-[var(--cs-ink-4)]">
                        {PIERRE_ACTIVATION_MICROCOPY}. {PIERRE_ACTIVATION_FIRST_VALUE} {PIERRE_ACTIVATION_NO_AUTONOMOUS} {PIERRE_ACTIVATION_STRIPE_FUTURE} {PIERRE_ACTIVATION_NEXT_P6_6}
                      </p>
                      <p className="mt-1 rounded-[1rem] border border-[#3f8f74]/16 bg-white/22 px-3 py-2 text-[0.56rem] leading-4 text-[#2c6f58]">
                        {PIERRE_ACTIVATION_PANEL_GUARDRAIL}
                      </p>
                      <p className="mt-1 text-[0.6rem] font-semibold text-[var(--cs-ink-2)]">
                        Statut : {getPierreActivationStatusLabel(activation.activation_status)} · Étapes : {activation.customer_journey_steps.length} · Scénarios : {activation.scenario_entry_points.length} · Flow mission : {activation.first_mission_controlled_flow.length}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {buildPierreActivationBadges().map((badge) => (
                          <span
                            key={badge.id}
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.54rem] font-semibold",
                              badge.tone === "success" ? "border-[rgba(21,130,96,0.2)] bg-[rgba(21,130,96,0.07)] text-[var(--cs-success)]"
                              : badge.tone === "danger" ? "border-[#b84a4a]/22 bg-[#b84a4a]/08 text-[#b84a4a]"
                              : badge.tone === "warning" ? "border-[#c99a4d]/22 bg-[#c99a4d]/08 text-[#8f682d]"
                              : badge.tone === "info" ? "border-[#6f83ff]/20 bg-[#6f83ff]/07 text-[#4f63d5]"
                              : "border-white/50 bg-white/22 text-[var(--cs-ink-4)]"
                            )}
                          >
                            {badge.label}
                          </span>
                        ))}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <button type="button" onClick={() => setShowActJourney((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{PIERRE_ACTIVATION_VIEW_JOURNEY_LABEL}</button>
                        <button type="button" onClick={() => setShowActFirstValue((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{PIERRE_ACTIVATION_VIEW_FIRST_VALUE_LABEL}</button>
                        <button type="button" onClick={() => setShowActAccess((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{PIERRE_ACTIVATION_VIEW_ACCESS_LABEL}</button>
                        <button type="button" onClick={() => setShowActScenarios((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{PIERRE_ACTIVATION_VIEW_SCENARIOS_LABEL}</button>
                        <button type="button" onClick={() => setShowActEvidence((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{PIERRE_ACTIVATION_VIEW_EVIDENCE_LABEL}</button>
                        <button type="button" onClick={() => setShowActBlockers((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{PIERRE_ACTIVATION_VIEW_BLOCKERS_LABEL}</button>
                      </div>
                      {showActJourney ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {activation.customer_journey_steps.map((j) => (<p key={j.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">{j.letter}. {j.label} ({j.route}) — {j.customer_understanding}</p>))}
                        </div>
                      ) : null}
                      {showActFirstValue ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {activation.first_value_path.steps.map((stp, i) => (<p key={i} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">{i + 1}. {stp}</p>))}
                        </div>
                      ) : null}
                      {showActAccess ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {activation.access_control_matrix.map((a) => (<p key={a.customer_state} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {a.customer_state} : setup {a.can_access_setup ? "oui" : "non"} · use {a.can_access_use ? "oui" : "non"} · runtime non</p>))}
                        </div>
                      ) : null}
                      {showActScenarios ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {activation.scenario_entry_points.map((sc) => (<p key={sc.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {sc.id} {sc.scenario} → {sc.trigger_label} : {sc.expected_output}</p>))}
                        </div>
                      ) : null}
                      {showActEvidence ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {activation.first_paid_customer_evidence_checklist.map((e) => (<p key={e.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {e.label} → {e.expected}</p>))}
                          {activation.customer_visible_limits.map((l, i) => (<p key={i} className="text-[0.52rem] leading-4 text-[#8f682d]">! {l}</p>))}
                        </div>
                      ) : null}
                      {showActBlockers ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {activation.public_launch_blockers.map((bl, i) => (<p key={i} className="text-[0.52rem] leading-4 text-[#b84a4a]">✗ {bl}</p>))}
                        </div>
                      ) : null}
                    </div>
                  );
                })()}

                {/* ── PHASE 6.6 — Pierre Sellable Gate Final (verdict contrôlé, lecture seule) ──
                    Premier client contrôlé READY_WITH_LIMITS · public launch BLOCKED · scale 80k NOT_PROVEN. */}
                {(() => {
                  const gate = buildPierreSellableGateFinalReport();
                  return (
                    <div className="mt-2 rounded-[1.25rem] border border-[#3f8f74]/16 bg-[#3f8f74]/05 p-3">
                      <p className="text-[0.62rem] font-semibold text-[#2c6f58]">Pierre — Sellable Gate Final</p>
                      <p className="mt-1 text-[0.56rem] leading-4 text-[var(--cs-ink-4)]">
                        {PIERRE_GATE_MICROCOPY}. {PIERRE_GATE_CONTROLLED_SELLABLE} {PIERRE_GATE_NOT_PUBLIC} {PIERRE_GATE_REMAINING} {PIERRE_GATE_NEXT_PHASE}
                      </p>
                      <p className="mt-1 rounded-[1rem] border border-[#3f8f74]/16 bg-white/22 px-3 py-2 text-[0.56rem] leading-4 text-[#2c6f58]">
                        {PIERRE_GATE_PANEL_GUARDRAIL}
                      </p>
                      <p className="mt-1 text-[0.6rem] font-semibold text-[var(--cs-ink-2)]">
                        Statut : {getPierreGateStatusLabel(gate.gate_status)} · Niveau : {getPierreSellabilityLevelLabel(gate.final_sellability_level)} · Phases P6 : {gate.p6_phase_matrix.length}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {buildPierreGateBadges().map((badge) => (
                          <span
                            key={badge.id}
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.54rem] font-semibold",
                              badge.tone === "success" ? "border-[rgba(21,130,96,0.2)] bg-[rgba(21,130,96,0.07)] text-[var(--cs-success)]"
                              : badge.tone === "danger" ? "border-[#b84a4a]/22 bg-[#b84a4a]/08 text-[#b84a4a]"
                              : badge.tone === "warning" ? "border-[#c99a4d]/22 bg-[#c99a4d]/08 text-[#8f682d]"
                              : badge.tone === "info" ? "border-[#6f83ff]/20 bg-[#6f83ff]/07 text-[#4f63d5]"
                              : "border-white/50 bg-white/22 text-[var(--cs-ink-4)]"
                            )}
                          >
                            {badge.label}
                          </span>
                        ))}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <button type="button" onClick={() => setShowGateVerdict((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{PIERRE_GATE_VIEW_VERDICT_LABEL}</button>
                        <button type="button" onClick={() => setShowGateEvidence((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{PIERRE_GATE_VIEW_EVIDENCE_LABEL}</button>
                        <button type="button" onClick={() => setShowGateAllowed((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{PIERRE_GATE_VIEW_ALLOWED_LABEL}</button>
                        <button type="button" onClick={() => setShowGateForbidden((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{PIERRE_GATE_VIEW_FORBIDDEN_LABEL}</button>
                        <button type="button" onClick={() => setShowSGateConditions((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{PIERRE_GATE_VIEW_CONDITIONS_LABEL}</button>
                        <button type="button" onClick={() => setShowGateBlockers((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{PIERRE_GATE_VIEW_BLOCKERS_LABEL}</button>
                      </div>
                      {showGateVerdict ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {gate.sellability_verdict_matrix.map((v) => (<p key={v.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {v.label} : {getPierreSellabilityVerdictLabel(v.verdict)} ({v.verdict})</p>))}
                        </div>
                      ) : null}
                      {showGateEvidence ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {gate.evidence_summary.map((e) => (<p key={e.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {e.phase} {e.label} → {e.evidence}</p>))}
                        </div>
                      ) : null}
                      {showGateAllowed ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {gate.customer_promise_allowed.map((p, i) => (<p key={i} className="text-[0.52rem] leading-4 text-[var(--cs-success)]">✓ {p}</p>))}
                        </div>
                      ) : null}
                      {showGateForbidden ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {gate.customer_promise_forbidden.map((p, i) => (<p key={i} className="text-[0.52rem] leading-4 text-[#b84a4a]">✗ {p}</p>))}
                        </div>
                      ) : null}
                      {showSGateConditions ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {gate.controlled_sale_conditions.map((c, i) => (<p key={i} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {c}</p>))}
                        </div>
                      ) : null}
                      {showGateBlockers ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {gate.public_launch_blockers.map((bl, i) => (<p key={`pl${i}`} className="text-[0.52rem] leading-4 text-[#b84a4a]">✗ public launch — {bl}</p>))}
                          {gate.scale_blockers.map((bl, i) => (<p key={`sc${i}`} className="text-[0.52rem] leading-4 text-[#8f682d]">! scale 80k — {bl}</p>))}
                        </div>
                      ) : null}
                    </div>
                  );
                })()}

                {/* ── PHASE 7.1 — External Go-Live Proofs Gate (preuves externes, lecture seule) ──
                    Aucune preuve inventée. Public launch reste BLOCKED sans preuve réelle. */}
                {(() => {
                  const egl = buildExternalGoLiveProofsReport();
                  return (
                    <div className="mt-2 rounded-[1.25rem] border border-[#3f8f74]/16 bg-[#3f8f74]/05 p-3">
                      <p className="text-[0.62rem] font-semibold text-[#2c6f58]">Go-Live — Preuves externes</p>
                      <p className="mt-1 text-[0.56rem] leading-4 text-[var(--cs-ink-4)]">
                        {EXTERNAL_GOLIVE_MICROCOPY}. {EXTERNAL_GOLIVE_NO_INVENTED} {EXTERNAL_GOLIVE_NOT_PUBLIC} {EXTERNAL_GOLIVE_MANUAL} {EXTERNAL_GOLIVE_NEXT_PHASE}
                      </p>
                      <p className="mt-1 rounded-[1rem] border border-[#3f8f74]/16 bg-white/22 px-3 py-2 text-[0.56rem] leading-4 text-[#2c6f58]">
                        {EXTERNAL_GOLIVE_PANEL_GUARDRAIL}
                      </p>
                      <p className="mt-1 text-[0.6rem] font-semibold text-[var(--cs-ink-2)]">
                        Statut : {getExternalGoLiveStatusLabel(egl.proof_status)} · Public launch : {getExternalPublicLaunchVerdictLabel(egl.public_launch_verdict)} · Premier client réel : {getFirstLiveCustomerReadinessLabel(egl.first_live_customer_ready)}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {buildExternalGoLiveBadges().map((badge) => (
                          <span
                            key={badge.id}
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.54rem] font-semibold",
                              badge.tone === "success" ? "border-[rgba(21,130,96,0.2)] bg-[rgba(21,130,96,0.07)] text-[var(--cs-success)]"
                              : badge.tone === "danger" ? "border-[#b84a4a]/22 bg-[#b84a4a]/08 text-[#b84a4a]"
                              : badge.tone === "warning" ? "border-[#c99a4d]/22 bg-[#c99a4d]/08 text-[#8f682d]"
                              : badge.tone === "info" ? "border-[#6f83ff]/20 bg-[#6f83ff]/07 text-[#4f63d5]"
                              : "border-white/50 bg-white/22 text-[var(--cs-ink-4)]"
                            )}
                          >
                            {badge.label}
                          </span>
                        ))}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <button type="button" onClick={() => setShowEglStripe((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{EXTERNAL_GOLIVE_VIEW_STRIPE_LABEL}</button>
                        <button type="button" onClick={() => setShowEglSupabase((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{EXTERNAL_GOLIVE_VIEW_SUPABASE_LABEL}</button>
                        <button type="button" onClick={() => setShowEglDomain((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{EXTERNAL_GOLIVE_VIEW_DOMAIN_LABEL}</button>
                        <button type="button" onClick={() => setShowEglCustomer((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{EXTERNAL_GOLIVE_VIEW_CUSTOMER_LABEL}</button>
                        <button type="button" onClick={() => setShowEglManual((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{EXTERNAL_GOLIVE_VIEW_MANUAL_LABEL}</button>
                        <button type="button" onClick={() => setShowEglBlockers((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{EXTERNAL_GOLIVE_VIEW_BLOCKERS_LABEL}</button>
                      </div>
                      {showEglStripe ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {egl.stripe_live_matrix.map((r) => (<p key={r.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• [{getExternalProofClassificationLabel(r.classification)}] {r.label} — {r.expected_proof} ({r.evidence_location})</p>))}
                        </div>
                      ) : null}
                      {showEglSupabase ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {egl.supabase_prod_rls_matrix.map((r) => (<p key={r.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• [{getExternalProofClassificationLabel(r.classification)}] {r.label} — {r.expected_proof} ({r.evidence_location})</p>))}
                        </div>
                      ) : null}
                      {showEglDomain ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {egl.domain_email_matrix.map((r) => (<p key={r.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• [{getExternalProofClassificationLabel(r.classification)}] {r.label} — {r.expected_proof} ({r.evidence_location})</p>))}
                        </div>
                      ) : null}
                      {showEglCustomer ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {egl.first_live_customer_matrix.map((r) => (<p key={r.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• [{getExternalProofClassificationLabel(r.classification)}] {r.label} — {r.expected_proof}</p>))}
                        </div>
                      ) : null}
                      {showEglManual ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {egl.manual_steps.map((m) => (<p key={m.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">{m.order}. {m.step} — {m.description}</p>))}
                        </div>
                      ) : null}
                      {showEglBlockers ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {egl.blockers.map((bl, i) => (<p key={i} className="text-[0.52rem] leading-4 text-[#b84a4a]">✗ {bl}</p>))}
                        </div>
                      ) : null}
                    </div>
                  );
                })()}

                {/* ── PHASE 7.2 — First Live Customer Controlled Run (premier client réel, lecture seule) ──
                    Aucune preuve client inventée. Public launch reste BLOCKED. go-live proofs manuels. */}
                {(() => {
                  const flc = buildFirstLiveCustomerControlledRunReport();
                  return (
                    <div className="mt-2 rounded-[1.25rem] border border-[#3f8f74]/16 bg-[#3f8f74]/05 p-3">
                      <p className="text-[0.62rem] font-semibold text-[#2c6f58]">Pierre — First Live Customer Run</p>
                      <p className="mt-1 text-[0.56rem] leading-4 text-[var(--cs-ink-4)]">
                        {FLC_MICROCOPY}. {FLC_NOT_PUBLIC} {FLC_NO_INVENTED} {FLC_GO_LIVE_MANUAL} {FLC_NEXT_PHASE}
                      </p>
                      <p className="mt-1 rounded-[1rem] border border-[#3f8f74]/16 bg-white/22 px-3 py-2 text-[0.56rem] leading-4 text-[#2c6f58]">
                        {FLC_PANEL_GUARDRAIL}
                      </p>
                      <p className="mt-1 text-[0.6rem] font-semibold text-[var(--cs-ink-2)]">
                        Statut : {getFlcRunStatusLabel(flc.run_status)} · Qualification : {flc.customer_qualification_matrix.length} · Runbook : {flc.activation_runbook.length} étapes · Evidence : {flc.evidence_collection_plan.length}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {buildFlcBadges().map((badge) => (
                          <span
                            key={badge.id}
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.54rem] font-semibold",
                              badge.tone === "success" ? "border-[rgba(21,130,96,0.2)] bg-[rgba(21,130,96,0.07)] text-[var(--cs-success)]"
                              : badge.tone === "danger" ? "border-[#b84a4a]/22 bg-[#b84a4a]/08 text-[#b84a4a]"
                              : badge.tone === "warning" ? "border-[#c99a4d]/22 bg-[#c99a4d]/08 text-[#8f682d]"
                              : badge.tone === "info" ? "border-[#6f83ff]/20 bg-[#6f83ff]/07 text-[#4f63d5]"
                              : "border-white/50 bg-white/22 text-[var(--cs-ink-4)]"
                            )}
                          >
                            {badge.label}
                          </span>
                        ))}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <button type="button" onClick={() => setShowFlcQualification((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{FLC_VIEW_QUALIFICATION_LABEL}</button>
                        <button type="button" onClick={() => setShowFlcRunbook((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{FLC_VIEW_RUNBOOK_LABEL}</button>
                        <button type="button" onClick={() => setShowFlcEvidence((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{FLC_VIEW_EVIDENCE_LABEL}</button>
                        <button type="button" onClick={() => setShowFlcNoGo((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{FLC_VIEW_NOGO_LABEL}</button>
                        <button type="button" onClick={() => setShowFlcRollback((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{FLC_VIEW_ROLLBACK_LABEL}</button>
                        <button type="button" onClick={() => setShowFlcNext((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{FLC_VIEW_NEXT_LABEL}</button>
                      </div>
                      {showFlcQualification ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {flc.customer_qualification_matrix.map((q) => (<p key={q.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {q.label}{q.required ? " (requis)" : ""} — preuve : {q.evidence_needed}</p>))}
                        </div>
                      ) : null}
                      {showFlcRunbook ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {flc.activation_runbook.map((r) => (<p key={r.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">{r.order}. {r.label} ({r.owner}) → {r.expected_output}</p>))}
                          {flc.first_mission_runbook.map((sc) => (<p key={sc.scenario_id} className="text-[0.52rem] leading-4 text-[#2c6f58]">◦ {sc.scenario_id} {sc.label} · {getFlcRiskLabel(sc.risk_level)}{sc.recommended_for_first_customer ? " · recommandé 1er client" : ""}</p>))}
                        </div>
                      ) : null}
                      {showFlcEvidence ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {flc.evidence_collection_plan.map((e) => (<p key={e.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {e.label}{e.required ? " (requis)" : ""} → {e.storage_location_hint}</p>))}
                        </div>
                      ) : null}
                      {showFlcNoGo ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {flc.no_go_conditions.map((n, i) => (<p key={i} className="text-[0.52rem] leading-4 text-[#b84a4a]">✗ {n}</p>))}
                        </div>
                      ) : null}
                      {showFlcRollback ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {flc.rollback_plan.map((r) => (<p key={r.id} className="text-[0.52rem] leading-4 text-[#8f682d]">! {r.step} — {r.description}</p>))}
                        </div>
                      ) : null}
                      {showFlcNext ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {flc.customer_feedback_plan.map((q, i) => (<p key={i} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">? {q}</p>))}
                          <p className="text-[0.52rem] leading-4 text-[#2c6f58]">→ {flc.recommended_next_phase}</p>
                        </div>
                      ) : null}
                    </div>
                  );
                })()}

                {/* ── PHASE 7.3 — First Customer Evidence Review (audit preuves réelles, lecture seule) ──
                    Aucune preuve inventée ni auto-validée. Public launch reste BLOCKED. go-live proofs manuels. */}
                {(() => {
                  const fcer = buildFirstCustomerEvidenceReviewReport();
                  return (
                    <div className="mt-2 rounded-[1.25rem] border border-[#3f8f74]/16 bg-[#3f8f74]/05 p-3">
                      <p className="text-[0.62rem] font-semibold text-[#2c6f58]">Pierre — First Customer Evidence Review</p>
                      <p className="mt-1 text-[0.56rem] leading-4 text-[var(--cs-ink-4)]">
                        {FCER_MICROCOPY}. {FCER_NO_AUTO_VALIDATION} {FCER_NOT_PUBLIC} {FCER_GO_LIVE_MANUAL} {FCER_NEXT_PHASE}
                      </p>
                      <p className="mt-1 rounded-[1rem] border border-[#3f8f74]/16 bg-white/22 px-3 py-2 text-[0.56rem] leading-4 text-[#2c6f58]">
                        {FCER_PANEL_GUARDRAIL}
                      </p>
                      <p className="mt-1 text-[0.6rem] font-semibold text-[var(--cs-ink-2)]">
                        Statut : {getEvidenceReviewStatusLabel(fcer.review_status)} · Matrice : {fcer.evidence_review_matrix.length} catégories · Scores : {fcer.evidence_quality_scores.length} · Décisions : {fcer.post_run_decision_matrix.length}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {buildFcerBadges().map((badge) => (
                          <span
                            key={badge.id}
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.54rem] font-semibold",
                              badge.tone === "success" ? "border-[rgba(21,130,96,0.2)] bg-[rgba(21,130,96,0.07)] text-[var(--cs-success)]"
                              : badge.tone === "danger" ? "border-[#b84a4a]/22 bg-[#b84a4a]/08 text-[#b84a4a]"
                              : badge.tone === "warning" ? "border-[#c99a4d]/22 bg-[#c99a4d]/08 text-[#8f682d]"
                              : badge.tone === "info" ? "border-[#6f83ff]/20 bg-[#6f83ff]/07 text-[#4f63d5]"
                              : "border-white/50 bg-white/22 text-[var(--cs-ink-4)]"
                            )}
                          >
                            {badge.label}
                          </span>
                        ))}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <button type="button" onClick={() => setShowFcerMatrix((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{FCER_VIEW_MATRIX_LABEL}</button>
                        <button type="button" onClick={() => setShowFcerRules((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{FCER_VIEW_RULES_LABEL}</button>
                        <button type="button" onClick={() => setShowFcerCriteria((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{FCER_VIEW_CRITERIA_LABEL}</button>
                        <button type="button" onClick={() => setShowFcerLaunchGate((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{FCER_VIEW_LAUNCH_GATE_LABEL}</button>
                        <button type="button" onClick={() => setShowFcerGoLive((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{FCER_VIEW_GOLIVE_LABEL}</button>
                        <button type="button" onClick={() => setShowFcerDecision((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{FCER_VIEW_DECISION_LABEL}</button>
                      </div>
                      {showFcerMatrix ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {fcer.evidence_review_matrix.map((m) => (<p key={m.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {getEvidenceCategoryLabel(m.category)} — {m.label} : {m.status}{m.blocks_success_if_missing ? " (bloquant)" : ""}</p>))}
                        </div>
                      ) : null}
                      {showFcerRules ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {fcer.verification_rules.map((r, i) => (<p key={i} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {r}</p>))}
                        </div>
                      ) : null}
                      {showFcerCriteria ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {fcer.success_criteria.map((c, i) => (<p key={`s${i}`} className="text-[0.52rem] leading-4 text-[var(--cs-success)]">✓ {c}</p>))}
                          {fcer.failure_criteria.map((c, i) => (<p key={`f${i}`} className="text-[0.52rem] leading-4 text-[#b84a4a]">✗ {c}</p>))}
                          {fcer.partial_success_criteria.map((c, i) => (<p key={`p${i}`} className="text-[0.52rem] leading-4 text-[#8f682d]">~ {c}</p>))}
                        </div>
                      ) : null}
                      {showFcerLaunchGate ? (
                        <div className="mt-1.5 grid gap-0.5">
                          <p className="text-[0.52rem] leading-4 text-[#b84a4a]">Public launch : {fcer.public_launch_decision_gate.final_public_launch_decision}</p>
                          {fcer.evidence_quality_scores.map((q) => (<p key={q.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {q.label} : {q.current_score}/{q.max_score} (seuil success {q.threshold_for_success})</p>))}
                        </div>
                      ) : null}
                      {showFcerGoLive ? (
                        <div className="mt-1.5 grid gap-0.5">
                          <p className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">update recommandé : {fcer.go_live_proof_update_recommendation.update_recommended ? "oui" : "non"} · jamais auto · relecture manuelle requise</p>
                          <p className="text-[0.52rem] leading-4 text-[#2c6f58]">Continuation recommandée : {fcer.customer_continuation_recommendation.recommended}</p>
                        </div>
                      ) : null}
                      {showFcerDecision ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {fcer.post_run_decision_matrix.map((d) => (<p key={d.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">{d.scenario}. {d.condition} → {d.action} ({d.note})</p>))}
                        </div>
                      ) : null}
                    </div>
                  );
                })()}

                {/* ── PHASE 7.4 — Customer Evidence Applied / Second Customer (application contrôlée, lecture seule) ──
                    Aucune preuve appliquée sans vérification réelle. Public launch reste BLOCKED. Client 2 non démarré. */}
                {(() => {
                  const cea = buildCustomerEvidenceAppliedSecondCustomerReport();
                  return (
                    <div className="mt-2 rounded-[1.25rem] border border-[#3f8f74]/16 bg-[#3f8f74]/05 p-3">
                      <p className="text-[0.62rem] font-semibold text-[#2c6f58]">Pierre — Customer Evidence Applied</p>
                      <p className="mt-1 text-[0.56rem] leading-4 text-[var(--cs-ink-4)]">
                        {CEA_MICROCOPY}. {CEA_NO_APPLY_WITHOUT_REAL} {CEA_NOT_PUBLIC} {CEA_GO_LIVE_MANUAL} {CEA_NEXT_PHASE}
                      </p>
                      <p className="mt-1 rounded-[1rem] border border-[#3f8f74]/16 bg-white/22 px-3 py-2 text-[0.56rem] leading-4 text-[#2c6f58]">
                        {CEA_PANEL_GUARDRAIL}
                      </p>
                      <p className="mt-1 text-[0.6rem] font-semibold text-[var(--cs-ink-2)]">
                        Statut : {getEvidenceApplicationStatusLabel(cea.application_status)} · Matrice : {cea.reviewed_evidence_application_matrix.length} · Contributions : {cea.go_live_contribution_matrix.length} · Runbook client 2 : {cea.second_customer_runbook.length}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {buildCeaBadges().map((badge) => (
                          <span
                            key={badge.id}
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.54rem] font-semibold",
                              badge.tone === "success" ? "border-[rgba(21,130,96,0.2)] bg-[rgba(21,130,96,0.07)] text-[var(--cs-success)]"
                              : badge.tone === "danger" ? "border-[#b84a4a]/22 bg-[#b84a4a]/08 text-[#b84a4a]"
                              : badge.tone === "warning" ? "border-[#c99a4d]/22 bg-[#c99a4d]/08 text-[#8f682d]"
                              : badge.tone === "info" ? "border-[#6f83ff]/20 bg-[#6f83ff]/07 text-[#4f63d5]"
                              : "border-white/50 bg-white/22 text-[var(--cs-ink-4)]"
                            )}
                          >
                            {badge.label}
                          </span>
                        ))}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <button type="button" onClick={() => setShowCeaApplication((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{CEA_VIEW_APPLICATION_LABEL}</button>
                        <button type="button" onClick={() => setShowCeaContribution((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{CEA_VIEW_CONTRIBUTION_LABEL}</button>
                        <button type="button" onClick={() => setShowCeaSecondCustomer((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{CEA_VIEW_SECOND_CUSTOMER_LABEL}</button>
                        <button type="button" onClick={() => setShowCeaComparison((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{CEA_VIEW_COMPARISON_LABEL}</button>
                        <button type="button" onClick={() => setShowCeaSafetyGate((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{CEA_VIEW_SAFETY_GATE_LABEL}</button>
                        <button type="button" onClick={() => setShowCeaRunbook((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{CEA_VIEW_RUNBOOK_LABEL}</button>
                      </div>
                      {showCeaApplication ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {cea.reviewed_evidence_application_matrix.map((m) => (<p key={m.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {getAppliedEvidenceCategoryLabel(m.category)} — {m.label} : {m.application_decision} ({m.reason_not_applied})</p>))}
                        </div>
                      ) : null}
                      {showCeaContribution ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {cea.go_live_contribution_matrix.map((c) => (<p key={c.contribution_id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {c.label} — {c.required_evidence} · éligible actuel : non · auto-update : non</p>))}
                        </div>
                      ) : null}
                      {showCeaSecondCustomer ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {cea.second_customer_preparation_matrix.map((p) => (<p key={p.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {p.label}{p.required ? " (requis)" : ""} : prêt non — {p.reason}</p>))}
                          {cea.second_customer_selection_criteria.map((c, i) => (<p key={`crit${i}`} className="text-[0.52rem] leading-4 text-[#2c6f58]">◦ {c}</p>))}
                        </div>
                      ) : null}
                      {showCeaComparison ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {cea.customer_1_vs_customer_2_comparison_plan.map((c, i) => (<p key={i} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {c}</p>))}
                        </div>
                      ) : null}
                      {showCeaSafetyGate ? (
                        <div className="mt-1.5 grid gap-0.5">
                          <p className="text-[0.52rem] leading-4 text-[#b84a4a]">Public launch : {cea.public_launch_safety_gate.final_decision} · un client ne suffit pas · deux clients ne suffisent pas seuls</p>
                          <p className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">Multi-client : {cea.multi_customer_evidence_base.current_verified_customer_count}/{cea.multi_customer_evidence_base.customer_count_required_before_public_launch} vérifiés · {cea.multi_customer_evidence_base.recommendation}</p>
                          {cea.evidence_application_rules.map((r, i) => (<p key={i} className="text-[0.52rem] leading-4 text-[#8f682d]">! {r}</p>))}
                        </div>
                      ) : null}
                      {showCeaRunbook ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {cea.second_customer_runbook.map((r) => (<p key={r.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">{r.order}. {r.label} (démarrable maintenant : non)</p>))}
                          <p className="text-[0.52rem] leading-4 text-[#2c6f58]">→ {cea.recommended_next_phase}</p>
                        </div>
                      ) : null}
                    </div>
                  );
                })()}

                {/* ── PHASE 7.5 — Second Customer Controlled Run / Public Launch Prep (lecture seule) ──
                    Client 2 préparé mais non démarré. Comparaison multi-client à prouver. Public launch BLOCKED. */}
                {(() => {
                  const sc2 = buildSecondCustomerControlledRunPublicLaunchPrepReport();
                  return (
                    <div className="mt-2 rounded-[1.25rem] border border-[#3f8f74]/16 bg-[#3f8f74]/05 p-3">
                      <p className="text-[0.62rem] font-semibold text-[#2c6f58]">Pierre — Second Customer Controlled Run</p>
                      <p className="mt-1 text-[0.56rem] leading-4 text-[var(--cs-ink-4)]">
                        {SC2_MICROCOPY}. {SC2_NOT_STARTED} {SC2_MULTI_UNPROVEN} {SC2_NOT_PUBLIC} {SC2_NEXT_PHASE}
                      </p>
                      <p className="mt-1 rounded-[1rem] border border-[#3f8f74]/16 bg-white/22 px-3 py-2 text-[0.56rem] leading-4 text-[#2c6f58]">
                        {SC2_PANEL_GUARDRAIL}
                      </p>
                      <p className="mt-1 text-[0.6rem] font-semibold text-[var(--cs-ink-2)]">
                        Statut : {getSc2RunStatusLabel(sc2.run_status)} · Qualification : {sc2.second_customer_qualification_matrix.length} · Runbook : {sc2.second_customer_activation_runbook.length} · Comparaison : {sc2.customer_1_vs_customer_2_comparison_matrix.length} axes
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {buildSc2Badges().map((badge) => (
                          <span
                            key={badge.id}
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.54rem] font-semibold",
                              badge.tone === "success" ? "border-[rgba(21,130,96,0.2)] bg-[rgba(21,130,96,0.07)] text-[var(--cs-success)]"
                              : badge.tone === "danger" ? "border-[#b84a4a]/22 bg-[#b84a4a]/08 text-[#b84a4a]"
                              : badge.tone === "warning" ? "border-[#c99a4d]/22 bg-[#c99a4d]/08 text-[#8f682d]"
                              : badge.tone === "info" ? "border-[#6f83ff]/20 bg-[#6f83ff]/07 text-[#4f63d5]"
                              : "border-white/50 bg-white/22 text-[var(--cs-ink-4)]"
                            )}
                          >
                            {badge.label}
                          </span>
                        ))}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <button type="button" onClick={() => setShowSc2Qualification((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{SC2_VIEW_QUALIFICATION_LABEL}</button>
                        <button type="button" onClick={() => setShowSc2Runbook((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{SC2_VIEW_RUNBOOK_LABEL}</button>
                        <button type="button" onClick={() => setShowSc2Evidence((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{SC2_VIEW_EVIDENCE_LABEL}</button>
                        <button type="button" onClick={() => setShowSc2Comparison((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{SC2_VIEW_COMPARISON_LABEL}</button>
                        <button type="button" onClick={() => setShowSc2Reproducibility((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{SC2_VIEW_REPRODUCIBILITY_LABEL}</button>
                        <button type="button" onClick={() => setShowSc2LaunchPrep((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{SC2_VIEW_LAUNCH_PREP_LABEL}</button>
                      </div>
                      {showSc2Qualification ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {sc2.second_customer_qualification_matrix.map((q) => (<p key={q.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {q.label}{q.required ? " (requis)" : ""} — preuve : {q.evidence_needed}</p>))}
                        </div>
                      ) : null}
                      {showSc2Runbook ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {sc2.second_customer_activation_runbook.map((r) => (<p key={r.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">{r.order}. {r.label} ({r.owner}) → {r.expected_output} (démarrable : non)</p>))}
                          {sc2.second_customer_scenario_matrix.map((sc) => (<p key={sc.scenario_id} className="text-[0.52rem] leading-4 text-[#2c6f58]">◦ {sc.scenario_id} {sc.label} · {getSc2RiskLabel(sc.risk_level)}{sc.recommended_for_second_customer ? " · recommandé client 2" : " · non recommandé"}</p>))}
                        </div>
                      ) : null}
                      {showSc2Evidence ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {sc2.second_customer_evidence_plan.map((e) => (<p key={e.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {e.label}{e.required ? " (requis)" : ""} : collecté non — {e.verification_method}</p>))}
                        </div>
                      ) : null}
                      {showSc2Comparison ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {sc2.customer_1_vs_customer_2_comparison_matrix.map((c) => (<p key={c.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {c.label} : {c.comparison_status} (client 1 / client 2 : —)</p>))}
                        </div>
                      ) : null}
                      {showSc2Reproducibility ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {sc2.reproducibility_assessment.map((r) => (<p key={r.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {r.label} : {r.current_score} (seuil multi-client {r.threshold_for_multi_customer_confidence})</p>))}
                          <p className="text-[0.52rem] leading-4 text-[#8f682d]">Multi-client : {sc2.multi_customer_evidence_readiness.verified_customer_count}/{sc2.multi_customer_evidence_readiness.required_customer_count} vérifiés · prête : non</p>
                        </div>
                      ) : null}
                      {showSc2LaunchPrep ? (
                        <div className="mt-1.5 grid gap-0.5">
                          <p className="text-[0.52rem] leading-4 text-[#b84a4a]">Public launch : {sc2.public_launch_review_prep.final_public_launch_decision} · review prête : non</p>
                          {sc2.public_launch_review_inputs.map((i) => (<p key={i.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {i.label} : vérifié non{i.blocking_if_missing ? " (bloquant)" : ""}</p>))}
                          {sc2.public_launch_blocker_matrix.map((b, i) => (<p key={`bl${i}`} className="text-[0.52rem] leading-4 text-[#b84a4a]">✗ {b}</p>))}
                        </div>
                      ) : null}
                    </div>
                  );
                })()}

                {/* ── PHASE 7.6 — Public Launch Final Review Gate (verdict final Phase 7, lecture seule) ──
                    Gates internes prêts, preuves externes manquantes. Public launch BLOCKED. Aucune preuve inventée. */}
                {(() => {
                  const plf = buildPublicLaunchFinalReviewGateReport();
                  return (
                    <div className="mt-2 rounded-[1.25rem] border border-[#3f8f74]/16 bg-[#3f8f74]/05 p-3">
                      <p className="text-[0.62rem] font-semibold text-[#2c6f58]">Pierre — Public Launch Final Review</p>
                      <p className="mt-1 text-[0.56rem] leading-4 text-[var(--cs-ink-4)]">
                        {PLF_MICROCOPY}. {PLF_INTERNAL_VS_EXTERNAL} {PLF_SELLABLE_LIMITS} {PLF_NOT_PUBLIC} {PLF_NEXT_REAL}
                      </p>
                      <p className="mt-1 rounded-[1rem] border border-[#3f8f74]/16 bg-white/22 px-3 py-2 text-[0.56rem] leading-4 text-[#2c6f58]">
                        {PLF_PANEL_GUARDRAIL}
                      </p>
                      <p className="mt-1 text-[0.6rem] font-semibold text-[var(--cs-ink-2)]">
                        Statut : {getPlfReviewStatusLabel(plf.review_status)} · Décision : {plf.final_public_launch_decision.decision} · Gates Phase 7 : {plf.phase_7_completion_matrix.length} · Preuves externes : {plf.external_proof_final_matrix.length}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {buildPlfBadges().map((badge) => (
                          <span
                            key={badge.id}
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.54rem] font-semibold",
                              badge.tone === "success" ? "border-[rgba(21,130,96,0.2)] bg-[rgba(21,130,96,0.07)] text-[var(--cs-success)]"
                              : badge.tone === "danger" ? "border-[#b84a4a]/22 bg-[#b84a4a]/08 text-[#b84a4a]"
                              : badge.tone === "warning" ? "border-[#c99a4d]/22 bg-[#c99a4d]/08 text-[#8f682d]"
                              : badge.tone === "info" ? "border-[#6f83ff]/20 bg-[#6f83ff]/07 text-[#4f63d5]"
                              : "border-white/50 bg-white/22 text-[var(--cs-ink-4)]"
                            )}
                          >
                            {badge.label}
                          </span>
                        ))}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <button type="button" onClick={() => setShowPlfVerdict((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{PLF_VIEW_VERDICT_LABEL}</button>
                        <button type="button" onClick={() => setShowPlfBlockers((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{PLF_VIEW_BLOCKERS_LABEL}</button>
                        <button type="button" onClick={() => setShowPlfProofs((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{PLF_VIEW_PROOFS_LABEL}</button>
                        <button type="button" onClick={() => setShowPlfClaims((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{PLF_VIEW_CLAIMS_LABEL}</button>
                        <button type="button" onClick={() => setShowPlfActions((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{PLF_VIEW_ACTIONS_LABEL}</button>
                        <button type="button" onClick={() => setShowPlfClosure((v) => !v)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">{PLF_VIEW_CLOSURE_LABEL}</button>
                      </div>
                      {showPlfVerdict ? (
                        <div className="mt-1.5 grid gap-0.5">
                          <p className="text-[0.52rem] leading-4 text-[var(--cs-success)]">• Premier client contrôlé : {plf.product_sellability_verdict.controlled_first_customer.verdict}</p>
                          <p className="text-[0.52rem] leading-4 text-[#2c6f58]">• Client 2 : {plf.product_sellability_verdict.controlled_second_customer.verdict}</p>
                          <p className="text-[0.52rem] leading-4 text-[#b84a4a]">• Public launch : {plf.product_sellability_verdict.public_launch.verdict}</p>
                          <p className="text-[0.52rem] leading-4 text-[#8f682d]">• Scale 80k : {plf.product_sellability_verdict.scale_80k.verdict}</p>
                          {plf.phase_7_completion_matrix.map((p) => (<p key={p.phase_id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">◦ {p.phase_id} {p.label} : gate interne {p.internal_gate_ready ? "prêt" : "non"} · preuve réelle non</p>))}
                        </div>
                      ) : null}
                      {showPlfBlockers ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {plf.blocking_conditions.map((b, i) => (<p key={i} className="text-[0.52rem] leading-4 text-[#b84a4a]">✗ {b}</p>))}
                        </div>
                      ) : null}
                      {showPlfProofs ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {plf.external_proof_final_matrix.map((e) => (<p key={e.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">• {e.label} : vérifié non (bloquant)</p>))}
                        </div>
                      ) : null}
                      {showPlfClaims ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {plf.allowed_product_claims.map((c, i) => (<p key={`a${i}`} className="text-[0.52rem] leading-4 text-[var(--cs-success)]">✓ {c}</p>))}
                          {plf.forbidden_product_claims.map((c, i) => (<p key={`f${i}`} className="text-[0.52rem] leading-4 text-[#b84a4a]">✗ {c}</p>))}
                        </div>
                      ) : null}
                      {showPlfActions ? (
                        <div className="mt-1.5 grid gap-0.5">
                          {plf.immediate_operational_actions.map((a) => (<p key={a.id} className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">{a.order}. {a.action}</p>))}
                        </div>
                      ) : null}
                      {showPlfClosure ? (
                        <div className="mt-1.5 grid gap-0.5">
                          <p className="text-[0.52rem] leading-4 text-[#2c6f58]">Phase 7 : {plf.phase_7_closure_verdict.phase_7_status}</p>
                          <p className="text-[0.52rem] leading-4 text-[var(--cs-ink-4)]">Travail interne complet : oui · exécution externe complète : non · aucun autre gate read-only nécessaire : oui</p>
                          <p className="text-[0.52rem] leading-4 text-[#2c6f58]">→ {plf.recommended_next_phase}</p>
                        </div>
                      ) : null}
                    </div>
                  );
                })()}

                {localControlledMissions.length === 0 ? (
                  <p className="mt-2 text-[0.62rem] text-[var(--cs-ink-4)]">
                    Aucune mission contrôlée locale. Prévisualise une promotion puis crée une mission contrôlée locale.
                  </p>
                ) : (
                  <div className="mt-3 grid gap-2">
                    {localControlledMissions.map((mission) => (
                      <div key={mission.id} className="rounded-[1.1rem] border border-white/48 bg-white/18 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[0.72rem] font-semibold text-[var(--cs-ink-1)]">{mission.title}</span>
                          <span className="text-[0.58rem] text-[var(--cs-ink-4)]">{getLocalControlledMissionStatusLabel(mission.status)}</span>
                        </div>

                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {buildLocalControlledMissionBadges(mission).map((badge) => (
                            <span
                              key={badge.id}
                              className={cn(
                                "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.56rem] font-semibold",
                                badge.tone === "success" ? "border-[rgba(21,130,96,0.2)] bg-[rgba(21,130,96,0.07)] text-[var(--cs-success)]"
                                : badge.tone === "danger" ? "border-[#b84a4a]/22 bg-[#b84a4a]/08 text-[#b84a4a]"
                                : badge.tone === "warning" ? "border-[#c99a4d]/22 bg-[#c99a4d]/08 text-[#8f682d]"
                                : badge.tone === "info" ? "border-[#6f83ff]/20 bg-[#6f83ff]/07 text-[#4f63d5]"
                                : "border-white/50 bg-white/22 text-[var(--cs-ink-4)]"
                              )}
                            >
                              {badge.label}
                            </span>
                          ))}
                        </div>

                        <p className="mt-1.5 text-[0.62rem] leading-5 text-[var(--cs-ink-4)]">{mission.summary}</p>

                        <div className="mt-1.5 grid grid-cols-2 gap-2 lg:grid-cols-4">
                          <div><span className="text-[0.52rem] uppercase tracking-[0.08em] text-[var(--cs-ink-4)]">Employé</span><p className="text-[0.6rem] font-semibold text-[var(--cs-ink-2)]">{mission.employee_id ?? "—"}</p></div>
                          <div><span className="text-[0.52rem] uppercase tracking-[0.08em] text-[var(--cs-ink-4)]">Priorité</span><p className="text-[0.6rem] font-semibold text-[var(--cs-ink-2)]">{mission.priority}</p></div>
                          <div><span className="text-[0.52rem] uppercase tracking-[0.08em] text-[var(--cs-ink-4)]">Risque</span><p className="text-[0.6rem] font-semibold text-[var(--cs-ink-2)]">{mission.risk_level}</p></div>
                          <div><span className="text-[0.52rem] uppercase tracking-[0.08em] text-[var(--cs-ink-4)]">MAJ</span><p className="text-[0.6rem] font-semibold text-[var(--cs-ink-2)]">{mission.updated_at.slice(0, 10)}</p></div>
                        </div>

                        {mission.steps.length > 0 ? (
                          <div className="mt-1.5">
                            <p className="text-[0.52rem] uppercase tracking-[0.08em] text-[var(--cs-ink-4)]">Étapes prévues</p>
                            <div className="mt-1 grid gap-0.5">
                              {mission.steps.map((step) => (
                                <p key={step.id} className="text-[0.6rem] leading-4 text-[var(--cs-ink-4)]">• {step.label}</p>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-1.5 grid gap-0.5">
                          {buildControlledMissionUserFacingWarnings(mission).map((w, i) => (
                            <p key={i} className="text-[0.56rem] leading-4 text-[var(--cs-ink-4)]">• {w}</p>
                          ))}
                        </div>

                        {/* ── PHASE 5.2 — Revue / validation humaine LOCALE ──
                            Approbation locale uniquement. Même approuvée, non exécutée. */}
                        {(() => {
                          const reviewState = getControlledMissionReviewState(mission);
                          const checklist = buildControlledMissionReviewChecklist(mission);
                          const canApprove =
                            reviewState.review_status !== "archived_local" &&
                            mission.status !== "blocked_by_guard" &&
                            mission.status !== "blocked_by_missing_information";
                          return (
                            <div className="mt-2 border-t border-white/40 pt-2">
                              <p className="text-[0.56rem] leading-4 text-[var(--cs-ink-4)]">
                                {CONTROLLED_MISSION_REVIEW_MICROCOPY}. {CONTROLLED_MISSION_REVIEW_NO_PIERRE}
                              </p>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {buildControlledMissionReviewBadges(reviewState).map((badge) => (
                                  <span
                                    key={badge.id}
                                    className={cn(
                                      "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.54rem] font-semibold",
                                      badge.tone === "success" ? "border-[rgba(21,130,96,0.2)] bg-[rgba(21,130,96,0.07)] text-[var(--cs-success)]"
                                      : badge.tone === "danger" ? "border-[#b84a4a]/22 bg-[#b84a4a]/08 text-[#b84a4a]"
                                      : badge.tone === "warning" ? "border-[#c99a4d]/22 bg-[#c99a4d]/08 text-[#8f682d]"
                                      : badge.tone === "info" ? "border-[#6f83ff]/20 bg-[#6f83ff]/07 text-[#4f63d5]"
                                      : "border-white/50 bg-white/22 text-[var(--cs-ink-4)]"
                                    )}
                                  >
                                    {badge.label}
                                  </span>
                                ))}
                              </div>
                              <div className="mt-1.5 grid gap-0.5">
                                {checklist.map((item) => (
                                  <p key={item.id} className="text-[0.56rem] leading-4 text-[var(--cs-ink-4)]">
                                    {item.checked ? "✓" : "○"} {item.label}
                                  </p>
                                ))}
                              </div>
                              {reviewState.review_status === "approved_local" ? (
                                <p className="mt-1 text-[0.6rem] font-semibold text-[var(--cs-success)]">
                                  {CONTROLLED_MISSION_REVIEW_APPROVED_MESSAGE}
                                </p>
                              ) : null}
                              <div className="mt-1.5 flex flex-wrap gap-2">
                                <button type="button" onClick={() => handleStartReview(mission.id)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">
                                  {CONTROLLED_MISSION_REVIEW_START_LABEL}
                                </button>
                                <button type="button" onClick={() => handleApproveLocal(mission.id)} disabled={!canApprove} className="clone-liquid-button clone-liquid-button--dark min-h-8 px-3 text-[0.62rem] font-semibold disabled:opacity-50">
                                  {CONTROLLED_MISSION_REVIEW_APPROVE_LABEL}
                                </button>
                                <button type="button" onClick={() => handleRequestChanges(mission.id)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">
                                  {CONTROLLED_MISSION_REVIEW_REQUEST_CHANGES_LABEL}
                                </button>
                                <button type="button" onClick={() => handleBlockLocal(mission.id)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">
                                  {CONTROLLED_MISSION_REVIEW_BLOCK_LABEL}
                                </button>
                              </div>
                            </div>
                          );
                        })()}

                        {/* ── PHASE 5.3 — Preflight / readiness gate LOCALE ──
                            « ready » = candidate future exécution gouvernée, jamais exécution. */}
                        {(() => {
                          const preflightState = getControlledMissionPreflightState(mission);
                          const hasRun = mission.preflight_state !== undefined;
                          const ready = preflightState.preflight_status === "ready_for_future_governed_execution";
                          return (
                            <div className="mt-2 border-t border-white/40 pt-2">
                              <p className="text-[0.56rem] leading-4 text-[var(--cs-ink-4)]">
                                {CONTROLLED_MISSION_PREFLIGHT_MICROCOPY}. {CONTROLLED_MISSION_PREFLIGHT_WHAT_IT_DOES} {CONTROLLED_MISSION_PREFLIGHT_NO_PIERRE}
                              </p>
                              <div className="mt-1 flex flex-wrap gap-2">
                                <button type="button" onClick={() => handleRunPreflight(mission.id)} className="clone-liquid-button clone-liquid-button--dark min-h-8 px-3 text-[0.62rem] font-semibold">
                                  {CONTROLLED_MISSION_PREFLIGHT_RUN_LABEL}
                                </button>
                              </div>
                              {hasRun ? (
                                <div className="mt-1.5 grid gap-1">
                                  <span className="text-[0.6rem] font-semibold text-[var(--cs-ink-2)]">
                                    Readiness {preflightState.readiness_score}% · {getControlledMissionReadinessLevelLabel(preflightState.readiness_level)}
                                  </span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {buildControlledMissionPreflightBadges(preflightState).map((badge) => (
                                      <span
                                        key={badge.id}
                                        className={cn(
                                          "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.54rem] font-semibold",
                                          badge.tone === "success" ? "border-[rgba(21,130,96,0.2)] bg-[rgba(21,130,96,0.07)] text-[var(--cs-success)]"
                                          : badge.tone === "danger" ? "border-[#b84a4a]/22 bg-[#b84a4a]/08 text-[#b84a4a]"
                                          : badge.tone === "warning" ? "border-[#c99a4d]/22 bg-[#c99a4d]/08 text-[#8f682d]"
                                          : badge.tone === "info" ? "border-[#6f83ff]/20 bg-[#6f83ff]/07 text-[#4f63d5]"
                                          : "border-white/50 bg-white/22 text-[var(--cs-ink-4)]"
                                        )}
                                      >
                                        {badge.label}
                                      </span>
                                    ))}
                                  </div>
                                  {ready ? (
                                    <p className="text-[0.6rem] font-semibold text-[var(--cs-success)]">{CONTROLLED_MISSION_PREFLIGHT_READY_MESSAGE}</p>
                                  ) : null}
                                  {preflightState.blocking_reasons.length > 0 ? (
                                    <div className="grid gap-0.5">
                                      {preflightState.blocking_reasons.map((r, i) => (
                                        <p key={i} className="text-[0.56rem] leading-4 text-[#8f682d]">• {r}</p>
                                      ))}
                                    </div>
                                  ) : null}
                                  <div className="grid gap-0.5">
                                    {preflightState.checks.slice(0, 8).map((c) => (
                                      <p key={c.id} className="text-[0.54rem] leading-4 text-[var(--cs-ink-4)]">
                                        {c.status === "pass" ? "✓" : c.status === "warning" ? "!" : "✗"} {c.label}
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        })()}

                        {/* ── PHASE 5.4 — Persistance serveur gouvernée (DESIGN, non actif) ──
                            « Voir le draft serveur » / « Voir prérequis serveur » uniquement.
                            Aucune persistance, aucune donnée envoyée, aucune mission serveur créée. */}
                        {mission.preflight_state !== undefined ? (() => {
                          const serverReadiness = buildControlledMissionServerPersistenceReadiness(mission);
                          const draftOpen = serverDraftViewId === mission.id;
                          const reqOpen = serverReqViewId === mission.id;
                          return (
                            <div className="mt-2 border-t border-white/40 pt-2">
                              <p className="text-[0.56rem] leading-4 text-[var(--cs-ink-4)]">
                                {CONTROLLED_MISSION_SERVER_PERSISTENCE_MICROCOPY}. {CONTROLLED_MISSION_SERVER_PERSISTENCE_WHAT_IT_DOES}
                              </p>
                              <p className="mt-1 rounded-[1rem] border border-[#3f8f74]/18 bg-[#3f8f74]/06 px-3 py-2 text-[0.58rem] leading-4 text-[#2c6f58]">
                                {CONTROLLED_MISSION_SERVER_PERSISTENCE_PANEL_GUARDRAIL} {CONTROLLED_MISSION_SERVER_PERSISTENCE_NO_DATA} {CONTROLLED_MISSION_SERVER_PERSISTENCE_STILL_LOCAL}
                              </p>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {buildControlledMissionServerPersistenceBadges(serverReadiness).map((badge) => (
                                  <span
                                    key={badge.id}
                                    className={cn(
                                      "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.54rem] font-semibold",
                                      badge.tone === "success" ? "border-[rgba(21,130,96,0.2)] bg-[rgba(21,130,96,0.07)] text-[var(--cs-success)]"
                                      : badge.tone === "danger" ? "border-[#b84a4a]/22 bg-[#b84a4a]/08 text-[#b84a4a]"
                                      : badge.tone === "warning" ? "border-[#c99a4d]/22 bg-[#c99a4d]/08 text-[#8f682d]"
                                      : badge.tone === "info" ? "border-[#6f83ff]/20 bg-[#6f83ff]/07 text-[#4f63d5]"
                                      : "border-white/50 bg-white/22 text-[var(--cs-ink-4)]"
                                    )}
                                  >
                                    {badge.label}
                                  </span>
                                ))}
                              </div>
                              <div className="mt-1 grid gap-0.5">
                                {CONTROLLED_MISSION_SERVER_PERSISTENCE_FACTS.map((fact, i) => (
                                  <p key={i} className="text-[0.56rem] leading-4 text-[var(--cs-ink-4)]">• {fact}</p>
                                ))}
                              </div>
                              <div className="mt-1.5 flex flex-wrap gap-2">
                                <button type="button" onClick={() => setServerDraftViewId(draftOpen ? null : mission.id)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">
                                  {CONTROLLED_MISSION_SERVER_PERSISTENCE_VIEW_DRAFT_LABEL}
                                </button>
                                <button type="button" onClick={() => setServerReqViewId(reqOpen ? null : mission.id)} className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold">
                                  {CONTROLLED_MISSION_SERVER_PERSISTENCE_VIEW_REQUIREMENTS_LABEL}
                                </button>
                              </div>
                              {draftOpen ? (
                                <pre className="mt-1 overflow-x-auto rounded-[0.8rem] border border-white/45 bg-white/16 p-2 text-[0.52rem] leading-4 text-[var(--cs-ink-3)]">
                                  {summarizeControlledMissionServerPersistenceDraft(buildGovernedControlledMissionServerDraft(mission))}
                                </pre>
                              ) : null}
                              {reqOpen ? (
                                <div className="mt-1 grid gap-0.5">
                                  {serverReadiness.required_next_steps.map((stepText, i) => (
                                    <p key={i} className="text-[0.54rem] leading-4 text-[var(--cs-ink-4)]">• {stepText}</p>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          );
                        })() : null}

                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => reloadLocalControlledMissions()}
                            className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold"
                          >
                            Relire
                          </button>
                          {mission.status !== "archived_local" ? (
                            <button
                              type="button"
                              onClick={() => handleArchiveLocalControlledMission(mission.id)}
                              className="clone-liquid-button min-h-8 px-3 text-[0.62rem] font-semibold"
                            >
                              Archiver localement
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </LiquidGlass>

          {/* Onglets + Recherche */}
          <LiquidGlass
            variant="panel"
            intensity="strong"
            refractive
            className="rounded-[2.25rem] p-4 md:p-5"
          >
            <div className="grid gap-5">
              {/* Barre de recherche */}
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-h-14 flex-1 items-center gap-3 rounded-full border border-white/55 bg-white/34 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.74),0_18px_46px_rgba(38,32,22,0.06)] backdrop-blur-xl">
                  <Search className="h-4 w-4 shrink-0 text-[#667cff]" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Rechercher une mission, un livrable, une alerte, un briefing…"
                    className="h-12 w-full border-0 bg-transparent text-sm font-semibold text-[var(--cs-ink-1)] outline-none placeholder:text-[var(--cs-ink-4)]"
                  />
                  {query ? (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/50 bg-white/40 text-[var(--cs-ink-3)]"
                      aria-label="Effacer la recherche"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>

              {/* 4 onglets */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {/* Tout */}
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  className={cn(
                    "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition",
                    activeTab === "all"
                      ? "border-white/70 bg-white/62 text-[var(--cs-ink-1)] shadow-[inset_0_1px_0_rgba(255,255,255,0.76),0_12px_30px_rgba(38,32,22,0.06)]"
                      : "border-white/42 bg-white/24 text-[var(--cs-ink-3)]"
                  )}
                >
                  <Inbox className="h-4 w-4" />
                  Tous
                  <span className="rounded-full bg-white/46 px-2 py-0.5 text-xs">
                    {totalVisible}
                  </span>
                </button>

                {CATEGORIES.map((category) => (
                  <TabButton
                    key={category.key}
                    category={category}
                    count={groupedByTab[category.key].length}
                    unread={unreadByTab[category.key]}
                    active={activeTab === category.key}
                    onClick={() => setActiveTab(category.key)}
                  />
                ))}
              </div>

              {/* Description onglet actif */}
              {activeTab !== "all" ? (
                <p className="text-xs leading-5 text-[var(--cs-ink-4)]">
                  {CATEGORIES.find((c) => c.key === activeTab)?.description}
                </p>
              ) : (
                <p className="text-xs leading-5 text-[var(--cs-ink-4)]">
                  Tous les messages opérationnels — Suivis · Briefings · Livraisons · Alertes.
                  Lecture seule — aucune action exécutée depuis la messagerie.
                </p>
              )}
            </div>
          </LiquidGlass>

          {/* Liste + Détail */}
          <section className="grid gap-5 xl:grid-cols-2">
            {/* Colonne liste */}
            <LiquidGlass
              variant="panel"
              intensity="medium"
              className="min-h-[680px] rounded-[2rem] p-4"
            >
              <div className="flex items-center justify-between gap-3 px-1 pb-4">
                <div>
                  <p className="cs-eyebrow">
                    {activeTab === "all"
                      ? "Tous les messages"
                      : CATEGORIES.find((c) => c.key === activeTab)?.eyebrow ?? "Messages"}
                  </p>
                  <p className="mt-2 text-lg font-semibold tracking-[-0.04em] text-[var(--cs-ink-1)]">
                    {visibleMessages.length} élément{visibleMessages.length !== 1 ? "s" : ""}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={restoreArchived}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-white/50 bg-white/34 px-4 text-xs font-semibold text-[var(--cs-ink-3)] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-xl"
                >
                  <Filter className="h-3.5 w-3.5" />
                  Réinitialiser
                </button>
              </div>

              {authState === "checking" || authState === "unauthenticated" || loading ? (
                <div className="grid min-h-[420px] place-items-center">
                  <div className="flex items-center gap-3 text-[var(--cs-ink-3)]">
                    <Loader2 className="h-5 w-5 animate-spin text-[#667cff]" />
                    <span className="text-sm font-medium">Chargement des messages…</span>
                  </div>
                </div>
              ) : visibleMessages.length === 0 ? (
                (() => {
                  const cat = CATEGORIES.find((c) => c.key === activeTab);
                  return (
                    <EmptyState
                      title={cat?.emptyTitle ?? "Aucun message dans cette vue"}
                      text={cat?.emptyText ?? "Change d'onglet ou efface la recherche."}
                      icon={cat ? <cat.icon className="h-6 w-6" /> : <Inbox className="h-6 w-6" />}
                    />
                  );
                })()
              ) : (
                <div className="grid gap-3">
                  {visibleMessages.map((message) => {
                    const selected = selectedMessage?.id === message.id;
                    const unread = !readIds.includes(message.id);
                    const pinned = pinnedIds.includes(message.id);
                    const isAlert =
                      message.tab === "alertes" &&
                      (message.priority === "critical" ||
                        message.status === "waiting_validation");

                    return (
                      <button
                        key={message.id}
                        type="button"
                        onClick={() => {
                          setSelectedId(message.id);
                          markRead(message.id);
                        }}
                        className={cn(
                          "group rounded-[1.55rem] border p-4 text-left transition",
                          selected
                            ? "border-white/72 bg-white/58 shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_18px_48px_rgba(38,32,22,0.08)]"
                            : "border-white/42 bg-white/24 hover:border-white/62 hover:bg-white/38",
                          isAlert && !selected && "border-[#b84a4a]/18"
                        )}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              {unread ? (
                                <span className="h-2.5 w-2.5 rounded-full bg-[#667cff] shadow-[0_0_18px_rgba(102,124,255,0.55)]" />
                              ) : null}
                              {pinned ? (
                                <Pin className="h-3.5 w-3.5 text-[#c99a4d]" />
                              ) : null}
                              <span
                                className={cn(
                                  "rounded-full border px-2.5 py-1 text-[0.68rem] font-bold",
                                  tabTone(message.tab)
                                )}
                              >
                                {CATEGORIES.find((c) => c.key === message.tab)?.shortLabel ?? message.tab}
                              </span>
                              <span
                                className={cn(
                                  "rounded-full border px-2.5 py-1 text-[0.68rem] font-bold",
                                  priorityTone(message.priority)
                                )}
                              >
                                {priorityLabel(message.priority)}
                              </span>
                              <span
                                className={cn(
                                  "rounded-full border px-2.5 py-1 text-[0.68rem] font-bold",
                                  statusTone(message.status)
                                )}
                              >
                                {statusLabel(message.status)}
                              </span>
                            </div>

                            <p className="mt-3 line-clamp-2 text-base font-semibold tracking-[-0.04em] text-[var(--cs-ink-1)]">
                              {message.title}
                            </p>

                            <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--cs-ink-3)]">
                              {message.summary}
                            </p>
                          </div>

                          <div className="shrink-0 text-right">
                            <p className="text-xs font-semibold text-[var(--cs-ink-4)]">
                              {formatDate(message.updatedAt)}
                            </p>
                            <p className="mt-2 text-xs font-bold text-[#667cff]">
                              {message.source}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {message.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full border border-white/50 bg-white/28 px-2.5 py-1 text-[0.66rem] font-bold text-[var(--cs-ink-4)]"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </LiquidGlass>

            {/* Colonne détail */}
            <LiquidGlass
              variant="panel"
              intensity="strong"
              refractive
              className="min-h-[680px] rounded-[2rem] p-5 md:p-6"
            >
              {!selectedMessage ? (
                <EmptyState
                  title="Sélectionnez un message"
                  text="Le détail opérationnel apparaîtra ici avec ses sources, ses employés, ses tags et ses livrables."
                  icon={<MessagesSquare className="h-6 w-6" />}
                />
              ) : (
                <div className="flex h-full flex-col gap-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-bold",
                            tabTone(selectedMessage.tab)
                          )}
                        >
                          {CATEGORIES.find((c) => c.key === selectedMessage.tab)?.label ?? selectedMessage.tab}
                        </span>
                        <span
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-bold",
                            priorityTone(selectedMessage.priority)
                          )}
                        >
                          {priorityLabel(selectedMessage.priority)}
                        </span>
                        <span
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-bold",
                            statusTone(selectedMessage.status)
                          )}
                        >
                          {statusLabel(selectedMessage.status)}
                        </span>
                      </div>

                      <h2 className="cs-heading mt-4 text-[clamp(1.65rem,2.8vw,3.05rem)] leading-[0.98]">
                        {selectedMessage.title}
                      </h2>

                      <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--cs-ink-3)]">
                        {selectedMessage.summary}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => togglePinned(selectedMessage.id)}
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/55 bg-white/34 text-[var(--cs-ink-2)] shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_14px_34px_rgba(38,32,22,0.08)] backdrop-blur-xl"
                      aria-label={
                        pinnedIds.includes(selectedMessage.id)
                          ? "Retirer l'épingle"
                          : "Épingler"
                      }
                    >
                      {pinnedIds.includes(selectedMessage.id) ? (
                        <PinOff className="h-4 w-4" />
                      ) : (
                        <Pin className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {/* Métadonnées */}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <LiquidGlass variant="clear" intensity="soft" className="rounded-[1.35rem] p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--cs-ink-4)]">
                        Source
                      </p>
                      <p className="mt-2 text-sm font-semibold text-[var(--cs-ink-1)]">
                        {selectedMessage.source}
                      </p>
                    </LiquidGlass>

                    <LiquidGlass variant="clear" intensity="soft" className="rounded-[1.35rem] p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--cs-ink-4)]">
                        Mise à jour
                      </p>
                      <p className="mt-2 text-sm font-semibold text-[var(--cs-ink-1)]">
                        {formatDate(selectedMessage.updatedAt)}
                      </p>
                    </LiquidGlass>

                    <LiquidGlass variant="clear" intensity="soft" className="rounded-[1.35rem] p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--cs-ink-4)]">
                        Échéance
                      </p>
                      <p className="mt-2 text-sm font-semibold text-[var(--cs-ink-1)]">
                        {formatDate(selectedMessage.dueAt)}
                      </p>
                    </LiquidGlass>
                  </div>

                  {/* Corps */}
                  <LiquidGlass variant="clear" intensity="soft" className="rounded-[1.65rem] p-5">
                    <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                      Détail opérationnel
                    </p>
                    <p className="mt-3 text-sm leading-7 text-[var(--cs-ink-3)]">
                      {selectedMessage.body}
                    </p>
                  </LiquidGlass>

                  {/* Mention Guard/CloneTrace si applicable */}
                  {selectedMessage.guardDecision ? (
                    <div className="flex items-start gap-3 rounded-[1.1rem] border border-[#b84a4a]/20 bg-[#b84a4a]/07 p-3">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#b84a4a]" />
                      <div>
                        <p className="text-xs font-bold text-[#b84a4a]">
                          CloneGuard — décision : {selectedMessage.guardDecision}
                        </p>
                        <p className="mt-1 text-[0.68rem] leading-5 text-[#b84a4a]/80">
                          Validation humaine nécessaire avant toute exécution.
                          Aucun employé IA ne peut agir seul.
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {selectedMessage.cloneOSStatus === "refused" || selectedMessage.cloneOSStatus === "blocked" ? (
                    <div className="flex items-start gap-3 rounded-[1.1rem] border border-[#b84a4a]/20 bg-[#b84a4a]/07 p-3">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#b84a4a]" />
                      <p className="text-[0.68rem] leading-5 text-[#b84a4a]">
                        CloneOS status : {selectedMessage.cloneOSStatus}.
                        {selectedMessage.cloneOSStatus === "refused"
                          ? " Invariant absolu — paie officielle, licenciement, décision légale, signature de contrat."
                          : " Aucun employé IA actif disponible pour ce domaine."}
                      </p>
                    </div>
                  ) : null}

                  {/* Employés + Livrables */}
                  <div className="grid gap-4 lg:grid-cols-2">
                    <LiquidGlass variant="clear" intensity="soft" className="rounded-[1.65rem] p-5">
                      <div className="flex items-center gap-2">
                        <BriefcaseBusiness className="h-4 w-4 text-[#667cff]" />
                        <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                          Employés concernés
                        </p>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {selectedMessage.employees.map((employee) => (
                          <span
                            key={employee}
                            className="rounded-full border border-white/55 bg-white/38 px-3 py-1.5 text-xs font-bold text-[var(--cs-ink-2)]"
                          >
                            {employee}
                          </span>
                        ))}
                      </div>
                    </LiquidGlass>

                    <LiquidGlass variant="clear" intensity="soft" className="rounded-[1.65rem] p-5">
                      <div className="flex items-center gap-2">
                        <FileCheck2 className="h-4 w-4 text-[#667cff]" />
                        <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                          Livrables / traces
                        </p>
                      </div>
                      <div className="mt-4 grid gap-2">
                        {(selectedMessage.deliverables ?? []).length === 0 ? (
                          <p className="text-xs text-[var(--cs-ink-4)]">Aucun livrable.</p>
                        ) : (
                          (selectedMessage.deliverables ?? []).map((deliverable) => (
                            <div
                              key={deliverable}
                              className="flex items-center gap-2 rounded-[1rem] border border-white/50 bg-white/30 px-3 py-2 text-xs font-semibold text-[var(--cs-ink-2)]"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--cs-success)]" />
                              {deliverable}
                            </div>
                          ))
                        )}
                      </div>
                    </LiquidGlass>
                  </div>

                  {/* Tags */}
                  <LiquidGlass variant="clear" intensity="soft" className="rounded-[1.65rem] p-5">
                    <div className="flex items-center gap-2">
                      <CalendarClock className="h-4 w-4 text-[#667cff]" />
                      <p className="text-sm font-semibold text-[var(--cs-ink-1)]">
                        Tags opérationnels
                      </p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {selectedMessage.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-white/55 bg-white/32 px-3 py-1.5 text-xs font-bold text-[var(--cs-ink-3)]"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </LiquidGlass>

                  {/* Avertissement lecture seule */}
                  <div className="flex items-center gap-2 rounded-[1.1rem] border border-white/45 bg-white/22 px-4 py-3">
                    <FileText className="h-4 w-4 shrink-0 text-[var(--cs-ink-4)]" />
                    <p className="text-xs leading-5 text-[var(--cs-ink-4)]">
                      Lecture seule — aucune action exécutée depuis la messagerie.
                      Utilisez le cockpit Pierre pour agir.
                    </p>
                  </div>

                  {/* CTA */}
                  <div className="mt-auto flex flex-wrap gap-2">
                    {selectedMessage.actions.map((action) => (
                      action.readOnly ? (
                        <ActionButton
                          key={action.label}
                          disabled
                          icon={<FileText className="h-4 w-4" />}
                        >
                          {action.label}
                        </ActionButton>
                      ) : (
                        <ActionButton
                          key={action.label}
                          href={action.href}
                          primary={action.tone === "primary"}
                          danger={action.tone === "danger"}
                          icon={<ArrowRight className="h-4 w-4" />}
                        >
                          {action.label}
                        </ActionButton>
                      )
                    ))}

                    <ActionButton
                      onClick={() => markRead(selectedMessage.id)}
                      icon={<CheckCircle2 className="h-4 w-4" />}
                    >
                      Marquer comme lu
                    </ActionButton>

                    <ActionButton
                      onClick={() => archiveMessage(selectedMessage.id)}
                      icon={<Inbox className="h-4 w-4" />}
                    >
                      Archiver
                    </ActionButton>
                  </div>
                </div>
              )}
            </LiquidGlass>
          </section>

          {/* Bannière connexion */}
          {!userId && authReady ? (
            <LiquidGlass variant="clear" intensity="soft" className="rounded-[1.55rem] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <LockKeyhole className="mt-0.5 h-4 w-4 text-[#667cff]" />
                  <p className="text-sm leading-6 text-[var(--cs-ink-3)]">
                    Connectez-vous pour relier cette messagerie aux vrais employés IA,
                    aux missions et à l'historique du compte.
                  </p>
                </div>
                <div className="flex gap-2">
                  <ActionButton href="/login">Connexion</ActionButton>
                  <ActionButton href="/signup" primary>
                    Créer un compte
                  </ActionButton>
                </div>
              </div>
            </LiquidGlass>
          ) : null}
        </div>
      </div>
    </main>
  );
}
