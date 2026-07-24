# Raw finding — Legal entity identity search (repo-wide, beyond /legal/*)

Source: direct repo-wide grep (not a dispatched agent — this dimension had not actually been launched despite being planned; run directly in this session) + reads of prior GO-LIVE/E1 owner-input scaffolding.

## Direct search
`grep -rniE "SIREN|SIRET|RCS [A-Z]|capital social|siège social|TVA intracommunautaire|FR[0-9]{11}|numero.{0,3}immatriculation"` across the whole repo, excluding the known placeholder registry and `-proofs/` fixture noise, returned **zero real values** — every hit is one of: (a) audit/report `.md` files describing the gap itself, (b) `docs/GO_LIVE_03_*`, `E1_LEGAL_OWNER_ACTIONS.md`, `E1_OWNER_ACTION_CHECKLIST.md` — owner-input checklists asking for these fields, never containing filled values, (c) `src/lib/go-live/legal-entity/legal-entity-registry.ts` — the field registry itself (schema, not data), (d) `graphify-out/` cache artifacts, (e) unrelated code (conversion/session.ts uses "SIREN"-adjacent variable names unrelated to legal identity — false positive, confirmed not relevant).

`package.json:2` — `"name": "clonestore"` (npm package name, not a legal entity name). `.env.local` — zero company/legal/address/DPO-related variables found. No `README.md` company-identity section beyond generic project description.

## Prior GO-LIVE / E1 documents (all owner-input scaffolding, never filled)
- **`docs/GO_LIVE_03_GAEL_LEGAL_INFO_TO_FILL.md`** — an operational checklist of the exact 11 fields still needed (company_name, legal_form, capital, siren, address, publication_director, contact_email, privacy_email, hosting_provider, vat_number, applicable_law), each with an example and instructions to obtain it from the greffe/expert-comptable/avocat — **explicitly instructs never to invent these values**. Ends with: run `node scripts/legal-public-copy-scan.mjs` after filling, get a lawyer review, and "ne jamais marquer LEGAL_HUMAN_REVIEW_COMPLETED sans confirmation d'un avocat."
- **`E1_LEGAL_OWNER_ACTIONS.md`** — states plainly: "E1 provides no legal sign-off. Every unverified legal item stays LEGAL_ACTION_REQUIRED." Confirms `legalPlaceholdersResolved=false`, `legalSignoffObtained=false`, "0/4 launch-grade" for FR/BE/LU/CH. Lists forbidden claims that must stay absent and required disclaimers that must stay present.
- **`E1_OWNER_ACTION_CHECKLIST.md`** — sequenced owner-only actions (legal entity, DNS, Supabase prod, Stripe live, email/DNS, signature, monitoring, deployment, production authorization). Item 1: "Legal entity + counsel (LEGAL_ACTION_REQUIRED)" — same 8 fields, same instruction to never bypass identity requirements.

## Conclusion
This block's own search independently confirms (does not merely repeat) that **zero real legal-entity values exist anywhere in this repository**, across three independent discovery paths (this session's grep, the legal-pages agent's page-content read, and these pre-existing owner-input documents). No new value was invented in this block; every missing field is carried into `OWNER_LEGAL_INPUT_REQUIRED.md` unchanged in substance from what these prior documents already specify, cross-referenced rather than duplicated.
