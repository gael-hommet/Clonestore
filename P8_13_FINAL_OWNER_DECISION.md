# P8.13 — Final Owner Decision

**Scope:** full functional certification of the Pierre HR backend, real-customer operability, and the
final production decision — with the two dimensions kept strictly separate.

**Verdict source:** the P8.13 module run end-to-end (`p813-final-decision-gate.mjs`, proof
`.p813-proofs/p813-a32195770c/`), corroborated by a programmatic adversarial suite (6/6 survive) and
an **independent 7-agent adversarial re-audit that ruled the certification SOUND** (see
[P8_13_ADVERSARIAL_QA.md](P8_13_ADVERSARIAL_QA.md)).

---

## The two dimensions (never mixed)

| | Dimension A — Functional completeness | Dimension B — Country production authorization |
|---|---|---|
| **Question** | Can Pierre *own and execute* HR operations through a governed path? | Is a country *legally cleared* for automatic execution? |
| **Result** | **CERTIFIED — 215/215 capabilities, 0 NOT_CERTIFIED** | **WITHHELD — 0/4 countries launch-grade** |
| **Basis** | real proofs / compiling mission packs / real invocable gates / governed manual paths | needs VERIFIED rules + live providers + owner sign-off — none exist yet |

A capability being *functionally certified* means it has a **real governed path** — one of five
legitimate modes — **not** that it runs automatically. Automatic legally-sensitive execution is
Dimension B, and it is deliberately not granted.

### Dimension A breakdown (215 capabilities)

| State | Count | Meaning |
|---|---|---|
| `CERTIFIED_AUTOMATED` | 70 | verified autonomous execution |
| `CERTIFIED_AFTER_APPROVAL` | 48 | executes after human validation |
| `CERTIFIED_HUMAN_DECISION` | 40 | human decides; Pierre assists/records (incl. legally-reserved) |
| `CERTIFIED_FAIL_CLOSED` | 36 | explicitly blocks pending VERIFIED country rules (a certified behaviour, via a real invocable capability gate) |
| `CERTIFIED_MANUAL_GOVERNED_PATH` | 21 | governed manual handoff (provider not integrated) |
| `NOT_CERTIFIED` | **0** | — |

**207/207 scenarios pass on the real runtime** (packs on the real compiler + country fail-closed
variants + standalone-capability scenarios through the real capability gate / provider layer), with
**zero forbidden effects** (no fabricated provider success, no invented law, no unapproved mutation,
no auto-taken human decision).

### Dimension B breakdown (FR / BE / LU / CH)

| Country | Rules VERIFIED | Providers live | Owner sign-off | Launch-grade |
|---|---|---|---|---|
| FR | 0 | 0 | no | **NO** |
| BE | 0 | 0 | no | **NO** |
| LU | 0 | 0 | no | **NO** |
| CH | 0 | 0 | no | **NO** |

276 country rules exist as **sourced-but-unverified pointers**; **0 are VERIFIED**. No provider is
integrated. No owner has signed off. Therefore no automatic country-legal execution is authorized.

---

## The 5 owner questions — answered

**1. Does Pierre manage all of HR end-to-end?**
**YES, functionally.** All 215 capabilities across 22 domains have a governed certified path
(automated / after-approval / human decision / manual-governed / explicit fail-closed). This is
completeness of *governed paths*, not blanket automation.

**2. Does each mission produce real results / proofs / mutations?**
**YES for verified capabilities** — real mutations, documents, and communications were proven in
P8.9–P8.11. For the rest, orchestration is certified on the *real* runtime (real compiler, real
gates, real provider layer). **No result is fabricated**; where a provider or a country rule is
missing, the outcome is an honest `AWAITING_EXTERNAL` / `BLOCKED`, not a fake success.

**3. Can a real customer use Pierre without technical intervention?**
**YES for functional operations** — running missions, approvals, and manual handoffs require no code,
SQL, or provider wiring. **Automatic country-legal execution is NOT self-service** until Dimension B
is satisfied.

**4. What can launch immediately?**
The functional HR backend: **70 automated + 48 after-approval + 21 manual-governed + 40
human-decision** capabilities, plus the explicit fail-closed governance for the remaining 36.
**NOT** automatic country-legal execution, **NOT** e-signature, **NOT** payroll computation.

**5. What stays blocked, and why?**
- **Automatic country execution** — 0 VERIFIED rules → qualified human legal review required (an AI
  can never be the legal reviewer).
- **Providers** — not integrated (governed manual paths only; no fabricated API success).
- **E-signature (Yousign)** — external blocker **P8.7.4 OPEN**.
- **Production unblock** — gated behind the deploy-block + explicit owner sign-off; **never
  auto-authorized**.
- **0/4 countries** launch-grade.

---

## Production decision

> **PRODUCTION UNBLOCK: NOT AUTHORIZED.**

This is hardcoded and cannot be flipped by functional completeness. Dimension A being fully CERTIFIED
has **zero wiring** into Dimension B or the production flag — verified by the adversarial re-audit.

**To authorize a country for automatic legal execution, all of the following must hold (per country):**
1. Its required rules move `SOURCE_REQUIRED → … → VERIFIED` via qualified **human** legal review with
   archived official-source versions.
2. Its launch-grade providers are actually **integrated and live** (not manual handoff).
3. **Yousign P8.7.4** (or an equivalent qualified e-signature) is unblocked where signatures are
   required.
4. The **owner signs off** and the deploy-block is lifted deliberately.

None of these is met today. The engine is built so that the moment they are, the *same* code flips
that country to launch-grade with no rewrite.

---

## Validation

tsc clean · 12/12 certification tests · 190/190 Pierre v1 suite · 6/6 P8.13 scripts GREEN. The
terminal repository gate is a **clean serialized production build**, proven separately from the
functional certification: `.next` deleted, **TLS verification NOT disabled**, no concurrent Next
process, exactly one `npm run build` → **exit 0**, with `Compiled successfully`, TypeScript validation
completed, all **185/185** static pages generated, and every required manifest/server artifact present
(incl. `.next/build-manifest.json` and `.next/server/pages/500.html`). Zero `Build error occurred`,
zero `ENOENT`, zero `Failed to compile`. The earlier ENOENT on `.next/export/500.html` was a
build-race artifact from two concurrent builds sharing `.next`, not a source defect; with the race
removed the same file is produced cleanly. Proof:
[`.p813-proofs/p813clean-8ae6dbc1a9/clean-build-proof.json`](.p813-proofs/p813clean-8ae6dbc1a9/clean-build-proof.json)
(`ok: true`); full untruncated log: [`p813-final-clean-build.log`](p813-final-clean-build.log).

## Gate summary

`functional_complete=Y · functional_evidence_valid=Y · all_scenarios_pass_real_runtime=Y ·
customer_operable=Y · clean_serialized_build=Y · no_country_auto_authorized=Y · no_provider_live=Y ·
deploy_block_active=Y`

**Dimension A: CERTIFIED (215/215, scenarios 207/207). Dimension B: WITHHELD (0/4). Production: NOT
AUTHORIZED.**

**P8.7.4 EXTERNAL YOUSIGN BLOCKER: OPEN / FINAL PRODUCTION UNBLOCK: NOT AUTHORIZED.**
