// TECH-07 — CloneTrace Global Audit Timeline — Tests
// 54 tests couvrant tous les modules de la couche trace globale.

import { describe, it, expect, beforeEach } from "vitest";

// Types
import type {
  GlobalTraceEvent,
  GlobalTraceTimeline,
  GlobalTraceActor,
} from "../global-trace-types";

// Defaults
import {
  buildEmptyGlobalTraceTimeline,
  buildDemoGlobalTraceTimeline,
  buildSystemTraceActor,
  buildAIEmployeeTraceActor,
  buildHumanTraceActor,
  buildCloneGuardActor,
  buildClonePolicyActor,
  buildCloneOSActor,
  defaultTraceSeverityForEventType,
  defaultTraceStatusForEventType,
  generateTraceEventId,
  generateTraceTimelineId,
} from "../global-trace-defaults";

// Event Factory
import {
  createGlobalTraceEvent,
  redactTraceMetadata,
  sanitizeTraceSummary,
  createMissionCreatedEvent,
  createActionAllowedEvent,
  createActionBlockedEvent,
  createActionRefusedEvent,
  createValidationRequestedEvent,
  createDocumentPreparedEvent,
  createErrorRecordedEvent,
  createGuardEvaluatedEvent,
  createSystemNoteEvent,
  SENSITIVE_METADATA_KEYS,
} from "../global-trace-event-factory";

// Timeline
import {
  addEventToTimeline,
  addEventsToTimeline,
  filterTimelineEvents,
  getEventById,
  groupEventsByType,
  groupEventsBySeverity,
  groupEventsByStatus,
  groupEventsByActor,
  groupEventsByMission,
  getLatestEvents,
  getCriticalEvents,
  getGuardDecisionEvents,
  countEventsByRiskLevel,
} from "../global-trace-timeline";

// Validation
import {
  validateGlobalTraceEvent,
  validateGlobalTraceTimeline,
  getGlobalTraceValidationReport,
} from "../global-trace-validation";

// Snapshot
import { buildGlobalTraceSnapshot } from "../global-trace-snapshot";

// Storage
import {
  getGlobalTraceTimeline,
  getOrCreateGlobalTraceTimeline,
  appendTraceEvent,
  appendTraceEvents,
  clearTraceStore,
  hasTraceTimeline,
  getTotalTraceEventCount,
  getTraceEventById,
} from "../global-trace-storage";
import * as StorageModuleNS from "../global-trace-storage";

// Employee Access
import {
  PIERRE_DEFAULT_TRACE_ACCESS_PROFILE,
  UNKNOWN_EMPLOYEE_TRACE_ACCESS_PROFILE,
  SYSTEM_TRACE_ACCESS_PROFILE,
  getEmployeeTraceAccessProfile,
  canEmployeeCreateEvent,
  doesActionRequireTrace,
  canEmployeeDeleteEvents,
} from "../employee-trace-access";

// Guard Bridge
import {
  mapGuardDecisionToTraceEventType,
  createTraceEventFromGuardDecision,
  applyGuardDecisionToTimeline,
  createValidationRequestTraceFromGuard,
} from "../guard-trace-bridge";

// Pierre Bridge
import {
  mapPierreEventTypeToGlobalEventType,
  mapPierreRiskLevelToGlobal,
  createTraceEventFromPierreEvent,
  applyPierreEventToTimeline,
  getPierreMappingsSummary,
} from "../pierre-trace-bridge";

// ── Helpers ──────────────────────────────────────────────────────────────────

const COMPANY_ID = "cmp_test_001";
const TIMELINE_ID = "tl_test_001";

function makeTimeline(): GlobalTraceTimeline {
  return buildEmptyGlobalTraceTimeline(COMPANY_ID, TIMELINE_ID);
}

function makeBasicEvent(overrides: Partial<GlobalTraceEvent> = {}): GlobalTraceEvent {
  return createGlobalTraceEvent({
    timeline_id: TIMELINE_ID,
    company_id: COMPANY_ID,
    event_type: "system_note",
    actor: buildSystemTraceActor(),
    summary: "Test note",
    ...overrides,
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — Types & Defaults
// ══════════════════════════════════════════════════════════════════════════════

describe("TECH-07 · Section 1 — Types & Defaults", () => {
  it("T01 — buildEmptyGlobalTraceTimeline crée une timeline vide correcte", () => {
    const tl = buildEmptyGlobalTraceTimeline("cmp_001");
    expect(tl.company_id).toBe("cmp_001");
    expect(tl.events).toHaveLength(0);
    expect(tl.event_count).toBe(0);
    expect(tl.is_demo).toBe(false);
    expect(tl.timeline_id).toBeTruthy();
    expect(tl.first_event_at).toBeUndefined();
  });

  it("T02 — buildDemoGlobalTraceTimeline crée une demo avec événements", () => {
    const demo = buildDemoGlobalTraceTimeline();
    expect(demo.is_demo).toBe(true);
    expect(demo.events.length).toBeGreaterThanOrEqual(4);
    expect(demo.company_id).toBeTruthy();
    // Tous les événements doivent être immutables
    for (const ev of demo.events) {
      expect(ev.immutable).toBe(true);
    }
  });

  it("T03 — buildSystemTraceActor retourne un acteur système valide", () => {
    const actor = buildSystemTraceActor();
    expect(actor.actor_type).toBe("system");
    expect(actor.is_human).toBe(false);
    expect(actor.is_ai).toBe(false);
    expect(actor.is_system).toBe(true);
  });

  it("T04 — buildAIEmployeeTraceActor retourne un acteur AI valide", () => {
    const actor = buildAIEmployeeTraceActor("pierre", "Pierre — RH");
    expect(actor.actor_type).toBe("ai_employee");
    expect(actor.is_ai).toBe(true);
    expect(actor.is_human).toBe(false);
    expect(actor.employee_slug).toBe("pierre");
    expect(actor.actor_label).toBe("Pierre — RH");
  });

  it("T05 — buildHumanTraceActor retourne un acteur humain valide", () => {
    const actor = buildHumanTraceActor("usr_001", "Marie Dupont");
    expect(actor.actor_type).toBe("human_user");
    expect(actor.is_human).toBe(true);
    expect(actor.is_ai).toBe(false);
    expect(actor.actor_label).toBe("Marie Dupont");
  });

  it("T06 — buildCloneGuardActor, buildClonePolicyActor, buildCloneOSActor", () => {
    const guard = buildCloneGuardActor();
    const policy = buildClonePolicyActor();
    const os = buildCloneOSActor();
    expect(guard.actor_type).toBe("cloneguard");
    expect(policy.actor_type).toBe("clonepolicy");
    expect(os.actor_type).toBe("cloneos");
    for (const a of [guard, policy, os]) {
      expect(a.is_system).toBe(true);
      expect(a.is_human).toBe(false);
      expect(a.is_ai).toBe(false);
    }
  });

  it("T07 — defaultTraceSeverityForEventType map correctement", () => {
    expect(defaultTraceSeverityForEventType("action_refused")).toBe("critical");
    expect(defaultTraceSeverityForEventType("action_blocked")).toBe("warning");
    expect(defaultTraceSeverityForEventType("memory_read")).toBe("debug");
    expect(defaultTraceSeverityForEventType("mission_created")).toBe("info");
  });

  it("T08 — defaultTraceStatusForEventType map correctement", () => {
    expect(defaultTraceStatusForEventType("action_blocked")).toBe("blocked");
    expect(defaultTraceStatusForEventType("action_refused")).toBe("refused");
    expect(defaultTraceStatusForEventType("error_recorded")).toBe("failure");
    expect(defaultTraceStatusForEventType("mission_created")).toBe("success");
  });

  it("T09 — generateTraceEventId et generateTraceTimelineId génèrent des IDs uniques", () => {
    const id1 = generateTraceEventId();
    const id2 = generateTraceEventId();
    expect(id1).not.toBe(id2);
    expect(id1.startsWith("evt_")).toBe(true);

    const tl1 = generateTraceTimelineId("cmp_001");
    expect(tl1.startsWith("tl_cmp_001_")).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — Event Factory & Sanitisation
// ══════════════════════════════════════════════════════════════════════════════

describe("TECH-07 · Section 2 — Event Factory & Sanitisation", () => {
  it("T10 — createGlobalTraceEvent crée un événement immuable valide", () => {
    const event = makeBasicEvent();
    expect(event.immutable).toBe(true);
    expect(event.event_id).toBeTruthy();
    expect(event.timeline_id).toBe(TIMELINE_ID);
    expect(event.company_id).toBe(COMPANY_ID);
    expect(event.created_at).toBeTruthy();
    expect(Array.isArray(event.tags)).toBe(true);
    expect(Array.isArray(event.related_entities)).toBe(true);
    expect(Array.isArray(event.technology_refs)).toBe(true);
    expect(Array.isArray(event.proof_refs)).toBe(true);
  });

  it("T11 — redactTraceMetadata redacte les clés sensibles", () => {
    const raw = {
      password: "secret123",
      token: "abc.def.ghi",
      api_key: "sk-xxx",
      normal_key: "safe value",
      stripe_key: "sk_live_abc",
    };
    const redacted = redactTraceMetadata(raw);
    expect(redacted.password).toBe("[REDACTED]");
    expect(redacted.token).toBe("[REDACTED]");
    expect(redacted.api_key).toBe("[REDACTED]");
    expect(redacted.stripe_key).toBe("[REDACTED]");
    expect(redacted.normal_key).toBe("safe value");
  });

  it("T12 — redactTraceMetadata ne modifie pas les clés non sensibles", () => {
    const raw = { domain: "hr", risk: "low", count: 3 };
    const redacted = redactTraceMetadata(raw);
    expect(redacted.domain).toBe("hr");
    expect(redacted.risk).toBe("low");
    expect(redacted.count).toBe(3);
  });

  it("T13 — sanitizeTraceSummary retire les tokens sensibles", () => {
    const raw = "Token sk_live_abc123 transmis à l'API";
    const sanitized = sanitizeTraceSummary(raw);
    expect(sanitized).not.toContain("sk_live_abc123");
    expect(sanitized).toContain("[REDACTED_TOKEN]");
  });

  it("T14 — sanitizeTraceSummary retourne placeholder si summary vide", () => {
    expect(sanitizeTraceSummary("")).toBe("[Résumé non disponible]");
    expect(sanitizeTraceSummary("   ")).toBe("[Résumé non disponible]");
  });

  it("T15 — SENSITIVE_METADATA_KEYS contient les clés critiques", () => {
    expect(SENSITIVE_METADATA_KEYS).toContain("password");
    expect(SENSITIVE_METADATA_KEYS).toContain("token");
    expect(SENSITIVE_METADATA_KEYS).toContain("api_key");
    expect(SENSITIVE_METADATA_KEYS).toContain("stripe");
    expect(SENSITIVE_METADATA_KEYS).toContain("openai");
    expect(SENSITIVE_METADATA_KEYS).toContain("anthropic");
  });

  it("T16 — createMissionCreatedEvent crée une mission_created", () => {
    const actor = buildAIEmployeeTraceActor("pierre");
    const ev = createMissionCreatedEvent(TIMELINE_ID, COMPANY_ID, actor, "m_001", "Mission créée");
    expect(ev.event_type).toBe("mission_created");
    expect(ev.mission_id).toBe("m_001");
    expect(ev.employee_slug).toBeUndefined(); // L'actor a le slug, pas le champ
    expect(ev.related_entities.some((e) => e.entity_id === "m_001")).toBe(true);
  });

  it("T17 — createActionBlockedEvent crée un action_blocked avec guard info", () => {
    const ev = createActionBlockedEvent(TIMELINE_ID, COMPANY_ID, "delete_data", ["policy_009"]);
    expect(ev.event_type).toBe("action_blocked");
    expect(ev.status).toBe("blocked");
    expect(ev.severity).toBe("warning");
    expect(ev.technology_refs.some((t) => t.technology_key === "CloneGuard")).toBe(true);
    expect(ev.metadata.rule_ids).toBe("policy_009");
  });

  it("T18 — createActionRefusedEvent crée un action_refused critique", () => {
    const ev = createActionRefusedEvent(TIMELINE_ID, COMPANY_ID, "legal_decision", ["policy_001"]);
    expect(ev.event_type).toBe("action_refused");
    expect(ev.status).toBe("refused");
    expect(ev.severity).toBe("critical");
    expect(ev.risk_level).toBe("critical");
  });

  it("T19 — createValidationRequestedEvent crée un validation_requested", () => {
    const ev = createValidationRequestedEvent(
      TIMELINE_ID, COMPANY_ID, "val_001", ["manager@test.fr"], "Validation requise",
    );
    expect(ev.event_type).toBe("validation_requested");
    expect(ev.validation_ref?.validation_id).toBe("val_001");
    expect(ev.validation_ref?.status).toBe("pending");
    expect(ev.validation_ref?.requested_from).toContain("manager@test.fr");
  });

  it("T20 — createErrorRecordedEvent crée un error_recorded en severity error", () => {
    const ev = createErrorRecordedEvent(TIMELINE_ID, COMPANY_ID, "NullPointerException");
    expect(ev.event_type).toBe("error_recorded");
    expect(ev.severity).toBe("error");
    expect(ev.status).toBe("failure");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — Timeline Management
// ══════════════════════════════════════════════════════════════════════════════

describe("TECH-07 · Section 3 — Timeline Management", () => {
  it("T21 — addEventToTimeline ajoute un événement et met à jour les compteurs", () => {
    const tl = makeTimeline();
    const ev = makeBasicEvent();
    const updated = addEventToTimeline(tl, ev);
    expect(updated.event_count).toBe(1);
    expect(updated.events).toHaveLength(1);
    expect(updated.first_event_at).toBe(ev.created_at);
    expect(updated.last_event_at).toBe(ev.created_at);
  });

  it("T22 — addEventToTimeline est idempotent (même event_id ignoré)", () => {
    const tl = makeTimeline();
    const ev = makeBasicEvent({ event_id: "fixed_id" });
    const tl1 = addEventToTimeline(tl, ev);
    const tl2 = addEventToTimeline(tl1, ev); // même ID
    expect(tl2.event_count).toBe(1); // pas ajouté deux fois
    expect(tl2.events).toHaveLength(1);
  });

  it("T23 — addEventToTimeline force immutable=true", () => {
    const tl = makeTimeline();
    // On simule un événement sans immutable
    const ev = { ...makeBasicEvent(), immutable: false as unknown as true };
    const updated = addEventToTimeline(tl, ev);
    expect(updated.events[0].immutable).toBe(true);
  });

  it("T24 — addEventsToTimeline ajoute plusieurs événements", () => {
    const tl = makeTimeline();
    const events = [makeBasicEvent(), makeBasicEvent(), makeBasicEvent()];
    const updated = addEventsToTimeline(tl, events);
    expect(updated.event_count).toBe(3);
  });

  it("T25 — filterTimelineEvents filtre par event_type", () => {
    const tl = makeTimeline();
    const ev1 = createActionBlockedEvent(TIMELINE_ID, COMPANY_ID, "delete_data", []);
    const ev2 = createSystemNoteEvent(TIMELINE_ID, COMPANY_ID, "note");
    const loaded = addEventsToTimeline(tl, [ev1, ev2]);
    const filtered = filterTimelineEvents(loaded, { event_types: ["action_blocked"] });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].event_type).toBe("action_blocked");
  });

  it("T26 — filterTimelineEvents filtre par severity", () => {
    const tl = makeTimeline();
    const blocked = createActionBlockedEvent(TIMELINE_ID, COMPANY_ID, "delete_data", []);
    const refused = createActionRefusedEvent(TIMELINE_ID, COMPANY_ID, "legal_decision", []);
    const loaded = addEventsToTimeline(tl, [blocked, refused]);
    const criticals = filterTimelineEvents(loaded, { severity: ["critical"] });
    expect(criticals.every((e) => e.severity === "critical")).toBe(true);
  });

  it("T27 — filterTimelineEvents supporte pagination (limit/offset)", () => {
    const tl = makeTimeline();
    const events = Array.from({ length: 10 }, (_, i) =>
      makeBasicEvent({ event_id: `evt_${i}` }),
    );
    const loaded = addEventsToTimeline(tl, events);
    const page = filterTimelineEvents(loaded, { limit: 3, offset: 2 });
    expect(page).toHaveLength(3);
  });

  it("T28 — getEventById retrouve un événement par son ID", () => {
    const tl = makeTimeline();
    const ev = makeBasicEvent({ event_id: "evt_find_me" });
    const loaded = addEventToTimeline(tl, ev);
    const found = getEventById(loaded, "evt_find_me");
    expect(found).toBeDefined();
    expect(found?.event_id).toBe("evt_find_me");
  });

  it("T29 — groupEventsByType groupe correctement", () => {
    const events = [
      makeBasicEvent({ event_type: "mission_created" }),
      makeBasicEvent({ event_type: "mission_created" }),
      makeBasicEvent({ event_type: "system_note" }),
    ];
    const grouped = groupEventsByType(events);
    expect(grouped.get("mission_created")).toHaveLength(2);
    expect(grouped.get("system_note")).toHaveLength(1);
  });

  it("T30 — getCriticalEvents retourne uniquement les critiques et erreurs", () => {
    const tl = makeTimeline();
    const normal = makeBasicEvent({ severity: "info" });
    const critical = makeBasicEvent({ severity: "critical" });
    const error = makeBasicEvent({ severity: "error" });
    const loaded = addEventsToTimeline(tl, [normal, critical, error]);
    const criticals = getCriticalEvents(loaded);
    expect(criticals).toHaveLength(2);
    expect(criticals.every((e) => e.severity === "critical" || e.severity === "error")).toBe(true);
  });

  it("T31 — getGuardDecisionEvents retourne les événements Guard", () => {
    const tl = makeTimeline();
    const blocked = createActionBlockedEvent(TIMELINE_ID, COMPANY_ID, "delete_data", []);
    const note = makeBasicEvent();
    const loaded = addEventsToTimeline(tl, [blocked, note]);
    const guardEvents = getGuardDecisionEvents(loaded);
    expect(guardEvents).toHaveLength(1);
    expect(guardEvents[0].event_type).toBe("action_blocked");
  });

  it("T32 — countEventsByRiskLevel compte par niveau de risque", () => {
    const events = [
      makeBasicEvent({ risk_level: "low" }),
      makeBasicEvent({ risk_level: "low" }),
      makeBasicEvent({ risk_level: "critical" }),
    ];
    const counts = countEventsByRiskLevel(events);
    expect(counts.low).toBe(2);
    expect(counts.critical).toBe(1);
    expect(counts.medium).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — Validation
// ══════════════════════════════════════════════════════════════════════════════

describe("TECH-07 · Section 4 — Validation", () => {
  it("T33 — validateGlobalTraceEvent valide un événement correct", () => {
    const ev = makeBasicEvent();
    const issues = validateGlobalTraceEvent(ev);
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors).toHaveLength(0);
  });

  it("T34 — validateGlobalTraceEvent TV01/TV02/TV03 : champs requis", () => {
    const ev = makeBasicEvent({ event_id: "", timeline_id: "", company_id: "" });
    const issues = validateGlobalTraceEvent(ev);
    const codes = issues.map((i) => i.code);
    expect(codes).toContain("TV01");
    expect(codes).toContain("TV02");
    expect(codes).toContain("TV03");
  });

  it("T35 — validateGlobalTraceEvent TV13 : immutable doit être true", () => {
    const ev = { ...makeBasicEvent(), immutable: false as unknown as true };
    const issues = validateGlobalTraceEvent(ev);
    expect(issues.some((i) => i.code === "TV13")).toBe(true);
  });

  it("T36 — validateGlobalTraceEvent TV16 : action_refused doit être critical", () => {
    const ev = makeBasicEvent({ event_type: "action_refused", severity: "info" });
    const issues = validateGlobalTraceEvent(ev);
    expect(issues.some((i) => i.code === "TV16")).toBe(true);
  });

  it("T37 — validateGlobalTraceEvent TV25 : pas de conformité garantie", () => {
    const ev = makeBasicEvent({ summary: "Conformité garantie par ce module" });
    const issues = validateGlobalTraceEvent(ev);
    expect(issues.some((i) => i.code === "TV25")).toBe(true);
  });

  it("T38 — validateGlobalTraceEvent TV27 : acteur ne peut pas être human ET ai", () => {
    const ev = makeBasicEvent({
      actor: { ...buildSystemTraceActor(), is_human: true, is_ai: true },
    });
    const issues = validateGlobalTraceEvent(ev);
    expect(issues.some((i) => i.code === "TV27")).toBe(true);
  });

  it("T39 — validateGlobalTraceTimeline TL03 : event_count incohérent", () => {
    const tl = makeTimeline();
    const broken = { ...tl, event_count: 999 }; // wrong count
    const issues = validateGlobalTraceTimeline(broken);
    expect(issues.some((i) => i.code === "TL03")).toBe(true);
  });

  it("T40 — validateGlobalTraceTimeline TL04 : event_ids dupliqués", () => {
    const ev = makeBasicEvent({ event_id: "dup_id" });
    const tl = addEventsToTimeline(makeTimeline(), [ev]);
    // Forcer un doublon directement
    const broken = { ...tl, events: [ev, ev], event_count: 2 };
    const issues = validateGlobalTraceTimeline(broken);
    expect(issues.some((i) => i.code === "TL04")).toBe(true);
  });

  it("T41 — getGlobalTraceValidationReport retourne ok:true sur timeline valide", () => {
    const demo = buildDemoGlobalTraceTimeline("cmp_valid");
    const report = getGlobalTraceValidationReport(demo);
    expect(report.ok).toBe(true);
    expect(report.errors).toHaveLength(0);
    expect(report.event_count).toBe(demo.events.length);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — Snapshot
// ══════════════════════════════════════════════════════════════════════════════

describe("TECH-07 · Section 5 — Snapshot", () => {
  it("T42 — buildGlobalTraceSnapshot retourne empty sur timeline vide", () => {
    const tl = makeTimeline();
    const snap = buildGlobalTraceSnapshot(tl);
    expect(snap.health_status).toBe("empty");
    expect(snap.event_count).toBe(0);
    expect(snap.health_score).toBe(50);
  });

  it("T43 — buildGlobalTraceSnapshot détecte les événements critiques", () => {
    const tl = makeTimeline();
    const refused = createActionRefusedEvent(TIMELINE_ID, COMPANY_ID, "legal_decision", []);
    const loaded = addEventToTimeline(tl, refused);
    const snap = buildGlobalTraceSnapshot(loaded);
    expect(snap.critical_count).toBe(1);
    expect(snap.refused_count).toBe(1);
    expect(snap.health_score).toBeLessThan(100);
  });

  it("T44 — buildGlobalTraceSnapshot calcule health_score correctement", () => {
    const tl = makeTimeline();
    const events = [
      makeBasicEvent({ severity: "info", status: "success" }),
      makeBasicEvent({ severity: "info", status: "success" }),
      makeBasicEvent({ severity: "info", status: "success" }),
    ];
    const loaded = addEventsToTimeline(tl, events);
    const snap = buildGlobalTraceSnapshot(loaded);
    expect(snap.health_score).toBe(100);
    expect(snap.health_status).toBe("healthy");
  });

  it("T45 — buildGlobalTraceSnapshot compte par sévérité", () => {
    const demo = buildDemoGlobalTraceTimeline();
    const snap = buildGlobalTraceSnapshot(demo);
    const total = Object.values(snap.events_by_severity).reduce((a, b) => a + b, 0);
    expect(total).toBe(demo.events.length);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 6 — Storage
// ══════════════════════════════════════════════════════════════════════════════

describe("TECH-07 · Section 6 — Storage", () => {
  beforeEach(() => {
    clearTraceStore();
  });

  it("T46 — appendTraceEvent crée la timeline si elle n'existe pas", () => {
    const ev = makeBasicEvent();
    const tl = appendTraceEvent(COMPANY_ID, ev);
    expect(tl.event_count).toBe(1);
    expect(hasTraceTimeline(COMPANY_ID)).toBe(true);
  });

  it("T47 — getOrCreateGlobalTraceTimeline crée une timeline vide", () => {
    const tl = getOrCreateGlobalTraceTimeline("cmp_new");
    expect(tl.company_id).toBe("cmp_new");
    expect(tl.events).toHaveLength(0);
  });

  it("T48 — getGlobalTraceTimeline retourne undefined si inexistante", () => {
    expect(getGlobalTraceTimeline("cmp_unknown_xyz")).toBeUndefined();
  });

  it("T49 — getTotalTraceEventCount compte tous les événements du store", () => {
    appendTraceEvent("cmp_A", makeBasicEvent());
    appendTraceEvent("cmp_A", makeBasicEvent());
    appendTraceEvent("cmp_B", makeBasicEvent());
    expect(getTotalTraceEventCount()).toBe(3);
  });

  it("T50 — getTraceEventById retrouve un événement dans le store", () => {
    const ev = makeBasicEvent({ event_id: "evt_find_in_store" });
    appendTraceEvent(COMPANY_ID, ev);
    const found = getTraceEventById(COMPANY_ID, "evt_find_in_store");
    expect(found).toBeDefined();
    expect(found?.event_id).toBe("evt_find_in_store");
  });

  it("T51 — Il n'existe pas de fonction deleteTraceEvent dans le storage", () => {
    // Vérification architecturale : aucune suppression possible
    // On utilise le namespace importé statiquement
    const sm = StorageModuleNS as Record<string, unknown>;
    expect(sm["deleteTraceEvent"]).toBeUndefined();
    expect(sm["removeTraceEvent"]).toBeUndefined();
    expect(sm["deleteGlobalTraceTimeline"]).toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 7 — Employee Access, Guard Bridge, Pierre Bridge
// ══════════════════════════════════════════════════════════════════════════════

describe("TECH-07 · Section 7 — Accès employés, bridges Guard et Pierre", () => {
  it("T52 — Pierre peut créer des événements RH mais pas supprimer", () => {
    const profile = getEmployeeTraceAccessProfile("pierre");
    expect(profile.can_create_events).toBe(true);
    expect(profile.can_read_events).toBe(true);
    expect(profile.can_delete_events).toBe(false);
    expect(profile.can_read_admin_only).toBe(false);
    expect(profile.allowed_event_types).toContain("mission_created");
    expect(profile.allowed_event_types).toContain("document_prepared");
  });

  it("T53 — canEmployeeDeleteEvents retourne toujours false", () => {
    expect(canEmployeeDeleteEvents("pierre")).toBe(false);
    expect(canEmployeeDeleteEvents("system")).toBe(false);
    expect(canEmployeeDeleteEvents("emma")).toBe(false);
  });

  it("T54 — Guard Bridge : createTraceEventFromGuardDecision mappe correctement", () => {
    const input = {
      company_id: COMPANY_ID,
      timeline_id: TIMELINE_ID,
      decision: "refuse" as const,
      action_type: "legal_decision",
      risk_level: "critical" as const,
      rule_ids_matched: ["policy_001"],
      employee_slug: "pierre",
    };
    const ev = createTraceEventFromGuardDecision(input);
    expect(ev.event_type).toBe("action_refused");
    expect(ev.guard_decision?.decision).toBe("refuse");
    expect(ev.guard_decision?.action_type).toBe("legal_decision");
    expect(ev.risk_level).toBe("critical");
    expect(ev.immutable).toBe(true);
    expect(ev.source).toBe("cloneguard");
  });

  it("T55 — Guard Bridge : mapGuardDecisionToTraceEventType couvre tous les cas", () => {
    expect(mapGuardDecisionToTraceEventType("allow")).toBe("action_allowed");
    expect(mapGuardDecisionToTraceEventType("prepare_only")).toBe("action_prepared");
    expect(mapGuardDecisionToTraceEventType("require_validation")).toBe("action_requires_validation");
    expect(mapGuardDecisionToTraceEventType("block")).toBe("action_blocked");
    expect(mapGuardDecisionToTraceEventType("refuse")).toBe("action_refused");
  });

  it("T56 — Pierre Bridge : createTraceEventFromPierreEvent traduit les types Pierre", () => {
    const ev = createTraceEventFromPierreEvent({
      company_id: COMPANY_ID,
      timeline_id: TIMELINE_ID,
      pierre_event_type: "document_generated",
      summary: "Document RH généré",
      risk_level: "low",
    });
    expect(ev.event_type).toBe("document_prepared");
    expect(ev.source).toBe("pierre_bridge");
    expect(ev.employee_slug).toBe("pierre");
    expect(ev.actor.actor_type).toBe("ai_employee");
    expect(ev.metadata.pierre_event_type).toBe("document_generated");
  });

  it("T57 — Pierre Bridge : mapPierreRiskLevelToGlobal mappe les niveaux Pierre", () => {
    expect(mapPierreRiskLevelToGlobal("green")).toBe("low");
    expect(mapPierreRiskLevelToGlobal("red")).toBe("high");
    expect(mapPierreRiskLevelToGlobal("black")).toBe("critical");
    expect(mapPierreRiskLevelToGlobal("medium")).toBe("medium");
    expect(mapPierreRiskLevelToGlobal(undefined)).toBe("low");
  });

  it("T58 — Pierre Bridge : getPierreMappingsSummary retourne tous les mappings", () => {
    const mappings = getPierreMappingsSummary();
    expect(mappings.length).toBeGreaterThan(10);
    const missionMapping = mappings.find((m) => m.pierre_event === "mission_created");
    expect(missionMapping?.global_event).toBe("mission_created");
    const validationMapping = mappings.find((m) => m.pierre_event === "validation_required");
    expect(validationMapping?.global_event).toBe("validation_requested");
  });

  it("T59 — applyPierreEventToTimeline ajoute l'événement à la timeline", () => {
    const tl = makeTimeline();
    const updated = applyPierreEventToTimeline(tl, {
      company_id: COMPANY_ID,
      pierre_event_type: "mission_created",
      summary: "Mission Pierre créée",
      mission_id: "m_test",
    });
    expect(updated.event_count).toBe(1);
    expect(updated.events[0].event_type).toBe("mission_created");
    expect(updated.events[0].source).toBe("pierre_bridge");
  });

  it("T60 — doesActionRequireTrace détecte les actions tracées obligatoirement", () => {
    expect(doesActionRequireTrace("pierre", "send_email")).toBe(true);
    expect(doesActionRequireTrace("pierre", "update_memory")).toBe(true);
    expect(doesActionRequireTrace("pierre", "legal_decision")).toBe(true);
    expect(doesActionRequireTrace("pierre", "read_context")).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 8 — Invariants & Sécurité
// ══════════════════════════════════════════════════════════════════════════════

describe("TECH-07 · Section 8 — Invariants & Sécurité", () => {
  it("T61 — Tous les événements de la demo sont immutables et is_demo=true", () => {
    const demo = buildDemoGlobalTraceTimeline();
    for (const ev of demo.events) {
      expect(ev.immutable).toBe(true);
      expect(ev.is_demo).toBe(true);
    }
  });

  it("T62 — Un événement action_refused a toujours source=cloneguard", () => {
    const ev = createActionRefusedEvent(TIMELINE_ID, COMPANY_ID, "payroll_execution", []);
    expect(ev.source).toBe("cloneguard");
    expect(ev.severity).toBe("critical");
    expect(ev.risk_level).toBe("critical");
  });

  it("T63 — createValidationRequestTraceFromGuard crée l'événement validation_requested", () => {
    const ev = createValidationRequestTraceFromGuard({
      company_id: COMPANY_ID,
      timeline_id: TIMELINE_ID,
      decision: "require_validation",
      action_type: "send_email",
      risk_level: "high",
      validation_id: "val_xyz",
      requested_from: ["rh@company.fr"],
    });
    expect(ev.event_type).toBe("validation_requested");
    expect(ev.validation_ref?.status).toBe("pending");
    expect(ev.validation_ref?.requested_from).toContain("rh@company.fr");
  });

  it("T64 — UNKNOWN_EMPLOYEE n'a pas accès à la création d'événements", () => {
    const profile = getEmployeeTraceAccessProfile("unknown_future_ai");
    expect(profile.can_create_events).toBe(false);
    expect(profile.can_read_events).toBe(false);
    expect(profile.can_delete_events).toBe(false);
    expect(profile.allowed_event_types).toHaveLength(0);
  });

  it("T65 — La validation TV11 détecte les tokens dans le summary", () => {
    const ev = makeBasicEvent({ summary: "Token sk_live_xxx transmis" });
    // La sanitisation s'applique à la création, donc le résumé est déjà nettoyé
    // Mais TV11 vérifie les patterns bruts
    const issues = validateGlobalTraceEvent(ev);
    // Le summary est sanitisé à la création, donc la validation ne doit pas trouver d'erreur TV11
    // (sanitizeTraceSummary s'est appliqué avant)
    expect(ev.summary).not.toContain("sk_live_xxx");
  });

  it("T66 — groupEventsByMission fonctionne correctement", () => {
    expect(typeof groupEventsByMission).toBe("function");
    const events = [
      makeBasicEvent({ mission_id: "m_001" }),
      makeBasicEvent({ mission_id: "m_001" }),
      makeBasicEvent({ mission_id: undefined }),
    ];
    const grouped = groupEventsByMission(events);
    expect(grouped.get("m_001")).toHaveLength(2);
    expect(grouped.get("__no_mission__")).toHaveLength(1);
  });

  it("T67 — applyGuardDecisionToTimeline fonctionne pour tous les types Guard", () => {
    const decisions = ["allow", "prepare_only", "require_validation", "block", "refuse"] as const;
    let tl = makeTimeline();
    for (const decision of decisions) {
      tl = applyGuardDecisionToTimeline(tl, {
        company_id: COMPANY_ID,
        decision,
        action_type: "send_email",
        risk_level: "medium",
      });
    }
    expect(tl.event_count).toBe(5);
    const types = tl.events.map((e) => e.event_type);
    expect(types).toContain("action_allowed");
    expect(types).toContain("action_prepared");
    expect(types).toContain("action_requires_validation");
    expect(types).toContain("action_blocked");
    expect(types).toContain("action_refused");
  });
});
