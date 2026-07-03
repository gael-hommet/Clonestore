# P9.4.2 — CloneChat Closure (multi-user tenancy, atomic continuity, image pipeline, honesty)

Focused closure phase over P9.4.1. **No rebuild, no UI redesign, no P8/P8.14 change, no
Production enablement, no migration to Production, no stage/commit/push/deploy.** All
valid P9.4.1 work preserved.

## §1 — Terminal verdict corrected
`P9_4_1_FINAL_REPORT.md` header changed to **« VERIFIED WITH REMAINING CLOSURE GAPS »**
(history preserved). Gaps tracked below.

## Closure register
| # | Gap | Status | Proof |
|---|---|---|---|
| 1 | `companyId = userId` (no real company resolution) | ✅ | `server/company.ts` consumes P8 `resolveActiveCompany` (read-only) → real company + `u:<id>` fallback ; wired in route + auth |
| 2 | Non-atomic message `seq = max(seq)+1` | ✅ | `durable-store.ts` locks conversation row `FOR UPDATE` ; itest: 25 concurrent appends → seq 1..25 unique, 0 gap/dup |
| 3 | Image sanitation does not resize/recompress pixels | ✅ | `image-sanitizer.ts` uses **sharp** (already in node_modules — NO install) : decode → resize ≤1024 → recompress → strip ALL metadata ; honest chunk-strip fallback. Test: 2000px→≤1024px, bytes↓, EXIF gone |
| 4 | Effectful idempotence session-scoped (not durable cross-session) | ✅ | `clonechat_action_executions` table + `idempotency-store.ts` (atomic claim/commit) + `/api/assistant/execute` (server-computed fingerprint) + executor guard + client wiring. itest: claim→new / in_flight / duplicate / fail-releases / **cross-instance duplicate** ; unit: executor refuses on duplicate |
| 5 | Conversation-history UI not replayed in browser QA | ✅ | Browser QA (real OpenAI + durable DB + real company `e1154964`): operational mode, new conversation clears thread, history chips, **switch reloads other conversation from server**, persist after full reload. Found+fixed dup-key bug (session-unique id). `gap5-history-ui-browser.json` + screenshot |
| 6 | Migration not applied to Production + CloneChat OFF | ✅ (unchanged, by design) | operator state |

Legend: ⏳ open · �doing · ✅ closed.

_Gap 6 is an external/operator state and remains unchanged intentionally._

## Adversarial re-check (5 lenses)
Gap-1 security/isolation = **0 vulnerability** (4 confirmed attestations). **P8 perimeter = 0 modification.** All other findings addressed: seq retry-on-unique + fail-loud test (blocker was a false positive — FOR UPDATE already serializes, itest 25/25); idempotency INSERT-ON-CONFLICT is the atomic gate (no double-exec); `execute` `Date()` is server-side (false-positive); image docs strengthened + test fails if sharp absent + response exposes `engine`/`pixelResize`; observable DB-fallback `console.warn`; artifact count corrected. Details: `P9_4_2_FINAL_REPORT.md`.

## Gates
tsc **0** · build **0** (routes incl. `/api/assistant/execute`; `/assistant` 14.2 kB, pg+sharp+SDK server-only) · durable itests **10/10** · SQL durable proof **green** · **16 015** non-regression pass (only pre-existing lane-P8 `premium-document-system`/`fair-claim` fail) · ZERO RESIDUE.

## ⇒ P9.4.2 — NOT VERIFIED (reopened). Round-2 deficits
The first-round closure (above) is preserved but the terminal verdict is retracted. 7 hardening deficits:
| # | Deficit | Status |
|---|---|---|
| D1 | Company resolution silently falls back to `u:<userId>` in prod → must **fail-closed** | ⏳ |
| D2 | Idempotency identity client-influenced, day-bucketed, weak FNV-32 → **SHA-256 canonical server** | ⏳ |
| D3 | claim/execute/commit split client-side, no durable reconciliation of abandoned in-flight → **server-side ledger + lease/recovery** | ⏳ |
| D4 | Sharp transitive; prod may silently degrade → **direct pinned prod dep, mandatory resize** | ⏳ |
| D5 | Atomic conversation proof used 25 appends → **50+ across two pools + restart ordering** | ⏳ |
| D6 | Multi-user same-company / removed-member / site-scope tenancy proofs incomplete | ⏳ |
| D7 | Browser QA missing desktop/mobile/accessibility matrix | ⏳ |

_Resuming from D1 (fail-closed company) + D3/D2 (server-side durable command ledger)._
