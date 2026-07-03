// src/lib/clonechat/knowledge/__tests__/p941-proofs.itest.ts
// P9.4.1 — Émet les artefacts de preuve du cerveau de connaissance + de la couverture
// d'outils dans .p941-proofs/. Lane *.itest.ts (opt-in). Pas de réseau.

import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { knowledgeChunks, computeCoverage, retrieveKnowledge, validateCitations, buildGroundedSystemPrompt } from "../index";
import { TOOL_REGISTRY, ALL_TOOL_NAMES } from "../../openai/tool-registry";

const OUT = resolve(process.cwd(), ".p941-proofs/p941-run1");
mkdirSync(OUT, { recursive: true });
const write = (n: string, o: unknown) => writeFileSync(resolve(OUT, n), JSON.stringify(o, null, 2));

describe("P9.4.1 proof artifacts", () => {
  it("émet knowledge-sources / coverage / freshness / visibility", () => {
    const chunks = knowledgeChunks();
    write("knowledge-sources.json", { total: chunks.length, byKind: count(chunks.map((c) => c.kind)), byAuthority: count(chunks.map((c) => c.authority)), sample: chunks.slice(0, 6).map((c) => ({ id: c.id, authority: c.authority, visibility: c.visibility, hash: c.contentHash })) });
    const cov = computeCoverage();
    write("knowledge-coverage.json", { complete: cov.complete, missingCategories: cov.missingCategories, totalChunks: cov.totalChunks, categories: cov.categories });
    write("knowledge-freshness.json", { all_current: chunks.every((c) => c.freshnessStatus === "CURRENT"), statuses: count(chunks.map((c) => c.freshnessStatus)) });
    write("knowledge-visibility.json", {
      byVisibility: count(chunks.map((c) => c.visibility)),
      public_never_sees_authenticated: retrieveKnowledge("cockpit missions", "public", 50).every((c) => c.visibility === "PUBLIC"),
      no_internal_or_restricted_to_client: (["public", "authenticated"] as const).every((v) => retrieveKnowledge("", v, 100).every((c) => c.visibility === "PUBLIC" || c.visibility === "AUTHENTICATED_CLIENT")),
    });
    expect(cov.complete).toBe(true);
  });

  it("émet citation-validation / route-grounding / capability-grounding", () => {
    const ctx = retrieveKnowledge("qu'est-ce que pierre et son prix", "public", 5);
    const v = validateCitations([ctx[0].id, "invented.id"], ctx);
    write("citation-validation.json", { valid: v.valid, malformed: v.malformed, labels: v.labels, note: "citation inconnue supprimée + signalée" });
    const routeCtx = retrieveKnowledge("cockpit /agents/pierre/use", "authenticated", 4);
    write("route-grounding.json", { topRoute: routeCtx[0]?.routes ?? [], grounded: routeCtx[0]?.routes?.includes("/agents/pierre/use") ?? false });
    const capPrompt = buildGroundedSystemPrompt("authenticated", "que peut faire pierre et ses limites");
    write("capability-grounding.json", { humanOnlyHidden: !capPrompt.system.toLowerCase().includes("whistleblower"), mentionsLimits: /limite/i.test(capPrompt.system) || capPrompt.contextChunks.some((c) => c.category === "limits") });
    expect(v.malformed).toContain("invented.id");
  });

  it("émet tool-coverage (branchement réel vs UNAVAILABLE)", () => {
    const rows = ALL_TOOL_NAMES.map((n) => ({ name: n, availability: TOOL_REGISTRY[n].availability, effect: TOOL_REGISTRY[n].effect, actionKind: TOOL_REGISTRY[n].actionKind }));
    write("tool-coverage.json", {
      total: rows.length,
      wired: rows.filter((r) => r.availability === "wired").map((r) => r.name),
      advisory: rows.filter((r) => r.availability === "advisory").map((r) => r.name),
      unavailable: rows.filter((r) => r.availability === "unavailable").map((r) => r.name),
      effectful_wired: rows.filter((r) => r.effect && r.availability === "wired").map((r) => r.name),
      rows,
    });
    // Tout outil effectful doit être réellement branché (jamais un effet sans backend).
    expect(rows.filter((r) => r.effect).every((r) => r.availability === "wired")).toBe(true);
  });
});

function count(xs: string[]): Record<string, number> { const o: Record<string, number> = {}; for (const x of xs) o[x] = (o[x] ?? 0) + 1; return o; }
