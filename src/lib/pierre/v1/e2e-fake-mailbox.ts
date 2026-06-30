// src/lib/pierre/v1/e2e-fake-mailbox.ts
// PHASE 8.6 — TEST-ONLY in-memory mailbox for deterministic E2E. It is written ONLY at the PROVIDER
// boundary (the Fake email provider records each delivered message here, incl. the invitation link/token),
// so the second user can retrieve an invitation WITHOUT the raw token ever being returned by the client
// API. There is no producer-side "enqueue" shortcut: the token only ever arrives through the real P8.4
// communication pipeline (member.invited outbox → worker → provider). Module-global, test-mode only.

export type E2EMailItem = {
  id: string;
  to: string;
  kind: string;
  token?: string;
  link?: string;
  subject?: string;
  created_at: string;
};

const g = globalThis as unknown as { __pierreE2EMailbox?: E2EMailItem[] };
function box(): E2EMailItem[] { return (g.__pierreE2EMailbox ??= []); }

/** Provider boundary: record a delivered message into the mailbox (the ONLY writer). */
export function recordE2EMail(item: E2EMailItem): void { box().push(item); }

export function readE2EMailbox(filter?: { to?: string; kind?: string }): E2EMailItem[] {
  return box().filter((m) => (!filter?.to || m.to === filter.to) && (!filter?.kind || m.kind === filter.kind));
}

export function clearE2EMailbox(): void { box().length = 0; }
