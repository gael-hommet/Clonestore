// GO-LIVE 10 — Production Blockers Dashboard Tests
// Static + unit tests. No Stripe live. No Supabase writes. No real payments.
// Only readFileSync (NOT existsSync — causes TypeError in Vitest).

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import { FINAL_LAUNCH_BLOCKERS, getPublicLaunchBlockers } from "@/lib/go-live/final-launch-gate/final-launch-blockers";
import { getFinalLaunchGateVerdict } from "@/lib/go-live/final-launch-gate/final-launch-verdict";
import { FINAL_LAUNCH_PROOF_MAP, getProofsByType } from "@/lib/go-live/final-launch-gate/final-launch-proof-map";
import { GAEL_ACTIONS, WHILE_WAITING_ACTIONS } from "@/lib/go-live/final-launch-gate/final-launch-actions";

const ROOT = process.cwd();

function readPage(relPath: string): string {
  return readFileSync(join(ROOT, "src/app", relPath), "utf-8");
}

function readDoc(relPath: string): string {
  return readFileSync(join(ROOT, "docs", relPath), "utf-8");
}

function readLib(relPath: string): string {
  return readFileSync(join(ROOT, "src/lib", relPath), "utf-8");
}

// ── Types ─────────────────────────────────────────────────────────────────────

describe("go-live-10 — final launch gate types", () => {
  it("types file exists", () => {
    const content = readLib("go-live/final-launch-gate/final-launch-gate-types.ts");
    expect(content.length).toBeGreaterThan(100);
  });

  it("types include BlockerStatus union", () => {
    const content = readLib("go-live/final-launch-gate/final-launch-gate-types.ts");
    expect(content).toContain("ready");
    expect(content).toContain("blocked");
    expect(content).toContain("partial_ready");
    expect(content).toContain("pending");
  });

  it("types include BlockerOwner union", () => {
    const content = readLib("go-live/final-launch-gate/final-launch-gate-types.ts");
    expect(content).toContain("gael");
    expect(content).toContain("stripe");
    expect(content).toContain("legal");
    expect(content).toContain("supabase");
  });

  it("types include FinalLaunchBlocker interface", () => {
    const content = readLib("go-live/final-launch-gate/final-launch-gate-types.ts");
    expect(content).toContain("FinalLaunchBlocker");
    expect(content).toContain("blocks_public_launch");
    expect(content).toContain("can_be_done_now");
    expect(content).toContain("human_label");
  });

  it("types include ProofType union distinguishing staging/test/live/human/repo", () => {
    const content = readLib("go-live/final-launch-gate/final-launch-gate-types.ts");
    expect(content).toContain("staging_test");
    expect(content).toContain("production_live");
    expect(content).toContain("human_legal");
    expect(content).toContain("repo_tooling");
  });
});

// ── Blockers registry ─────────────────────────────────────────────────────────

describe("go-live-10 — blockers registry", () => {
  it("blockers registry file exists", () => {
    const content = readLib("go-live/final-launch-gate/final-launch-blockers.ts");
    expect(content.length).toBeGreaterThan(200);
  });

  it("registry includes legal entity blocker", () => {
    const blocker = FINAL_LAUNCH_BLOCKERS.find((b) => b.id === "legal_entity");
    expect(blocker).toBeDefined();
    expect(blocker?.status).toBe("blocked");
    expect(blocker?.blocks_public_launch).toBe(true);
  });

  it("registry includes Stripe live blocker", () => {
    const blocker = FINAL_LAUNCH_BLOCKERS.find((b) => b.id === "stripe_live");
    expect(blocker).toBeDefined();
    expect(blocker?.status).toBe("blocked");
    expect(blocker?.blocks_public_launch).toBe(true);
  });

  it("registry includes legal review blocker", () => {
    const blocker = FINAL_LAUNCH_BLOCKERS.find((b) => b.id === "legal_review");
    expect(blocker).toBeDefined();
    expect(blocker?.status).toBe("blocked");
    expect(blocker?.blocks_public_launch).toBe(true);
  });

  it("registry includes production RLS blocker", () => {
    const blocker = FINAL_LAUNCH_BLOCKERS.find((b) => b.id === "production_rls");
    expect(blocker).toBeDefined();
    expect(blocker?.status).toBe("blocked");
    expect(blocker?.blocks_public_launch).toBe(true);
  });

  it("registry includes live paid customer E2E blocker", () => {
    const blocker = FINAL_LAUNCH_BLOCKERS.find((b) => b.id === "live_paid_customer_e2e");
    expect(blocker).toBeDefined();
    expect(blocker?.status).toBe("blocked");
    expect(blocker?.blocks_public_launch).toBe(true);
  });

  it("registry includes product_core as ready", () => {
    const blocker = FINAL_LAUNCH_BLOCKERS.find((b) => b.id === "product_core");
    expect(blocker?.status).toBe("ready");
    expect(blocker?.blocks_public_launch).toBe(false);
  });

  it("registry includes public_site as ready", () => {
    const blocker = FINAL_LAUNCH_BLOCKERS.find((b) => b.id === "public_site");
    expect(blocker?.status).toBe("ready");
    expect(blocker?.blocks_public_launch).toBe(false);
  });

  it("all blockers have required fields", () => {
    for (const b of FINAL_LAUNCH_BLOCKERS) {
      expect(b.id).toBeTruthy();
      expect(b.title).toBeTruthy();
      expect(b.status).toBeTruthy();
      expect(b.owner).toBeTruthy();
      expect(b.next_action).toBeTruthy();
      expect(b.human_label).toBeTruthy();
    }
  });

  it("getPublicLaunchBlockers returns only blocked items that block launch", () => {
    const blockers = getPublicLaunchBlockers();
    expect(blockers.length).toBeGreaterThan(0);
    for (const b of blockers) {
      expect(b.blocks_public_launch).toBe(true);
      expect(["blocked", "pending"]).toContain(b.status);
    }
  });
});

// ── Verdict function ──────────────────────────────────────────────────────────

describe("go-live-10 — verdict function", () => {
  it("verdict file exists", () => {
    const content = readLib("go-live/final-launch-gate/final-launch-verdict.ts");
    expect(content.length).toBeGreaterThan(100);
  });

  it("getFinalLaunchGateVerdict returns required fields", () => {
    const v = getFinalLaunchGateVerdict();
    expect(v).toHaveProperty("global_status");
    expect(v).toHaveProperty("public_launch_allowed");
    expect(v).toHaveProperty("private_demo_allowed");
    expect(v).toHaveProperty("paid_customer_allowed");
    expect(v).toHaveProperty("blockers_count");
    expect(v).toHaveProperty("pending_count");
    expect(v).toHaveProperty("ready_count");
    expect(v).toHaveProperty("critical_blockers");
    expect(v).toHaveProperty("next_actions");
    expect(v).toHaveProperty("summary");
    expect(v).toHaveProperty("safe_message");
  });

  it("verdict currently returns public_launch_allowed=false", () => {
    const v = getFinalLaunchGateVerdict();
    expect(v.public_launch_allowed).toBe(false);
  });

  it("verdict returns private_demo_allowed=true", () => {
    const v = getFinalLaunchGateVerdict();
    expect(v.private_demo_allowed).toBe(true);
  });

  it("verdict returns paid_customer_allowed=false while entity/stripe blocked", () => {
    const v = getFinalLaunchGateVerdict();
    expect(v.paid_customer_allowed).toBe(false);
  });

  it("verdict global_status is private_demo_ready or public_no_go (never public_ready)", () => {
    const v = getFinalLaunchGateVerdict();
    expect(v.global_status).not.toBe("public_ready");
    expect(["private_demo_ready", "public_no_go"]).toContain(v.global_status);
  });

  it("verdict has non-empty critical_blockers", () => {
    const v = getFinalLaunchGateVerdict();
    expect(v.critical_blockers.length).toBeGreaterThan(0);
  });

  it("verdict ready_count is at least 3 (product, site, supabase preprod, onboarding)", () => {
    const v = getFinalLaunchGateVerdict();
    expect(v.ready_count).toBeGreaterThanOrEqual(3);
  });

  it("verdict safe_message mentions no lawyer/official payroll", () => {
    const v = getFinalLaunchGateVerdict();
    expect(v.safe_message).toMatch(/avocat|juriste|paie|conforme/i);
  });
});

// ── /profile/go-live page content ─────────────────────────────────────────────

describe("go-live-10 — /profile/go-live page content", () => {
  it("go-live page exists", () => {
    const content = readPage("profile/go-live/page.tsx");
    expect(content.length).toBeGreaterThan(500);
  });

  it("page mentions Public launch NO-GO", () => {
    const content = readPage("profile/go-live/page.tsx");
    expect(content).toMatch(/NO-GO|no.go/i);
  });

  it("page mentions societe / immatriculation", () => {
    const content = readPage("profile/go-live/page.tsx");
    expect(content).toMatch(/soci.t.|immatricul/i);
  });

  it("page mentions Stripe live", () => {
    expect(readPage("profile/go-live/page.tsx")).toMatch(/stripe.live|stripe_live/i);
  });

  it("page mentions revue juridique", () => {
    const content = readPage("profile/go-live/page.tsx");
    expect(content).toMatch(/juridique|juriste|legal.review/i);
  });

  it("page mentions RLS production", () => {
    const content = readPage("profile/go-live/page.tsx");
    expect(content).toMatch(/RLS.*prod|production.*RLS|rls.*production/i);
  });

  it("page mentions paid customer live or E2E", () => {
    const content = readPage("profile/go-live/page.tsx");
    expect(content).toMatch(/paid.customer|E2E|live.*paiement|paiement.*live/i);
  });

  it("page mentions demo / private demo allowed", () => {
    const content = readPage("profile/go-live/page.tsx");
    expect(content).toMatch(/d.mo|privée|demonstration/i);
  });

  it("page does not say public_ready or lancement public OK", () => {
    const content = readPage("profile/go-live/page.tsx");
    expect(content).not.toMatch(/public_ready/);
    expect(content).not.toMatch(/lancement public.*OK|OK.*lancement public/i);
  });

  it("page has noindex robots meta", () => {
    const content = readPage("profile/go-live/page.tsx");
    expect(content).toContain("noindex");
  });

  it("page has responsive classes (mobile/tablet/desktop)", () => {
    const content = readPage("profile/go-live/page.tsx");
    expect(content).toMatch(/sm:|md:|xl:/);
  });

  it("page imports getFinalLaunchGateVerdict", () => {
    expect(readPage("profile/go-live/page.tsx")).toContain("getFinalLaunchGateVerdict");
  });

  it("page imports FINAL_LAUNCH_BLOCKERS", () => {
    expect(readPage("profile/go-live/page.tsx")).toContain("FINAL_LAUNCH_BLOCKERS");
  });

  it("page does not call OpenAI or Anthropic", () => {
    const content = readPage("profile/go-live/page.tsx");
    expect(content).not.toMatch(/api\.openai\.com|api\.anthropic\.com/);
  });

  it("page does not write to go-live-proofs.local.json", () => {
    expect(readPage("profile/go-live/page.tsx")).not.toMatch(/go-live-proofs\.local\.json.*write|writeFile.*go-live-proofs/i);
  });
});

// ── /profile/launch-readiness consistency ─────────────────────────────────────

describe("go-live-10 — /profile/launch-readiness consistency", () => {
  it("launch-readiness page exists", () => {
    const content = readPage("profile/launch-readiness/page.tsx");
    expect(content.length).toBeGreaterThan(200);
  });

  it("launch-readiness does not claim public launch is GO", () => {
    const content = readPage("profile/launch-readiness/page.tsx");
    expect(content).not.toMatch(/public_launch.*=.*true|publicLaunchEnabled.*=.*true/i);
  });

  it("launch-readiness uses buildB48FinalVerdict", () => {
    expect(readPage("profile/launch-readiness/page.tsx")).toContain("buildB48FinalVerdict");
  });
});

// ── Doc checklist ─────────────────────────────────────────────────────────────

describe("go-live-10 — doc checklist", () => {
  it("doc exists", () => {
    const doc = readDoc("GO_LIVE_10_PRODUCTION_BLOCKERS_DASHBOARD.md");
    expect(doc.length).toBeGreaterThan(500);
  });

  it("doc includes recommended order", () => {
    const doc = readDoc("GO_LIVE_10_PRODUCTION_BLOCKERS_DASHBOARD.md");
    expect(doc).toMatch(/ordre.*recommand|recommand.*ordre/i);
  });

  it("doc says not to redo Stripe test unnecessarily", () => {
    const doc = readDoc("GO_LIVE_10_PRODUCTION_BLOCKERS_DASHBOARD.md");
    expect(doc).toMatch(/ne pas refaire Stripe test|pas refaire.*stripe.*inutilement/i);
  });

  it("doc mentions all 5 main blockers", () => {
    const doc = readDoc("GO_LIVE_10_PRODUCTION_BLOCKERS_DASHBOARD.md");
    expect(doc).toMatch(/soci.t./i);
    expect(doc).toMatch(/stripe.live/i);
    expect(doc).toMatch(/juridique|juriste/i);
    expect(doc).toMatch(/RLS.*prod|prod.*RLS/i);
    expect(doc).toMatch(/paid.customer|E2E.live/i);
  });

  it("doc lists staging proof IDs", () => {
    const doc = readDoc("GO_LIVE_10_PRODUCTION_BLOCKERS_DASHBOARD.md");
    expect(doc).toContain("SUPABASE_RLS_STAGING_VERIFIED");
    expect(doc).toContain("PUBLIC_COPY_SCAN_CLEAN");
  });

  it("doc lists production proof IDs", () => {
    const doc = readDoc("GO_LIVE_10_PRODUCTION_BLOCKERS_DASHBOARD.md");
    expect(doc).toContain("STRIPE_LIVE_SECRET_SET");
    expect(doc).toContain("PAID_CUSTOMER_PRODUCTION_E2E_COMPLETED");
    expect(doc).toContain("SUPABASE_RLS_PRODUCTION_VERIFIED");
  });

  it("doc lists human/legal proof IDs", () => {
    const doc = readDoc("GO_LIVE_10_PRODUCTION_BLOCKERS_DASHBOARD.md");
    expect(doc).toContain("LEGAL_ENTITY_INFO_COMPLETED");
    expect(doc).toContain("LEGAL_HUMAN_REVIEW_COMPLETED");
  });

  it("doc does not make forbidden claims", () => {
    const doc = readDoc("GO_LIVE_10_PRODUCTION_BLOCKERS_DASHBOARD.md");
    expect(doc).not.toMatch(/z.ro erreur/i);
    expect(doc).not.toMatch(/conformit. garantie/i);
    expect(doc).not.toMatch(/remplace (?:un |votre )?avocat(?! ni| pas)/i);
  });

  it("doc says not to set public launch flag automatically", () => {
    const doc = readDoc("GO_LIVE_10_PRODUCTION_BLOCKERS_DASHBOARD.md");
    expect(doc).toMatch(/B48_PUBLIC_LAUNCH_ENABLED|public.launch.*true|flag/i);
  });
});

// ── Proof map ─────────────────────────────────────────────────────────────────

describe("go-live-10 — proof map", () => {
  it("proof map file exists", () => {
    const content = readLib("go-live/final-launch-gate/final-launch-proof-map.ts");
    expect(content.length).toBeGreaterThan(200);
  });

  it("proof map has staging_test entries", () => {
    const proofs = getProofsByType("staging_test");
    expect(proofs.length).toBeGreaterThan(0);
  });

  it("proof map has production_live entries", () => {
    const proofs = getProofsByType("production_live");
    expect(proofs.length).toBeGreaterThan(0);
  });

  it("proof map has human_legal entries", () => {
    const proofs = getProofsByType("human_legal");
    expect(proofs.length).toBeGreaterThan(0);
  });

  it("proof map has repo_tooling entries", () => {
    const proofs = getProofsByType("repo_tooling");
    expect(proofs.length).toBeGreaterThan(0);
  });

  it("proof map includes STRIPE_LIVE_SECRET_SET as production_live", () => {
    const proof = FINAL_LAUNCH_PROOF_MAP.find((p) => p.proof_id === "STRIPE_LIVE_SECRET_SET");
    expect(proof).toBeDefined();
    expect(proof?.proof_type).toBe("production_live");
    expect(proof?.auto_verifiable).toBe(false);
  });

  it("proof map includes LEGAL_HUMAN_REVIEW_COMPLETED as human_legal", () => {
    const proof = FINAL_LAUNCH_PROOF_MAP.find((p) => p.proof_id === "LEGAL_HUMAN_REVIEW_COMPLETED");
    expect(proof).toBeDefined();
    expect(proof?.proof_type).toBe("human_legal");
  });

  it("proof map includes SUPABASE_RLS_STAGING_VERIFIED as staging_test", () => {
    const proof = FINAL_LAUNCH_PROOF_MAP.find((p) => p.proof_id === "SUPABASE_RLS_STAGING_VERIFIED");
    expect(proof).toBeDefined();
    expect(proof?.proof_type).toBe("staging_test");
  });

  it("proof map includes PAID_CUSTOMER_PRODUCTION_E2E_COMPLETED", () => {
    const proof = FINAL_LAUNCH_PROOF_MAP.find((p) => p.proof_id === "PAID_CUSTOMER_PRODUCTION_E2E_COMPLETED");
    expect(proof).toBeDefined();
    expect(proof?.proof_type).toBe("production_live");
    expect(proof?.auto_verifiable).toBe(false);
  });
});

// ── Safety — no forbidden modifications ───────────────────────────────────────

describe("go-live-10 — no forbidden modifications", () => {
  it("go-live page does not programmatically set B48_PUBLIC_LAUNCH_ENABLED=true", () => {
    // The page may display the flag name in a <code> JSX element as a warning.
    // We verify it does not assign the flag via process.env or a JS variable assignment.
    const content = readPage("profile/go-live/page.tsx");
    expect(content).not.toMatch(/process\.env\.B48_PUBLIC_LAUNCH_ENABLED\s*=\s*['"]?true/);
    expect(content).not.toMatch(/const B48_PUBLIC_LAUNCH_ENABLED\s*=\s*true/);
  });

  it("blockers registry does not call markProofVerified", () => {
    expect(readLib("go-live/final-launch-gate/final-launch-blockers.ts")).not.toMatch(/markProofVerified/);
  });

  it("verdict function does not call markProofVerified", () => {
    expect(readLib("go-live/final-launch-gate/final-launch-verdict.ts")).not.toMatch(/markProofVerified/);
  });

  it("go-live page does not contain usable sk_live_", () => {
    expect(readPage("profile/go-live/page.tsx")).not.toMatch(/STRIPE_SECRET_KEY=sk_live_/);
  });

  it("verdict function does not call OpenAI", () => {
    expect(readLib("go-live/final-launch-gate/final-launch-verdict.ts")).not.toMatch(/api\.openai\.com/);
  });

  it("verdict function does not call Anthropic", () => {
    expect(readLib("go-live/final-launch-gate/final-launch-verdict.ts")).not.toMatch(/api\.anthropic\.com/);
  });

  it("go-live page does not contain forbidden claim: conformite garantie", () => {
    expect(readPage("profile/go-live/page.tsx")).not.toMatch(/conformit. garantie/i);
  });

  it("go-live page does not contain forbidden claim: remplace avocat", () => {
    const content = readPage("profile/go-live/page.tsx");
    expect(content).not.toMatch(/remplace (?:un |votre )?avocat(?! ni| pas)/i);
  });

  it("go-live page does not contain forbidden claim: DSN autonome", () => {
    expect(readPage("profile/go-live/page.tsx")).not.toMatch(/DSN autonome/i);
  });

  it("go-live page does not contain forbidden claim: paie officielle autonome", () => {
    expect(readPage("profile/go-live/page.tsx")).not.toMatch(/paie officielle autonome/i);
  });

  it("go-live page does not contain forbidden claim: licenciement automatique", () => {
    expect(readPage("profile/go-live/page.tsx")).not.toMatch(/licenci.*automatique/i);
  });

  it("no file in final-launch-gate uses 'Logo' as component/type name", () => {
    const files = [
      "go-live/final-launch-gate/final-launch-gate-types.ts",
      "go-live/final-launch-gate/final-launch-blockers.ts",
      "go-live/final-launch-gate/final-launch-verdict.ts",
    ];
    for (const f of files) {
      const content = readLib(f);
      expect(content).not.toMatch(/(?:function|type|const|interface)\s+Logo/);
    }
  });

  it("verdict does not send real email", () => {
    expect(readLib("go-live/final-launch-gate/final-launch-verdict.ts")).not.toMatch(/resend\.com|sendEmail/i);
  });
});
