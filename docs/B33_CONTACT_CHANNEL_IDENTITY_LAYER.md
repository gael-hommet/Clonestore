# B33 — Contact & Channel Identity Layer

**Status:** Complete  
**Date:** 2026-05-24  
**Tests:** 76 passed (channels-b33: 55 + pierre-channels-b33: 21)  
**tsc:** clean  
**build:** clean

---

## What is B33?

B33 is a global, provider-agnostic channel layer reusable by all AI agents in CloneStore (Pierre and future agents). It governs every contact point a company authorizes for agent communication: email, phone, SMS, voice, WhatsApp, Teams, Slack, web forms, internal inboxes, and more.

**Core guarantee:** No real message is ever sent unless `CHANNEL_RUNTIME_MODE=production` is explicitly set AND the channel is active and verified. The default is `mock` — safe for all dev and test environments.

---

## Architecture

```
src/lib/cloneos/channels/          ← Global layer (no Pierre-specific code)
  types.ts                         — All shared types
  config.ts                        — CHANNEL_RUNTIME_MODE + env
  identity.ts                      — ChannelIdentity helpers + validation
  verification.ts                  — Ownership + verification checks
  permissions.ts                   — canSend, canReceive, rate limits
  guards.ts                        — Main send guard (7-step pipeline)
  envelopes.ts                     — MessageEnvelope builder
  events.ts                        — ChannelTraceEvent builders
  routing.ts                       — Inbound normalization + routing
  runtime.ts                       — sendChannelMessage orchestrator
  providers/
    types.ts                       — ChannelProviderAdapter interface
    mock.ts                        — Mock provider (no real sends)
  __tests__/
    channels-b33.test.ts           — 55 tests covering all modules

src/lib/pierre/channels/           ← Pierre bridge (thin, Pierre-specific)
  types.ts                         — PierreInboundChannelRequest, PierreInboundDecision
  permissions.ts                   — Pierre-specific approval rules
  route-inbound-to-pierre.ts       — routeInboundEnvelopeToPierre + preparePierreChannelSend
  (tested in: src/lib/pierre/__tests__/pierre-channels-b33.test.ts — 21 tests)

docs/sql/B33_CHANNEL_IDENTITIES.sql  — Proposed DB schema (documentation only, not executed)
```

---

## Runtime Modes

| `CHANNEL_RUNTIME_MODE` | Behavior |
|---|---|
| `mock` (default) | Simulates all sends. No real external calls. Always safe. |
| `disabled` | Blocks all sends. Use for strict lockdown. |
| `production` | Real sends via configured provider. Requires verified channel. |

---

## Security Constraints (Absolute)

1. **Never usurp an unverified channel.** `CHANNEL_ALLOW_UNVERIFIED_SEND=false` by default — unverified channels are always blocked.
2. **Never auto-send on sensitive content.** Topics matching `licenci|harcèl|disciplin|faute grave|prud'homm|discrimin|contentieux|démission` always require human validation (`approval_required=true`).
3. **Never store message body by default.** `CHANNEL_LOG_BODY=false` — body content is never written to envelopes or events unless explicitly enabled.
4. **All operations are company_id-scoped.** Multi-tenant: no cross-company data leakage.
5. **Pierre never sends automatically on `sensitive` or `blocked` risk levels.**
6. **`draft_only` and `validation_required` channels never auto-reply.**

---

## Send Guard Pipeline (7 steps)

`checkChannelSendGuards()` runs before any send:

1. **company_id present** — blocks if missing
2. **Channel status** — blocks `draft`, `pending_verification`, `suspended`, `revoked`, `failed`, `archived`
3. **Verification** — blocks `not_started`, `pending`, `failed`, `expired`, `revoked` (unless `CHANNEL_ALLOW_UNVERIFIED_SEND=true`)
4. **Direction** — blocks inbound-only channels for outbound send
5. **Owner authorization** — blocks if `requestedByUserId` not in `allowed_sender_user_ids`
6. **Permissions** — checks message type, recipient patterns, hourly + daily rate limits
7. **Risk + approval** — resolves risk level; requires human validation for `sensitive` content

---

## Key Types

```typescript
// Channel send result
type ChannelSendResult = {
  ok: boolean;
  status: ChannelEnvelopeStatus;
  provider_message_id: string | null;
  envelope: MessageEnvelope;
  blocked_reason: string | null;
  approval_required: boolean;
  trace_events: ChannelTraceEvent[];
  error: string | null;
};

// Pierre inbound routing decision
type PierreInboundDecision = {
  action: "create_mission" | "attach_to_existing_mission" | "ask_for_more_info" | "blocked_sensitive" | "ignored_not_for_pierre";
  channel_identity_id: string | null;
  matched_agent_slug: string | null;
  risk_level: ChannelRiskLevel;
  blocked_reason: string | null;
  suggested_mission_id: string | null;
  metadata: Record<string, unknown>;
};
```

---

## Usage Example

```typescript
import { sendChannelMessage } from "@/lib/cloneos/channels/runtime";

const result = await sendChannelMessage({
  identity,        // ChannelIdentity from DB
  request,         // ChannelSendRequest from caller
  usage,           // ChannelSendUsage from DB/cache
});

if (!result.ok) {
  // Log result.blocked_reason or result.error
  // Persist result.trace_events to channel_trace_events
  return;
}

if (result.approval_required) {
  // Persist result.envelope with status="pending"
  // Notify human reviewer
  return;
}

// result.status === "sent" — persist envelope + trace events
```

---

## Inbound Flow (Pierre)

```typescript
import { normalizeInboundMessage, routeInboundEnvelope } from "@/lib/cloneos/channels/runtime";
import { routeInboundEnvelopeToPierre } from "@/lib/pierre/channels/route-inbound-to-pierre";

// 1. Normalize raw webhook payload
const inbound = normalizeInboundMessage(rawWebhookBody);

// 2. Route to channel identity
const routing = routeInboundEnvelope({ envelope, registeredIdentities });
if (!routing.should_process) return;

// 3. Pierre decision
const decision = routeInboundEnvelopeToPierre({ envelope, identity });
// decision.action: "create_mission" | "attach_to_existing_mission" | "blocked_sensitive" | ...
```

---

## Environment Variables

```bash
CHANNEL_RUNTIME_MODE=mock           # mock|disabled|production (default: mock)
CHANNEL_ALLOW_UNVERIFIED_SEND=false # never true in production
CHANNEL_LOG_BODY=false              # never true unless required for compliance
CHANNEL_MAX_HOURLY_SENDS_DEFAULT=50
CHANNEL_MAX_DAILY_SENDS_DEFAULT=500
CHANNEL_DEFAULT_PROVIDER=mock
```

---

## DB Schema

See [`docs/sql/B33_CHANNEL_IDENTITIES.sql`](./sql/B33_CHANNEL_IDENTITIES.sql) — proposed schema for `channel_identities`, `message_envelopes`, and `channel_trace_events`. Not executed — for reference and future migration.

---

## Validation

```bash
npx tsc --noEmit        # clean
npm run test:channels-b33  # 76 passed
npm test                # 4541 passed
npm run build           # clean
```
