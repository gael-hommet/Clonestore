// PHASE 8.7.4 — the PROVEN Yousign root cause: POST /signature_requests returned 400
// `parameters_not_valid` on `external_id` because the governed anchor
// (`clonestore:<company>:<request>:<hash>`, ~101 chars, contains colons) is not provider-conformant.
// These tests pin the conformance fix at the provider boundary — no real Yousign HTTP is ever made
// (an injected fetch captures the payload).
import { describe, it, expect } from "vitest";
import { YousignSignatureProvider, conformExternalId } from "../signature-providers/yousign";

const INCIDENT_EXTERNAL_ID = "clonestore:cb8c7c2f-7dd7-49d4-b9bb-5308084b8923:88a8c598-048a-4e60-b3d3-deb86a754638:9419ba5fb7c0d1e2";

describe("conformExternalId — provider-safe, bounded, deterministic", () => {
  it("collapses the incident value to a short colon-free token", () => {
    const out = conformExternalId(INCIDENT_EXTERNAL_ID);
    expect(out).toBeDefined();
    expect(out!.length).toBeLessThanOrEqual(40);
    expect(out).not.toContain(":");
    expect(out!).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  it("is deterministic (same input → same anchor, so external_id[eq] resumes work)", () => {
    expect(conformExternalId(INCIDENT_EXTERNAL_ID)).toBe(conformExternalId(INCIDENT_EXTERNAL_ID));
  });
  it("distinct inputs → distinct anchors", () => {
    expect(conformExternalId("clonestore:a:b:c")).not.toBe(conformExternalId("clonestore:a:b:d"));
  });
  it("passes through an already-short safe value unchanged", () => {
    expect(conformExternalId("order-12345")).toBe("order-12345");
  });
  it("returns undefined for empty/nullish", () => {
    expect(conformExternalId("")).toBeUndefined();
    expect(conformExternalId(null)).toBeUndefined();
    expect(conformExternalId(undefined)).toBeUndefined();
  });
});

// Minimal injected-fetch harness — records every request; NEVER hits the network.
function harness() {
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  const fetch = async (url: string, init: { method: string; headers: Record<string, string>; body?: string | Buffer | FormData }) => {
    calls.push({ url, method: init.method, body: typeof init.body === "string" ? JSON.parse(init.body) : init.body });
    return {
      status: 201, ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ id: "req_test_1", status: "draft", data: [{ id: "req_test_1", status: "draft" }] }),
      arrayBuffer: async () => new ArrayBuffer(0),
      text: async () => "{}",
    };
  };
  return { calls, fetch };
}

describe("YousignSignatureProvider — conformant external_id on the wire (no real HTTP)", () => {
  it("createRequest sends a conformed external_id (not the raw colon anchor)", async () => {
    const { calls, fetch } = harness();
    const p = new YousignSignatureProvider({ apiUrl: "https://api-sandbox.yousign.app/v3", apiKey: "test", webhookSecret: "whsec", fetch: fetch as never });
    await p.createRequest({ name: "Contrat abc12345", signature_level: "simple", external_id: INCIDENT_EXTERNAL_ID, ordered: true, correlation_id: null } as never);
    const body = calls[0].body as { external_id: string };
    expect(calls[0].url).toContain("/signature_requests");
    expect(body.external_id).toBe(conformExternalId(INCIDENT_EXTERNAL_ID));
    expect(body.external_id.length).toBeLessThanOrEqual(40);
    expect(body.external_id).not.toContain(":");
  });
  it("findRequestByIdempotencyKey queries the SAME conformed anchor (resume consistency)", async () => {
    const { calls, fetch } = harness();
    const p = new YousignSignatureProvider({ apiUrl: "https://api-sandbox.yousign.app/v3", apiKey: "test", webhookSecret: "whsec", fetch: fetch as never });
    await p.findRequestByIdempotencyKey(INCIDENT_EXTERNAL_ID);
    const conformed = conformExternalId(INCIDENT_EXTERNAL_ID)!;
    expect(calls[0].url).toContain(`external_id[eq]=${encodeURIComponent(conformed)}`);
    expect(calls[0].url).not.toContain("%3A"); // no encoded colon → the raw anchor never reaches the API
  });
});
