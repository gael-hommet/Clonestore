# E1 — Legal & Country Owner Actions

**Nature:** the legal/country truth for go‑live. E1 provides **no legal sign‑off**. Every unverified legal item stays **LEGAL_ACTION_REQUIRED**; no code test can mark it approved. Sources: `src/app/legal/**` (5 DRAFT pages), `legal-page-registry.ts`, P10 legalReadiness (0/4), P13 country‑fit (PENDING_EXTERNAL), P8.13 (WITHHELD). Machine copy: [legal-country-status.json](.e1-proofs/external-enablement/legal-country-status.json).

## Launch scope + canonical prices (do NOT hardcode — resolvers exist)
- **Countries:** France, Belgium, Luxembourg, Switzerland.
- **Prices (from `country-pricing.ts` canon):** FR/BE/LU = **449 EUR/month**; CH = **499 CHF/month**. No cross‑currency; a Swiss client cannot buy the EUR offer (enforced by `canCountryBuyPrice` + the checkout guard).

## Present locally (DRAFT — not final)
All 5 legal pages exist with their required sections + a forbidden‑claims guard: `/legal/cgu`, `/legal/cgv`, `/legal/dpa`, `/legal/mentions`, `/legal/confidentialite`. **`/legal/mentions` contains explicit `Placeholder` / `À renseigner` / `Draft 1.0` markers** → `legalPlaceholdersResolved=false`.

## Owner / counsel actions (each stays LEGAL_ACTION_REQUIRED until done)
| Item | Action | Validation (no code can do this) |
|---|---|---|
| Company identity | Fill éditeur, forme juridique, capital, siège, RCS/SIREN/SIRET, VAT intra, directeur de publication, hébergeur | `/legal/mentions` free of placeholders + lawyer attests |
| CGU | Lawyer validates usage rules + AI limits (no autonomous termination/payroll/legal advice) | lawyer sign‑off |
| CGV | Lawyer validates pricing, billing, renewal, refund, liability cap | lawyer sign‑off |
| DPA | Lawyer validates RT/ST roles, sub‑processors, security, breach, DSAR | lawyer sign‑off |
| Privacy policy | Lawyer validates data categories, purposes, legal basis, retention, rights | lawyer sign‑off |
| Cookie/consent | Define policy + banner if required (CNIL/ePrivacy) | legal review |
| Per‑country labour law | FR/BE/LU/CH HR disclaimers + local law review | signed opinion per country |
| VAT/tax | Per‑country VAT treatment (EUR vs CHF, CH vs UE) | accountant/lawyer sign‑off |
| Billing entity | Confirm the legal billing entity + subprocessor list | recorded |

## Forbidden legal / product claims (must stay absent — P14 MUST_NOT)
- "Pierre garantit la conformité légale" / "remplace un avocat/juriste".
- "logiciel de paie officiel" / full payroll / DSN engine.
- "décisions de licenciement" autonomes / "résultats garantis" / "zéro erreur".
- Country legal guarantee; "production live / Stripe live / Yousign live" unverified.

## Required disclaimers (must stay present)
"validation humaine", "Pierre ne garantit pas", "ne remplace pas", RGPD rights.

## Truth
- **Legally ready CH/BE/LU/FR: NO** (0/4 launch‑grade; COUNTRY_FIT_PENDING_EXTERNAL).
- `legalSignoffObtained=false` — **never inferred from document presence**.
- The commercial promise is **operational** ("Pierre absorbs HR operational load"), not a legal guarantee.
