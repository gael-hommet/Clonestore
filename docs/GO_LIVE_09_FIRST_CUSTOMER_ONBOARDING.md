# GO-LIVE 09 — First Customer Onboarding & Activation Polish

## Purpose

Ensures the post-payment journey is complete, correct, and production-ready:
`/paiement/success` → `/agents/pierre/setup` → `/agents/pierre/use` → première mission.

## Access State Matrix

| State | Trigger | User sees |
|---|---|---|
| `not_authenticated` | No Supabase session | Redirect to /login (useRequireAuth) |
| `not_paid` | Session OK, no active order | NoAccessGate with "Activer Pierre" CTA |
| `payment_pending` | Session OK, order not yet active | /paiement/success pending state (auto-retry) |
| `active_not_configured` | Active order, setup not saved | Setup banner + /agents/pierre/setup CTA |
| `active_configured` | Active order, setup saved | Full cockpit, first mission suggestions |
| `canceled` | Order canceled in Stripe | NoAccessGate with "Réactiver" CTA |

Active order = `status IN ('active', 'trialing')`.

## Journey Steps

### Step 1 — /paiement/success

- Displays `checking` spinner while calling `/api/checkout/confirm` then `/api/checkout?agent_slug=pierre`
- Auto-retries up to 2× at 3s intervals if `pending`
- On `active`: heading changes to "Activation confirmée. Pierre est prêt." + 3 CTAs (Accéder, Configurer, Mon CloneStore)
- "Configurer Pierre" CTA → `/agents/pierre/setup` (NOT /use)
- Step cards: Accès confirmé, **Empreinte Entreprise**, Cockpit, Contrôle

### Step 2 — /agents/pierre/setup (Empreinte Entreprise)

- Onboarding welcome banner at top: 4-step guide (Identité → Personnes → Ton → Cockpit)
- 7 form sections: identity, people, communication, policy, autonomy, messaging, memory
- On save success: "Premières missions suggérées" section with 3 mission templates
- CTAs lead to `/agents/pierre/use`

### Step 3 — /agents/pierre/use (Cockpit)

- Access check on mount: `getSessionClient` → `/api/checkout?agent_slug=pierre`
- `active` → mounts `CockpitWrapper` (which instantiates `usePierreCockpit`)
- `no_access` or `unauthenticated` → `NoAccessGate` with "Activer Pierre" + "Mon CloneStore" CTAs
- `checking` → spinner gate (not full cockpit)

### Step 4 — Première mission

- Launched from cockpit or mission template cards in setup page
- Example missions available in `PierreCommandCenter.tsx`

## Fixes Applied in GO-LIVE 09

1. `src/app/paiement/success/page.tsx` — "Configurer Pierre" CTA fixed: `/agents/pierre/use` → `/agents/pierre/setup`
2. `src/app/paiement/success/page.tsx` — "Configuration" step card renamed to "Empreinte Entreprise" with updated text
3. `src/app/agents/pierre/use/page.tsx` — Added `NoAccessGate` + `CockpitWrapper` pattern for non-paid users
4. `src/app/profile/agents/page.tsx` — `isActiveOrder` now includes `"trialing"` (was only `"active"`)
5. `src/app/agents/pierre/setup/page.tsx` — Added onboarding banner + first mission templates on save success

## Safety Constraints (unchanged from GO-LIVE 01→08)

- No Stripe live keys.
- No OpenAI calls.
- No Anthropic calls.
- No real email sending.
- No auto-write to `go-live-proofs.local.json`.
- No forbidden marketing claims (see GO-LIVE 03 prohibited phrases list).
- No "Logo" in file/component/type names.
- Responsive mobile/tablet/desktop required.

## Proof IDs

These must be verified manually and copied to `go-live-proofs.local.json`:

- `PIERRE_SUCCESS_PAGE_CTA_FIXED`
- `PIERRE_SETUP_ONBOARDING_BANNER_ADDED`
- `PIERRE_COCKPIT_ACCESS_GATE_ADDED`
- `PIERRE_PROFILE_TRIALING_FIX_APPLIED`
- `PIERRE_FIRST_MISSION_TEMPLATES_ADDED`
- `GOLIVE_09_FIRST_CUSTOMER_ONBOARDING_COMPLETED`
