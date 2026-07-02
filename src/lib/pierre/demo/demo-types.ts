// src/lib/pierre/demo/demo-types.ts
// PIERRE FINAL INTERACTIVE DEMO — type model for the controlled, deterministic
// conversion experience served at /demo/pierre.
//
// SAFETY: this is a *simulation* layer. No type here represents a real side
// effect. Every capability shown on screen must be backed by an entry in the
// truth registry (see demo-truth-registry.ts) so the UI can never claim a
// capability the product does not actually have at the declared status.

/** Production truth of a demonstrated capability. */
export type ProductionStatus =
  | "available" // shipped, usable today
  | "available_with_validation" // shipped, but gated behind explicit human validation
  | "prepared_not_executed" // produced/prepared in product, execution deferred to a human/step
  | "demo_only"; // shown for narrative only; NOT a live production capability

export interface DemoCapabilityTruth {
  id: string;
  label: string;
  productionStatus: ProductionStatus;
  /** Honest one-line disclosure shown (or available) in the UI. */
  demoDisclosure: string;
  /** Optional pointer to real code/tests that back the status. */
  evidencePath?: string;
}

/** A CloneStore technology surfaced "while it acts", never as an abstract catalog. */
export interface DemoTechnology {
  id:
    | "cloneos"
    | "cloneadn"
    | "cloneguard"
    | "clonetrust"
    | "clonecontinuum"
    | "clonetrace";
  name: string;
  /** Human-language explanation (no jargon). */
  role: string;
  /** Visual temperature in the scoped palette. */
  accent: "warm" | "cool" | "neutral";
}

/** Status of a mission / task in the controlled board. */
export type WorkStatus =
  | "done"
  | "in_progress"
  | "waiting_info"
  | "awaiting_validation"
  | "scheduled"
  | "blocked";

export type Actor =
  | "Dirigeant"
  | "Pierre"
  | "CloneADN"
  | "CloneGuard"
  | "CloneTrust"
  | "CloneContinuum"
  | "CloneTrace";

export type AutonomyLevel = "autonome" | "validation_requise" | "bloquee";

export interface DemoTask {
  id: string;
  label: string;
  status: WorkStatus;
  owner: Actor;
  /** Capability registry id this task exercises (must be declared). */
  capabilityId: string;
  detail?: string;
}

export interface DemoMission {
  id: string;
  title: string;
  owner: string;
  priority: "haute" | "normale" | "basse";
  dueLabel: string;
  status: WorkStatus;
  autonomy: AutonomyLevel;
  tasks: DemoTask[];
  /** Optional human-readable dependency note. */
  dependsOn?: string;
}

export type DocumentBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "meta"; rows: { label: string; value: string }[] };

export interface DemoDocument {
  id: string;
  /** e.g. "avenant", "offre", "checklist", "email", "grille", "brief". */
  kind: string;
  title: string;
  subtitle?: string;
  /** Honest badge, e.g. "Brouillon — validation requise". */
  badge: string;
  capabilityId: string;
  blocks: DocumentBlock[];
  /** Footer disclosure (honest framing). */
  disclosure: string;
}

export type MessageActionKind = "validate" | "view_document" | "request_change" | "neutral";

export interface DemoMessageAction {
  id: string;
  label: string;
  kind: MessageActionKind;
  /** Optional document id this action opens. */
  documentId?: string;
}

export interface DemoMessage {
  id: string;
  from: "Pierre" | "Dirigeant";
  /** Optional bold lead line. */
  title?: string;
  /** Body rendered as discrete lines (no free-form HTML). */
  lines: string[];
  actions?: DemoMessageAction[];
  capabilityId: string;
}

export type TraceCategory =
  | "mission"
  | "context"
  | "action"
  | "document"
  | "message"
  | "validation"
  | "blocage";

export interface DemoTraceEntry {
  time: string;
  label: string;
  actor: Actor;
  category: TraceCategory;
  tone: "ok" | "warn" | "block" | "info";
}

export interface CompanyContext {
  /** Title for the focused subject (e.g. the arriving employee). */
  subject: string;
  rows: { label: string; value: string }[];
  /** Information Pierre does NOT have — never invented. */
  missing: string[];
}

/** Counts Pierre extracts from the free request — the first "wow". */
export interface MissionUnderstanding {
  objectifs: number;
  taches: number;
  echeances: number;
  personnes: number;
  validations: number;
  informationsManquantes: number;
}

/** Sensitive-request guardrail moment. */
export interface DemoGuardrail {
  prompt: string;
  intro: string;
  canDo: string[];
  cannotReason: string;
  capabilityId: string;
}

/** Final, scenario-derived proof block (computed, never invented). */
export interface MissionMetrics {
  demande: number;
  missions: number;
  taches: number;
  documents: number;
  communications: number;
  validations: number;
  suivis: number;
  blocages: number;
  /** Always 0 — Pierre never invents information. */
  informationsInventees: number;
}

/**
 * One of the several dispersed requests that land at the start of the week.
 * Purely presentational (cockpit "Entrées" zone) — never validated as a
 * capability, never a real side effect.
 */
export interface DemoIncomingRequest {
  id: string;
  /** Who/what the request comes from, e.g. "Claire Dubois — manager". */
  from: string;
  channel: "message" | "email" | "note" | "rh";
  /** The raw, human request as it actually arrives (short). */
  text: string;
  urgency: "haute" | "normale";
  /** Mission this request feeds into, if any (ties the story together). */
  missionId?: string;
}

/**
 * A later-in-the-week continuity beat: relance, wait, resume, deadline.
 * Proves the mission stays alive over days — the anti-ChatGPT moment.
 */
export interface DemoWeekEvent {
  id: string;
  /** Human day label, e.g. "Mercredi". */
  day: string;
  time: string;
  label: string;
  detail?: string;
  actor: Actor;
  tone: "ok" | "warn" | "block" | "info";
  kind: "relance" | "attente" | "reprise" | "echeance" | "signal";
}

/** How Pierre's work splits from the human's — the reassurance frontier. */
export interface RoleSplit {
  pierre: string[];
  humans: string[];
}

export interface DemoScenario {
  id: string;
  name: string;
  /** Short promise (one idea). */
  promise: string;
  /** Tag line for the selector card. */
  sublabel: string;
  recommended?: boolean;
  /** The natural-language mission a director types. */
  request: string;
  understanding: MissionUnderstanding;
  context: CompanyContext;
  missions: DemoMission[];
  documents: DemoDocument[];
  messages: DemoMessage[];
  trace: DemoTraceEntry[];
  guardrail: DemoGuardrail;
  /** Capability ids referenced anywhere in this scenario (for validation). */
  capabilityIds: string[];

  // ── Cockpit-only presentational extensions (optional, never validated) ──
  /** Top-bar clock label, e.g. "Lundi · 08 h 42". */
  clockLabel?: string;
  /** The dispersed requests that arrive at the start of the week. */
  incoming?: DemoIncomingRequest[];
  /** Later-in-the-week continuity beats (relances, reprises, échéances). */
  week?: DemoWeekEvent[];
  /** Explicit Pierre-vs-human split for the closing reassurance block. */
  roleSplit?: RoleSplit;
}

/** Ordered phases of the interactive cockpit (distinct from GUIDED_STEPS). */
export type CockpitPhaseId =
  | "reception"
  | "analyse"
  | "organisation"
  | "execution"
  | "validation"
  | "continuite"
  | "bilan";

export interface CockpitPhase {
  id: CockpitPhaseId;
  title: string;
  /** One-line caption for the top bar. */
  caption: string;
  /** The prospect's question this phase answers. */
  question: string;
  /** Which cockpit zone(s) this phase puts the spotlight on. */
  focus: ("left" | "center" | "right")[];
  /** Optional analytics event emitted when the phase becomes active. */
  analyticsLabel: string;
}

/** Ordered stages of the guided journey. */
export type GuidedStepKind =
  | "composer"
  | "understanding"
  | "context"
  | "technology"
  | "mission_control"
  | "messaging"
  | "document"
  | "approval"
  | "guardrail"
  | "trace"
  | "result";

export interface GuidedStep {
  id: GuidedStepKind;
  title: string;
  /** Short caption shown under the title. */
  caption: string;
  /** Privacy-safe analytics label (no free text from users). */
  analyticsLabel: string;
}
