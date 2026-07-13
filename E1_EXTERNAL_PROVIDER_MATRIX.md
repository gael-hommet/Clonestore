# E1 — External Provider Matrix

**Nature:** every current external/live integration, classified launch‑critical / optional / later, with adapter status, sandbox availability, local fallback, missing credentials, and a safe external validation plan. **No provider added because it exists commercially** — the set follows the product vision + canonical provider requirements (P16C category C + T1/T2 + P15 provider closure). Machine copies: `.e1-proofs/external-enablement/{signature,calendar,notification,voice,telephony,sirh-payroll,connector,email-domain}-status.json`.

## Hard truth (the difference E1 never collapses)
draft ≠ sent · package prepared ≠ signed · event prepared ≠ calendar event created · transcript contract ≠ live voice · local call session ≠ real telephony · connector interface ≠ connected external system · pre‑payroll preparation ≠ payroll/DSN engine.

## Matrix

| Provider | Class | Real adapter exists | Sandbox/test | Local fallback (proven) | Missing to go live | Configured (command center) |
|---|---|---|---|---|---|---|
| **Email (Resend)** | launch‑critical | yes (`email-production/**`) | yes (sandbox mode) | mock; draft never marked sent | `RESEND_API_KEY` + verified domain (SPF/DKIM/DMARC) | `emailProviderConfigured=false` |
| **Signature (Yousign)** | launch‑critical | yes (`p15-provider-closure`) | sandbox (not configured) | document **prepared**, signed manually outside CloneStore | Yousign live (P8.7.4) OR `CLONESTORE_SIGNATURE_FALLBACK_APPROVED` | `signatureProviderConfigured=false` |
| **Calendar** | launch‑optional | yes (T1 calendar, p16c adapter) | sandbox (not configured) | event **prepared**, not created live | calendar provider connection | `calendarProviderConfigured=false` |
| **Notification / push** | launch‑optional | yes (T1 notification + T2 clonesignals) | sandbox (not configured) | in‑product cockpit reminder | push provider connection | `notificationProviderConfigured=false` |
| **Voice (CloneVoice)** | later roadmap | architecture‑ready (T2 `live_disabled`) | blocked | text authoritative; no audio | voice provider (B47+) | `voiceProviderConfigured=false` |
| **Telephony (CloneCall)** | later roadmap | local‑safe (dual‑blocked) | blocked | local call session; `dialNumber` blocked | telephony provider | `telephonyProviderConfigured=false` |
| **SIRH / payroll** | later roadmap | pre‑payroll interface | n/a | pre‑payroll preparation, disconnected | real SIRH integration (NOT a payroll engine) | `sirhPayrollProviderConfigured=false` |
| **Slack / connectors** | launch‑optional | fail‑closed interface | sandbox (not configured) | connector interface only | Slack app install/auth | `slackConnectorConfigured=false` |

## Preserved for every provider
- **Claims truth** — no live claim without live proof (per P16C + P15 provider closure).
- **Human validation** — human‑only floors (dismissal/salary/sanction) intact regardless of provider.
- **Tenant isolation** — company‑scoped; no cross‑tenant reads.
- **Audit** — per‑run trace; **idempotency** — identical runs → identical plans.

## Safe external validation plan (per provider)
Use the provider's official sandbox/test env; validate presence/shape of credentials (never the value); confirm the local fallback still fires when the live flag is off; require the specific safety flag (`EMAIL_SEND_LIVE`, `CLONESTORE_SIGNATURE_LIVE_VERIFIED`, …) before any real effect; capture a masked delivery/verification id. **No provider is exercised live in E1.**

## Launch decision
- **Launch‑critical, blocked:** email (provider + DNS), signature (Yousign live or approved fallback).
- **Launch‑optional:** calendar, push, Slack — in‑product fallbacks suffice for launch.
- **Later roadmap:** voice, telephony, SIRH/payroll — explicitly not launch blockers; `NOT_REQUIRED_FOR_LAUNCH`.
