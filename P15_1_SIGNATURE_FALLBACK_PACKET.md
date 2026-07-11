# P15.1 — Signature Fallback Packet (no live e-signature)

**Purpose:** define the official signature fallback while a live e-signature provider (Yousign, P8.7.4) is **not** verified. **No live-signature claim** is made anywhere.

## The fallback flow
1. **Pierre prepares** the HR document (contract draft, amendment, letter, checklist…) — governed, under human validation.
2. **A human reviews** the prepared document in the cockpit / exports it.
3. **Signature happens manually** — printed/signed, or via an external signature tool **outside CloneStore**.
4. No electronic signature is executed inside the product; no provider is called live.

## Allowed copy ✅
- "Document préparé par Pierre, à relire et signer manuellement."
- "Document préparé — à faire valider et signer par un humain."
- "Pierre prépare le document ; la signature se fait manuellement ou via un outil externe."

## Forbidden copy ❌ (never)
- "Document signé automatiquement."
- "Yousign live."
- "Signature électronique intégrée."
- "Signature électronique live."

The forbidden phrases are enforced by `verifyNoLiveClaim()` (unit-tested) and the P15 provider closure (`liveSignatureClaimAllowed` only when `LIVE_VERIFIED`, which requires a verified live provider + owner attestation).

## When live signature becomes available
Once Yousign (or another provider) is live-verified (P8.7.4 lifted, keys + webhook + `mode==='live'` + owner attestation `CLONESTORE_SIGNATURE_LIVE_VERIFIED`), the provider closure flips to `LIVE_VERIFIED` and the copy may reflect a real e-signature. Until then, **fallback only**.

> Public paid launch may proceed on the fallback **only** if the owner explicitly approves it (`CLONESTORE_SIGNATURE_FALLBACK_APPROVED`) and all copy makes clear the signature is **prepared, not executed live**.
