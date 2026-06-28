// PHASE 8.4-R1.9 — the REAL Resend adapter enforces a timeout via AbortController. A timeout is an
// AMBIGUOUS submission (the request may have reached Resend) → `timeout`, never a blind resend. A
// failure BEFORE the request was sent is a clean `network` retry. The adapter exposes no
// findByIdempotencyKey (Resend can not search by it) → the worker marks submission_unknown.
import { describe, it, expect } from "vitest";
import { ResendEmailProvider } from "../communication-providers/resend";

const input = { idempotencyKey: "communication:c:d:hash", from: "X <x@x.test>", replyTo: null, to: "to@x.test", subject: "S", plainText: "P", html: "<p>P</p>", tags: {} };

describe("R1.9 Resend real timeout + ambiguous submission", () => {
  it("a hung request is aborted by the timeout and reported as `timeout` (no blind resend)", async () => {
    const hangingFetch = (_u: string, init: { signal?: AbortSignal }) => new Promise<never>((_res, rej) => {
      init.signal?.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" })));
    });
    const provider = new ResendEmailProvider({ apiKey: "re_x", fetch: hangingFetch as never, timeoutMs: 20 });
    await expect(provider.sendEmail(input)).rejects.toMatchObject({ code: "timeout" });
  });

  it("a pre-send connection failure (not an abort) is a clean `network` retry", async () => {
    const failFetch = () => Promise.reject(Object.assign(new Error("ECONNREFUSED"), { name: "Error" }));
    const provider = new ResendEmailProvider({ apiKey: "re_x", fetch: failFetch as never, timeoutMs: 5000 });
    await expect(provider.sendEmail(input)).rejects.toMatchObject({ code: "network" });
  });

  it("the Resend adapter does NOT expose findByIdempotencyKey (forces submission_unknown, not resend)", () => {
    const provider = new ResendEmailProvider({ apiKey: "re_x" });
    expect((provider as unknown as { findByIdempotencyKey?: unknown }).findByIdempotencyKey).toBeUndefined();
  });

  it("a real {id} response is a clean submitted result with the official idempotency key sent", async () => {
    let sentIdem: string | null = null;
    const okFetch = (_u: string, init: { headers: Record<string, string> }) => {
      sentIdem = init.headers["idempotency-key"];
      return Promise.resolve({ status: 200, ok: true, headers: { get: () => null }, json: async () => ({ id: "msg_1" }), text: async () => "" });
    };
    const provider = new ResendEmailProvider({ apiKey: "re_x", fetch: okFetch as never });
    const res = await provider.sendEmail(input);
    expect(res.providerMessageId).toBe("msg_1");
    expect(sentIdem).toBe(input.idempotencyKey);
  });
});
