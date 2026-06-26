// TECH-11 — Technology Readiness Final Gate — Types
// Consolidation de TECH-01 → TECH-10.
// Ce module est la couche de verdict final du socle technologique CloneStore.
// Pure types: no async, no Supabase, no Next.js, no side effects.

import type { GlobalTechnologyKey } from "../technologies/global-tech-config";

// ── Statuts ───────────────────────────────────────────────────────────────────

/**
 * Statut de readiness d'une technologie ou d'un check.
 */
export type TechnologyReadinessStatus =
  | "ready"           // Implémentée, testée, fonctionnelle
  | "partial"         // Partiellement implémentée
  | "blocked"         // Bloquée — dépendance ou prérequis manquant
  | "roadmap"         // Sur roadmap — déclarée mais non implémentée
  | "not_applicable"; // Non applicable dans ce contexte

/**
 * Verdict global de readiness.
 */
export type TechnologyReadinessVerdict =
  | "technology_foundation_ready"   // Socle tech complet côté repo
  | "technology_foundation_partial" // Socle tech partiellement complet
  | "technology_foundation_blocked" // Socle tech bloqué par problème interne
  | "public_launch_blocked_external"; // Socle prêt, lancement bloqué par facteurs externes

/**
 * Domaine d'évaluation.
 */
export type TechnologyReadinessArea =
  | "global_technology_config"  // TECH-03 GlobalTechnologyConfig
  | "employee_runtime_contract" // TECH-02 EmployeeRuntimeContract
  | "cloneadn"                  // TECH-05
  | "cloneguard"                // TECH-06
  | "clonetrace"                // TECH-07
  | "cloneos"                   // TECH-08
  | "clonebrief"                // TECH-09
  | "clonevoice"                // TECH-10
  | "pierre_bridge"             // Pont Pierre → technologies globales
  | "public_launch_external";   // Facteurs externes lancement public

/**
 * Sévérité d'un check ou d'un bloqueur.
 */
export type TechnologyReadinessSeverity =
  | "info"
  | "warning"
  | "risk"
  | "blocking";

/**
 * Type de bloqueur.
 */
export type TechnologyReadinessBlockerType =
  | "internal_technology"  // Problème interne à la technologie
  | "product_gap"          // Gap produit — feature manquante
  | "external_launch"      // Bloqueur externe au repo
  | "legal"                // Validation légale manquante
  | "payment"              // Paiement live manquant
  | "security"             // Revue sécurité manquante
  | "data"                 // Infrastructure données manquante
  | "operational";         // Opérationnel manquant

/**
 * Statut d'un check individuel.
 */
export type TechnologyReadinessCheckStatus =
  | "pass"
  | "fail"
  | "warning"
  | "skip"
  | "not_applicable";

// ── Checks ────────────────────────────────────────────────────────────────────

/**
 * Un check individuel de readiness.
 */
export interface TechnologyReadinessCheck {
  check_id: string;
  area: TechnologyReadinessArea;
  label: string;
  description: string;
  status: TechnologyReadinessCheckStatus;
  severity: TechnologyReadinessSeverity;
  detail?: string;
  tech_ref?: GlobalTechnologyKey;
}

// ── Résultats par technologie ─────────────────────────────────────────────────

/**
 * Résultat de readiness pour une technologie spécifique.
 */
export interface TechnologyReadinessTechnologyResult {
  key: GlobalTechnologyKey;
  display_name: string;
  status: TechnologyReadinessStatus;
  readiness_score: number;            // 0-100 (depuis GlobalTechnologyConfig)
  is_implemented: boolean;
  is_tested: boolean;
  is_global_layer: boolean;           // true = couche globale TECH-05+
  required_for_employee_runtime: boolean;
  required_for_public_launch: boolean;
  tech_docs_created: boolean;         // TECH-XX documentation créée
  checks: TechnologyReadinessCheck[];
  notes: string[];
}

/**
 * Résultat de readiness pour un employé IA.
 */
export interface TechnologyReadinessEmployeeResult {
  employee_slug: string;
  display_name: string;
  status: TechnologyReadinessStatus;
  is_registered: boolean;
  is_active: boolean;
  launch_stage: string;
  required_technologies_covered: boolean;
  hard_required_tech_slugs: string[];
  missing_tech_slugs: string[];
  critical_permissions_false: boolean;  // legal_decision, payroll_execution, etc.
  bridge_coverage: {
    adn_bridge: boolean;
    guard_bridge: boolean;
    trace_bridge: boolean;
    cloneos_bridge: boolean;
    brief_bridge: boolean;
    voice_bridge_readiness: boolean;
  };
  product_runtime_ready: boolean;
  public_launch_ready: false;  // Toujours false — external blockers
  checks: TechnologyReadinessCheck[];
  notes: string[];
}

/**
 * Résultat de vérification d'un invariant.
 */
export interface TechnologyReadinessInvariantResult {
  invariant_id: string;
  area: TechnologyReadinessArea;
  label: string;
  description: string;
  status: TechnologyReadinessCheckStatus;
  is_absolute: boolean;  // true = violation = report bloqué
  detail?: string;
}

/**
 * Bloqueur externe au lancement public.
 * Ces bloqueurs n'affectent pas la readiness technique — ils bloquent uniquement `public_launch_ready`.
 */
export interface TechnologyReadinessExternalBlocker {
  blocker_id: string;
  label: string;
  description: string;
  type: TechnologyReadinessBlockerType;
  severity: "blocking";  // Tous les blockers externes sont bloquants pour public launch
  affects_technology_readiness: false;  // N'affecte pas la readiness technique
  affects_public_launch: true;          // Bloque toujours le lancement public
  resolution_hint: string;
}

// ── Rapport principal ─────────────────────────────────────────────────────────

/**
 * Rapport complet de readiness technologique — TECH-11.
 *
 * Distinction clé :
 * - `platform_technology_foundation_ready` = true si TECH-01 → TECH-10 sont OK côté repo
 * - `public_launch_ready` = false tant que les blockers externes ne sont pas levés
 * - `technology_runtime_ready` = true/partial selon l'état opérationnel des technologies
 * - `pierre_product_ready` = true côté repo, mais ne déclenche pas `public_launch_ready`
 */
export interface TechnologyReadinessReport {
  report_id: string;
  generated_at: string;

  // ── Verdicts distincts ────────────────────────────────────────────────────
  technology_runtime_ready: boolean;         // Technologies opérationnelles dans le repo
  platform_technology_foundation_ready: boolean; // Socle TECH-01→TECH-10 complet
  pierre_product_ready: boolean;             // Pierre fonctionnel côté repo
  public_launch_ready: false;                // TOUJOURS false — blockers externes

  overall_verdict: TechnologyReadinessVerdict;
  overall_score: number;  // 0-100

  // ── Détail par couche ─────────────────────────────────────────────────────
  technologies: TechnologyReadinessTechnologyResult[];
  employees: TechnologyReadinessEmployeeResult[];
  invariants: TechnologyReadinessInvariantResult[];

  // ── Bloqueurs ─────────────────────────────────────────────────────────────
  external_blockers: TechnologyReadinessExternalBlocker[];
  internal_blockers: string[];

  // ── Divers ────────────────────────────────────────────────────────────────
  warnings: string[];
  next_steps: string[];

  // ── Références ────────────────────────────────────────────────────────────
  source_docs: string[];   // TECH-XX.md fichiers référencés
  source_modules: string[]; // Modules src/ référencés
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

/**
 * Snapshot condensé du rapport de readiness.
 */
export interface TechnologyReadinessSnapshot {
  total_technologies: number;
  ready_count: number;
  partial_count: number;
  roadmap_count: number;
  blocked_count: number;
  invariant_count: number;
  invariant_passed_count: number;
  internal_blockers_count: number;
  external_blockers_count: number;
  public_launch_ready: false;   // Toujours false
  foundation_ready: boolean;
  pierre_ready: boolean;
  overall_score: number;
  generated_at: string;
}

// ── Validation ────────────────────────────────────────────────────────────────

export interface TechnologyReadinessValidationIssue {
  code: string;
  field: string;
  message: string;
  severity: "error" | "warning" | "info";
}

export interface TechnologyReadinessValidationReport {
  ok: boolean;
  errors: TechnologyReadinessValidationIssue[];
  warnings: TechnologyReadinessValidationIssue[];
  checked_at: string;
}
