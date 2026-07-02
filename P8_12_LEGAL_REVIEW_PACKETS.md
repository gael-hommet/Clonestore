# P8.12 — Legal Review Packets

The dossiers a **qualified human legal reviewer** needs to turn officially-sourced candidate rules into `VERIFIED` rules. Pierre/Claude produces these packets; **it can never be the reviewer**.

Code: [legal-review.ts](src/lib/pierre/v1/hr-canon/country-packs/legal-review.ts) · Proof: `.p812-proofs/p812src-*/legal-review-status.json`.

## Status

- **220 review packets** generated (every required rule × jurisdiction).
- **0 VERIFIED** — no packet has a valid human attestation in this environment.
- All packets are `AWAITING_SOURCING` (official content not yet retrieved) → then `AWAITING_HUMAN_REVIEW`.

## The attestation contract (hard gate)

A rule becomes `VERIFIED` only via `verifyRuleWithAttestation()`, which requires ALL of:
1. a **named human reviewer** whose name does not match any AI/model/system pattern (Claude, GPT, LLM, AI, model, Pierre, bot, automat, system are rejected);
2. a stated **reviewer qualification** (e.g. "avocat en droit social");
3. an **ISO attestation timestamp**;
4. a **real signed artifact reference**;
5. a **non-null value** + a **source citation**.

Missing any → the rule stays unverified. This is enforced by a unit test: an attestation naming "Claude" is refused; a well-formed human attestation verifies only that one rule.

## Each packet contains

- rule key, jurisdiction, rule family;
- the official sources to consult (authority + official URL + retrieval status);
- the required source types;
- the confirmation question for the reviewer;
- packet status.

## What P8.12 cannot do

Render a positive legal verdict. Without a qualified human reviewer, every rule remains unverified and every legally-sensitive act stays blocked. This is by design — a false legal "green" is the one outcome this phase must never produce.

---

**P8.7.4 EXTERNAL YOUSIGN BLOCKER: OPEN / FINAL PRODUCTION UNBLOCK: NOT AUTHORIZED**
