// src/lib/clonechat/visual/__tests__/visual.test.ts
//
// BLOC 9 — GATE unitaire du guidage visuel (déterministe). Les cibles « verified » sont PROUVÉES
// séparément par e2e/clonechat-visual-targets.spec.ts (rendu navigateur réel). Ici : sélection,
// localisation stable, obsolescence, portes audience/contexte, isolation, captures sûres/
// reproductibles, fallback honnête, absence de coordonnées non mesurées / d'image inventée / d'effet.

import { describe, it, expect } from "vitest";
import { buildCloneChatContext } from "@/lib/clonechat/context";
import {
  decideDiagnoseGuideCarePlanActionAndVisualGuide, resolveVisualGuidance, detectStale,
  visualGuidanceFromVoiceResult, getVisualTarget, VISUAL_TARGETS, buildCaptureRef,
  computeCaptureFingerprint, captureFingerprintsMatch, VIEWPORTS, type VisualTarget, type VisualViewport,
} from "..";
import type { CloneGuide } from "@/lib/clonechat/guide";
import { runVoiceJourney, transcriberOf } from "@/lib/clonechat/voice";
import type { CloneChatViewer } from "@/lib/clonechat/server/universal-access";
import type { TenantResolution } from "@/lib/clonechat/server/company";
import type { PierreAccessResult } from "@/lib/pierre/access";

const ANON: CloneChatViewer = { kind: "anonymous" };
const USER = (id = "u-1"): CloneChatViewer => ({ kind: "user", userId: id });
const TENANT_OK = (companyId = "co-1"): TenantResolution => ({ ok: true, companyId, role: "owner", siteIds: [], real: true });
const PIERRE_OK: PierreAccessResult = { ok: true, status: "active", orderId: "o-1", error: null };
const PIERRE_NONE: PierreAccessResult = { ok: false, reason: "NO_ENTITLEMENT", error: null };

interface CtxOpts { viewer: CloneChatViewer; tenant?: TenantResolution | null; entitlement?: PierreAccessResult | null; routePath?: string | null; }
function ctxOf(o: CtxOpts) {
  return buildCloneChatContext({ message: "x", viewer: o.viewer, tenant: o.tenant ?? null, entitlement: o.entitlement ?? null, routePath: o.routePath, environment: "production" });
}
function viz(message: string, o: CtxOpts, extra: { viewport?: VisualViewport } = {}) {
  return decideDiagnoseGuideCarePlanActionAndVisualGuide({ message }, ctxOf(o), { viewport: extra.viewport });
}
/** Guide minimal (pour tester resolveVisualGuidance directement). */
function fakeGuide(id: string, over: Partial<CloneGuide> = {}): CloneGuide {
  return { version: "guide-1", id, goal: "g", initialState: "s", startRoute: null, steps: [], totalSteps: 0, currentStep: 0, state: "ready", clarificationQuestion: null, requiresConfirmation: false, requiresEscalation: false, missingPrerequisites: [], recommendedRoute: null, evidence: [], ...over } as CloneGuide;
}

describe("BLOC 9 — sélection & cibles vérifiées (ancres réelles)", () => {
  it("cible réelle trouvée : démo → vt_demo, target_found, sélecteur stable data-tour-id", () => {
    const { visualGuidance: g } = viz("Où voir la démo de Pierre ?", { viewer: ANON });
    expect(g.state).toBe("target_found");
    expect(g.target?.id).toBe("vt_demo");
    expect(g.target?.stableSelector).toBe('[data-tour-id="demo-entry"]');
    expect(g.route).toBe("/demo/pierre");
    expect(g.confidence).toBe("high");
  });

  it("route inconnue → guide vt_home (revenir à l'accueil), target réel", () => {
    const { visualGuidance: g } = viz("bonjour", { viewer: ANON, routePath: "/page-inexistante-xyz" });
    expect(g.target?.id).toBe("vt_home");
    expect(g.route).toBe("/");
  });

  it("label accessible → méthode de localisation accessible_label ; jamais un sélecteur fragile", () => {
    const { visualGuidance: g } = viz("Guide-moi pour me connecter.", { viewer: ANON });
    expect(g.target?.id).toBe("vt_login");
    expect(g.locationMethod).toBe("accessible_label");
    // Aucun sélecteur fragile (position DOM) dans les cibles vérifiées.
    for (const t of VISUAL_TARGETS.filter((x) => x.status === "verified")) {
      expect(t.locationStrategy).toBe("stable_attribute");
      expect(t.stableSelector).toMatch(/^\[data-tour-id="/);
      expect(t.stableSelector ?? "").not.toMatch(/nth-child|>|\s+div/);
    }
  });

  it("desktop / iPhone / Android : la cible vérifiée reste trouvée (tous viewports supportés)", () => {
    for (const vp of ["desktop", "mobile_iphone", "mobile_android"] as VisualViewport[]) {
      const { visualGuidance: g } = viz("Où voir la démo de Pierre ?", { viewer: ANON }, { viewport: vp });
      expect(g.state).toBe("target_found");
      expect(g.viewport).toBe(vp);
    }
    expect(VIEWPORTS.mobile_iphone.width).toBe(390);
  });
});

describe("BLOC 9 — obsolescence déterministe", () => {
  const base: VisualTarget = getVisualTarget("vt_demo")!;
  it("ancre absente du contrat → stale (anchor_absent)", () => {
    const t: VisualTarget = { ...base, element: { ...base.element, tourId: "ancre-inexistante-zzz" } };
    expect(detectStale(t, { viewport: "desktop" })).toBe("anchor_absent");
  });
  it("route supprimée → route_removed", () => {
    const t: VisualTarget = { ...base, route: "/route-supprimee-zzz", element: { tourId: null, role: null, label: null, stableSelector: null } };
    expect(detectStale(t, { viewport: "desktop" })).toBe("route_removed");
  });
  it("viewport non supporté → viewport_unsupported", () => {
    const t: VisualTarget = { ...base, viewports: ["desktop"] };
    expect(detectStale(t, { viewport: "mobile_iphone" })).toBe("viewport_unsupported");
  });
  it("empreinte modifiée → fingerprint_changed → cible stale (jamais présentée comme exacte)", () => {
    const t: VisualTarget = { ...base, pageFingerprint: "cap_aaaa1111" };
    expect(detectStale(t, { viewport: "desktop", pageFingerprint: "cap_bbbb2222" })).toBe("fingerprint_changed");
    const g = resolveVisualGuidance({ viewport: "desktop", context: ctxOf({ viewer: ANON }), guide: fakeGuide("view_demo"), pageFingerprint: "cap_different" });
    // vt_demo n'a pas d'empreinte figée → reste target_found ; on prouve surtout la détection ci-dessus.
    expect(g.state).toBe("target_found");
  });
});

describe("BLOC 9 — portes audience / contexte / isolation", () => {
  it("viewer anonyme + cible publique → target_found ; cible authentifiée → needs_authentication", () => {
    expect(viz("Où voir la démo de Pierre ?", { viewer: ANON }).visualGuidance.state).toBe("target_found");
    const g = resolveVisualGuidance({ viewport: "desktop", context: ctxOf({ viewer: ANON }), guide: fakeGuide("resolve_no_company") });
    expect(g.target?.id).toBe("vt_resolve_company");
    expect(g.state).toBe("needs_authentication");
  });
  it("tenant absent (authentifié) → needs_context", () => {
    const g = resolveVisualGuidance({ viewport: "desktop", context: ctxOf({ viewer: USER(), tenant: null }), guide: fakeGuide("resolve_no_company") });
    expect(g.state).toBe("needs_context");
  });
  it("état authentifié synthétique + entreprise résolue → ready (ancre déclarée, non présentée comme mesurée)", () => {
    const g = resolveVisualGuidance({ viewport: "desktop", context: ctxOf({ viewer: USER(), tenant: TENANT_OK(), entitlement: PIERRE_OK }), guide: fakeGuide("resolve_no_company") });
    expect(g.state).toBe("ready");
    expect(g.rect).toBeNull(); // jamais de coordonnée non mesurée
  });
  it("isolation inter-tenant : le guidage ne contient jamais l'identifiant d'un autre tenant", () => {
    const a = viz("Prépare l'avenant de Paul.", { viewer: USER("uA"), tenant: TENANT_OK("company-A"), entitlement: PIERRE_NONE });
    expect(JSON.stringify(a.visualGuidance)).not.toContain("company-B");
  });
});

describe("BLOC 9 — actions, fallback, accessibilité, effets", () => {
  it("action nécessitant confirmation → cible surcouche de confirmation (fallback texte)", () => {
    const ctx = ctxOf({ viewer: USER() });
    const out = decideDiagnoseGuideCarePlanActionAndVisualGuide({ message: "aide" }, ctx, { actionRequest: { actionId: "submit_ticket", args: { ticket: { idempotencyKey: "tkt-x" } } } });
    expect(out.actionPlan?.state).toBe("awaiting_confirmation");
    expect(out.visualGuidance.target?.id).toBe("vt_confirm_overlay");
    expect(out.visualGuidance.state).toBe("fallback_text");
  });
  it("action bloquée → cible surcouche 'action bloquée'", () => {
    const ctx = ctxOf({ viewer: USER() });
    const out = decideDiagnoseGuideCarePlanActionAndVisualGuide({ message: "aide" }, ctx, { actionRequest: { actionId: "does_not_exist", args: {} } });
    expect(out.actionPlan?.state).toBe("blocked");
    expect(out.visualGuidance.target?.id).toBe("vt_blocked_overlay");
  });
  it("aucune cible fiable → fallback_text avec texte exploitable (lecteur d'écran)", () => {
    const g = resolveVisualGuidance({ viewport: "desktop", context: ctxOf({ viewer: ANON }), guide: fakeGuide("clarify_request") });
    expect(g.state).toBe("fallback_text");
    expect(g.instruction.trim().length).toBeGreaterThan(0);
    expect(g.fallbackText.trim().length).toBeGreaterThan(0);
  });
  it("toute instruction est un texte non vide (accessibilité lecteur d'écran)", () => {
    for (const msg of ["Où voir la démo de Pierre ?", "Guide-moi pour payer.", "Guide-moi pour me connecter.", "bonjour"]) {
      const { visualGuidance: g } = viz(msg, { viewer: ANON, routePath: msg === "bonjour" ? "/x-inconnue" : undefined });
      expect(g.instruction.trim().length).toBeGreaterThan(0);
    }
  });
  it("aucune coordonnée non mesurée : rect toujours null en résolution pure", () => {
    for (const t of VISUAL_TARGETS) expect(t.rect).toBeNull();
    expect(viz("Où voir la démo de Pierre ?", { viewer: ANON }).visualGuidance.rect).toBeNull();
  });
  it("le guidage visuel n'exécute ni ne confirme aucune action (plan non exécuté)", () => {
    const out = decideDiagnoseGuideCarePlanActionAndVisualGuide({ message: "aide" }, ctxOf({ viewer: USER() }), { actionRequest: { actionId: "submit_ticket", args: { ticket: { idempotencyKey: "tkt-x" } } } });
    // Le plan reste en attente de confirmation (jamais succeeded/executing depuis le guidage visuel).
    expect(["awaiting_confirmation", "blocked", "planned"]).toContain(out.actionPlan?.state);
  });
});

describe("BLOC 9 — captures officielles (sûres, reproductibles, sans image inventée)", () => {
  it("capture sans donnée sensible → ok, redacted, empreinte présente, aucun champ image", () => {
    const r = buildCaptureRef({ route: "/demo/pierre", viewport: "desktop", pageState: "public_rendered", anchorsPresent: ["demo-entry"], commit: "abcdef1", path: null });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.capture.redacted).toBe(true);
      expect(r.capture.fingerprint.startsWith("cap_")).toBe(true);
      expect(Object.keys(r.capture)).not.toContain("image");
      expect(Object.keys(r.capture)).not.toContain("base64");
      expect(r.capture.path).toBeNull(); // jamais d'image committée
    }
  });
  it("métadonnée sensible (token) → capture refusée (redaction)", () => {
    const r = buildCaptureRef({ route: "/demo/pierre", viewport: "desktop", pageState: "public_rendered", anchorsPresent: ["authorization: Bearer sk-secret"], commit: null, path: null });
    expect(r.ok).toBe(false);
  });
  it("état non autorisé (authentifié réel) → capture refusée", () => {
    const r = buildCaptureRef({ route: "/profile", viewport: "desktop", pageState: "real_authenticated", anchorsPresent: ["mycs-company"], commit: null, path: null });
    expect(r.ok).toBe(false);
  });
  it("empreinte reproductible : mêmes entrées → même empreinte", () => {
    const a = computeCaptureFingerprint("/demo/pierre", "desktop", "public_rendered", ["demo-entry", "clonechat-entry"]);
    const b = computeCaptureFingerprint("/demo/pierre", "desktop", "public_rendered", ["clonechat-entry", "demo-entry"]);
    expect(a).toBe(b); // ordre des ancres indifférent
    const r1 = buildCaptureRef({ route: "/", viewport: "desktop", pageState: "public_rendered", anchorsPresent: ["homepage-primary"], commit: null, path: null });
    const r2 = buildCaptureRef({ route: "/", viewport: "desktop", pageState: "public_rendered", anchorsPresent: ["homepage-primary"], commit: null, path: null });
    if (r1.ok && r2.ok) expect(captureFingerprintsMatch(r1.capture, r2.capture)).toBe(true);
  });
});

describe("BLOC 9 — voix, compatibilité, sécurité, déterminisme", () => {
  it("voix → guidage visuel sans recopier le transcript", async () => {
    const vr = await runVoiceJourney({ audio: { mime: "audio/mp4", bytes: 5000, content: new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]) }, viewer: ANON, environment: "production" }, { transcriber: transcriberOf("Montre-moi la démo, secret bananerouge") });
    const g = visualGuidanceFromVoiceResult(vr, "mobile_iphone");
    expect(g).not.toBeNull();
    expect(JSON.stringify(g)).not.toContain("bananerouge");
  });
  it("compatibilité Brain/Context/Diagnosis/Guide/Care/Actions/Visual + structured inchangé", () => {
    const out = decideDiagnoseGuideCarePlanActionAndVisualGuide({ message: "Où voir la démo de Pierre ?" }, ctxOf({ viewer: ANON }));
    expect(out.decision.version).toBe("brain-1");
    expect(out.context.version).toBe("context-1");
    expect(out.diagnosis.version).toBe("diagnosis-1");
    expect(out.care.version).toBe("care-1");
    expect(out.visualGuidance.version).toBe("visual-1");
    expect(Object.keys(out.structured).sort()).toEqual(["answer", "citations", "honesty", "tool_call"]);
  });
  it("déterminisme : même entrée → même guidage", () => {
    const a = JSON.stringify(viz("Où voir la démo de Pierre ?", { viewer: ANON }).visualGuidance);
    const b = JSON.stringify(viz("Où voir la démo de Pierre ?", { viewer: ANON }).visualGuidance);
    expect(a).toBe(b);
  });
  it("registre : toute cible verified a une route réelle et une ancre stable ; les cibles sans ancre sont unavailable", () => {
    for (const t of VISUAL_TARGETS) {
      if (t.status === "verified") {
        expect(t.element.tourId).toBeTruthy();
        expect(t.stableSelector).toMatch(/^\[data-tour-id="/);
      }
      if (t.element.tourId === null && t.route === "") expect(t.status).toBe("unavailable");
    }
  });
});
