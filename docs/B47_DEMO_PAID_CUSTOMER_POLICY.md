# B47 — Demo vs Paid Customer Policy

## Overview

This document defines the capabilities available in demo mode vs paid customer mode. The distinction is critical for legal and commercial compliance: the demo must never trigger real actions, consume real AI budget, or expose paid capabilities.

## Pricing

| Plan | Price | Free Trial | Demo Mode |
|---|---|---|---|
| Pierre — Production | 449€/month | ❌ No 7-day open trial | Illustrative only |
| Founder pricing | 449€/month (locked) | ❌ | Illustrative only |
| Demo | Free | Unlimited | ✅ (no real actions) |

**Important**: There is no free 7-day production trial. The demo is illustrative only.

## Demo Mode: What's Blocked

The following 13 actions are permanently blocked in demo mode:

| Action | Reason |
|---|---|
| `email.send` | No real emails in demo |
| `send_email` | No real emails in demo |
| `email_live_send` | No real emails in demo |
| `official_document_export` | Documents are for viewing only |
| `pdf_export_live` | No real PDF export |
| `real_ai_generation` | No AI cost in demo (B38 cost shield) |
| `real_mission_execution` | Missions are simulated only |
| `customer_data_persist` | No long-term storage |
| `sensitive_hr_decision` | Never autonomous (demo or paid) |
| `payroll_generation` | Not available in demo |
| `cloneadn_write` | Read-only in demo |
| `clonetrace_write` | Read-only in demo |
| `payment_trigger` | No payment in demo |
| `stripe_charge` | No charge in demo |

## Demo Mode: What's Allowed

- Interactive cockpit UI (illustrative)
- Simulated AI generation (mock mode, no real cost)
- Document preview (non-exportable)
- HR workflow presentation
- Interface navigation

## Paid Customer: Capabilities Unlocked

| Capability | Demo | Paid |
|---|---|---|
| Real email send | ❌ | ✅ (with human approval) |
| Official document export | ❌ | ✅ (with human validation) |
| Real AI generation | ❌ | ✅ (B38 cost shield applies) |
| Real mission execution | ❌ | ✅ |
| Customer data storage | ❌ | ✅ |
| Sensitive HR decision | ❌ (never autonomous) | ❌ (never autonomous) |
| Paid automation | ❌ | ✅ |
| Cockpit access | ❌ | ✅ |
| CloneADN context | ❌ | ✅ |
| PDF export | ❌ | ✅ (with validation) |
| CloneTrace audit | ❌ | ✅ |
| Real budget consumption | ❌ | ✅ |

## Implementation

```typescript
// Check if an action is blocked in demo mode
import { assertDemoCannotPerformAction } from "@/lib/legal-commercial/demo-policy";
const { blocked, reason } = assertDemoCannotPerformAction("email.send");
// blocked === true

// Get full demo summary
import { getDemoCapabilitySummary } from "@/lib/legal-commercial/demo-policy";
const summary = getDemoCapabilitySummary();
// summary.demo_blocked includes all 10+ blocked actions

// Get pricing policy
import { getPierrePricingPolicy } from "@/lib/legal-commercial/pricing-policy";
const policy = getPierrePricingPolicy();
// policy.monthly_price_eur === 449
// policy.free_trial_enabled === false
// policy.founder_pricing_enabled === true
```

## Legal Notes

1. The demo is **illustrative** — not a production trial
2. No real AI budget is consumed in demo (B38 cost shield enforced)
3. No emails are ever sent from demo mode
4. The demo does not create any legal obligations or user data retention
5. Founder pricing terms must be included in CGV before launch
