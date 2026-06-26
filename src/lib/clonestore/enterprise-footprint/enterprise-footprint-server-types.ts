// src/lib/clonestore/enterprise-footprint/enterprise-footprint-server-types.ts
// PHASE 3.13 — Enterprise Footprint Server Persistence Design — Types Serveur
//
// Types de la couche persistence serveur de l'Empreinte Entreprise.
//
// INVARIANTS :
//   - pas d'import Supabase client ici
//   - pas de write
//   - pas de service role
//   - pas d'import Pierre
//   - types purs utilisables côté client et serveur

import type { EnterpriseFootprint } from "./enterprise-footprint-types";

// ── Statut serveur ────────────────────────────────────────────────────────────

export type EnterpriseFootprintServerStatus =
  | "draft"        // brouillon initial
  | "ready"        // empreinte prête
  | "incomplete"   // données manquantes
  | "needs_review" // incohérences détectées
  | "archived";    // archivée, non modifiable

export type EnterpriseFootprintServerSource =
  | "local_snapshot"    // depuis snapshot localStorage
  | "onboarding_draft"  // depuis draft onboarding persisté
  | "server"            // depuis la table serveur directement
  | "cloneadn"          // depuis GlobalEnterpriseMemory
  | "demo";             // données fictives

export type EnterpriseFootprintServerPersistenceMode =
  | "localstorage_only" // snapshot local uniquement (défaut PHASE 3.13)
  | "server_draft"      // schéma SQL prêt, non appliqué
  | "server_active";    // persistence serveur activée (PHASE 3.14+)

// ── Row DB ────────────────────────────────────────────────────────────────────
// Représentation exacte d'une ligne dans clonestore_enterprise_footprints.

export type EnterpriseFootprintServerRow = {
  id: string;                           // uuid pk
  user_id: string;                      // ref auth.users
  company_id: string;                   // identifiant entreprise
  status: EnterpriseFootprintServerStatus;
  source: EnterpriseFootprintServerSource;
  company_json: Record<string, unknown>;
  humans_json: unknown[];
  approval_rules_json: unknown[];
  documents_json: unknown[];
  technologies_json: unknown[];
  cloneadn_summary_json: Record<string, unknown>;
  coverage_score: number;               // 0–100
  readiness_score: number;              // 0–100
  missing_items_json: string[];
  warnings_json: string[];
  metadata: Record<string, unknown>;
  last_local_updated_at: string | null; // ISO timestamptz
  server_version: number;               // default 1
  created_at: string;                   // ISO timestamptz
  updated_at: string;                   // ISO timestamptz
};

// ── Payload pour insertion / mise à jour ──────────────────────────────────────

export type EnterpriseFootprintServerPayload = {
  user_id: string;
  company_id: string;
  footprint: EnterpriseFootprint;
  source: EnterpriseFootprintServerSource;
  local_updated_at: string | null;
  metadata?: Record<string, unknown>;
};

// ── Résultats read / write ────────────────────────────────────────────────────

export type EnterpriseFootprintServerReadResult = {
  rows: EnterpriseFootprintServerRow[];
  latest: EnterpriseFootprintServerRow | null;
  count: number;
  ok: boolean;
  error_code: string | null;
  error_message: string | null;
};

export type EnterpriseFootprintServerWriteResult = {
  ok: boolean;
  row_id: string | null;
  server_version: number | null;
  error_code: string | null;
  error_message: string | null;
  skipped: boolean;
  skip_reason: string | null;
};

// ── Health / table readiness ──────────────────────────────────────────────────

export type EnterpriseFootprintServerHealth = {
  table_available: boolean;
  rls_select_ok: boolean;
  can_attempt_write: boolean;
  error_code: string | null;
  error_message: string | null;
  warnings: string[];
  checked_at: string;
};

// ── Synchronisation localStorage ↔ serveur ────────────────────────────────────

export type EnterpriseFootprintServerSyncDirection =
  | "local_to_server"  // localStorage → DB
  | "server_to_local"  // DB → localStorage
  | "no_sync_needed"   // les deux sont identiques
  | "conflict";        // les deux ont des mises à jour concurrentes

export type EnterpriseFootprintServerSyncPlan = {
  direction: EnterpriseFootprintServerSyncDirection;
  local_updated_at: string | null;
  server_updated_at: string | null;
  local_version: number | null;
  server_version: number | null;
  recommended_action: string;
  safe_to_proceed: boolean;
};

export type EnterpriseFootprintServerConflictResolution =
  | "local_wins"       // localStorage gagne (plus récent)
  | "server_wins"      // serveur gagne (plus récent)
  | "manual_required"  // conflit à résoudre manuellement
  | "no_conflict";     // pas de conflit
