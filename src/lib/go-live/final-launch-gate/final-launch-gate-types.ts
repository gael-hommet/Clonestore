// src/lib/go-live/final-launch-gate/final-launch-gate-types.ts
// GO-LIVE 10 — Final Launch Gate type definitions.
// Pure types — no side effects, no API calls.

export type BlockerStatus =
  | "ready"
  | "partial_ready"
  | "pending"
  | "blocked";

export type BlockerSeverity =
  | "info"
  | "warning"
  | "blocker";

export type BlockerOwner =
  | "repo"
  | "gael"
  | "legal"
  | "stripe"
  | "supabase"
  | "mixed";

export type FinalLaunchGlobalStatus =
  | "public_no_go"
  | "private_demo_ready"
  | "public_ready";

export interface FinalLaunchBlocker {
  id: string;
  title: string;
  description: string;
  status: BlockerStatus;
  severity: BlockerSeverity;
  owner: BlockerOwner;
  evidence_ref?: string;
  next_action: string;
  can_be_done_now: boolean;
  blocks_public_launch: boolean;
  human_label: string;
}

export interface FinalLaunchGateVerdict {
  global_status: FinalLaunchGlobalStatus;
  public_launch_allowed: boolean;
  private_demo_allowed: boolean;
  paid_customer_allowed: boolean;
  blockers_count: number;
  pending_count: number;
  ready_count: number;
  critical_blockers: string[];
  next_actions: string[];
  summary: string;
  safe_message: string;
}

export type ProofType =
  | "staging_test"
  | "production_live"
  | "human_legal"
  | "repo_tooling";

export interface FinalLaunchProofEntry {
  proof_id: string;
  blocker_id: string;
  description: string;
  proof_type: ProofType;
  auto_verifiable: boolean;
}
