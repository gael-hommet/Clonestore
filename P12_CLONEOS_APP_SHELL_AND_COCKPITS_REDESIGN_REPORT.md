# P12 — CloneOS App Shell & Cockpits Redesign

**Date:** 2026-07-09 · **Scope:** redesign the logged-in CloneStore experience around a real, premium, no-page-scroll console — the CloneOS App Shell — with cleanly separated surfaces. Reuses the verified P8–P11 data layers; does not reopen them; no second HR brain; production untouched.

> **Verdict: P12 — CLONEOS APP SHELL & COCKPITS REDESIGN VERIFIED.**

---

## The 5 surfaces (distinct areas + routes)

| Area | Route | Role |
|------|-------|------|
| Public Site | `/` | Marketing / pricing / conversion (visitors, non-clients). |
| Mon CloneStore | `/mon-clonestore` (+ `/setup`) | **Control/admin** center: account, company, subscription, billing, country/pricing, purchased AI employees, users, footprint, security, settings, support. *Manage, not work.* Calm admin layout (may scroll). |
| Global Cockpit | `/cockpit` | Company-wide **command center** of the AI workforce + the **CloneOS command surface** (first screen). *Not Pierre's cockpit.* |
| Pierre Cockpit | `/cockpit/pierre` (+ missions/validations/documents/evidence/settings) | The **RH employee cockpit** — real P9.3 V1 missions/validations/documents/evidence/autonomy. Pierre = **employé IA RH**. |
| CloneRoom | `/cockpit/room` | The **salon**: premium operational group chat with CloneOS + Pierre + Empreinte Entreprise + technologies + memory + humans. |

Source of truth: [cloneos-app-shell-contract.ts](src/lib/clonestore/cloneos/cloneos-app-shell-contract.ts) (areas, routes, surfaces, no-page-scroll invariant, responsive modes, forbidden confusions, copy rules, CloneRoom participants, `resolveLandingRoute`).

## The CloneOS App Shell (console, no page scroll)
[CloneOsAppShell.tsx](src/components/cloneos/CloneOsAppShell.tsx) + the `cos-*` CSS block in globals.css:
- **Root** `.cos-root` = `position:fixed; 100dvh; overflow:hidden` + `body:has(.cos-root){overflow:hidden}` → **the page never scrolls; only internal panels do**.
- **Desktop (≥1600 / laptop 1280)**: 3-pane console — top bar + left rail + main work area + context pane.
- **Tablet (768)**: icon rail + context pane becomes a drawer.
- **Mobile (390)**: bottom nav (CloneOS / Missions / Validations / Employés / Mon CloneStore in 1–2 taps) + single primary surface + context as a drawer + sticky composer.
- Proven in-browser at 1280 / 768 / 390: `noPageScroll` (scroll-attempt) + `noHOverflow` all true, composer reachable, 0 console errors.

## CloneOS first screen (§5)
`/cockpit` centers the **CloneOS command surface** ([CloneOsCommandSurface.tsx](src/components/cloneos/CloneOsCommandSurface.tsx)): title *"CloneOS — Pilotez votre entreprise IA."*, composer, suggested commands ("Ouvre Pierre", "Quelles validations m'attendent ?", "Ouvre CloneRoom"…). Around it: left rail (nav) + right context pane ("ce qui compte maintenant": pending validations, missions in progress, blockers, recent result, workforce). **CloneOS routes/summarizes/coordinates; Pierre executes HR** — the surface explicitly states it and never claims HR execution.

## CloneRoom (§6)
[CloneRoomConsole.tsx](src/components/cloneroom/CloneRoomConsole.tsx): participant rail (CloneOS, Pierre — employé IA RH, Empreinte Entreprise, technologies, mémoire, humains), one composer, clear sender identity, internal-scrolling message list, and **content-carrying action extraction**: a message → "En faire une mission" / "Créer une mission RH" builds `/cockpit/pierre/missions?compose=<the message text, URL-encoded>` and **opens Pierre's real [MissionComposer](src/components/pierre/cockpit/MissionComposer.tsx) prefilled with that exact text** — the message content is genuinely transported, not a static route. CloneOS *coordinates/routes*; it does **not** parse/understand the message or autonomously create the mission (nothing is executed without your validation — no 2nd HR brain, no persistence claimed). Proven in-browser (see Gates). Not the Global Cockpit; does not replace Pierre.

> **Honest scope note:** CloneRoom is a real group-chat *shell* + a real hand-off into Pierre's composer. It is not a multi-agent simulation — only the human speaks and CloneOS returns a short coordination reply; the other participants (Empreinte, technologies, mémoire) are shown as available context sources, not autonomous speakers.

## Pierre Cockpit (§8) — no second brain
[PierreCockpitConsole.tsx](src/components/cockpit/PierreCockpitConsole.tsx) renders the **real P9.3 data** (`useOperationalCockpit`) + views (missions/validations/documents/evidence/activity/overview) + `PierreAutonomyPanel` (P9.5) inside the no-scroll shell. Pierre is framed **"Employé IA RH / équipe RH opérationnelle"**, never assistant/chatbot/copilote. Autonomy visible (settings view + context link).

## Mon CloneStore (§9) — distinct
[MonCloneStoreShell.tsx](src/components/mon-clonestore/MonCloneStoreShell.tsx): a calm admin grid (10 sections) with a clear **"Ouvrir le Cockpit"** link — visually + conceptually separate from the cockpit console (not a `cos-root`). *Manage here, work in the cockpit.*

## Routing / redirects (§2) — no auth weakening
- **Middleware** ([middleware.ts](src/middleware.ts), additive): `/cockpit*` + `/mon-clonestore*` require a session — unauthenticated → `/login?next=…` (reliable 307). Does not weaken/fake auth.
- **Fine routing** (client guard in the shell + [`/api/cloneos/landing`](src/app/api/cloneos/landing/route.ts)): connected non-client → `/agents/pierre` (purchase); ready client → stays on `/cockpit`. The pure resolver also encodes *onboarding-incomplete → `/mon-clonestore/setup`* (and it is unit-tested), but per §12 the readiness resolver uses a **safe onboarding placeholder** (`onboardingComplete = isClient`), so at runtime a paying client is always routed as onboarded — the setup redirect is intentionally **not** wired to a live signal yet (spec: "do not fake client status"; fine onboarding gating stays inside Mon CloneStore / setup). The setup page remains reachable directly.
- **Readiness resolver** ([client-readiness.ts](src/lib/clonestore/cloneos/client-readiness.ts)): real Supabase `getUser` + `hasPierreAccess`; `connected`/`isClient` are real; never fabricates client status; `onboardingComplete` is the documented safe placeholder above; safe defaults (never traps a real client out of their workspace).
- Proven in-browser: visitor → `/login`, connected non-client → `/agents/pierre`, ready client → `/cockpit` renders.

> **Honest engineering note:** in Next 15 **dev**, a server `redirect()` inside an RSC layout/page renders the page (200) instead of a 307 (streaming quirk). P12 works around it with the middleware connected-gate + a client readiness guard; `requireReadyClient()` (server) is kept for production-build correctness. Verified end-to-end in the browser.

## Adversarial review (§11)
3 independent Opus attackers ([adversarial-review.json](.p12-proofs/p12-run1/adversarial-review.json)), each told to refute every claim with file:line evidence: **13 claims → 11 HOLDS / 2 PARTIAL / 0 REFUTED, 0 security defects.** Both PARTIALs were honest over-claims and are resolved:
- **F1 — setup redirect not wired at runtime.** Spec-authorized (§12 asked for a "safe placeholder resolver — do not fake client status"). No code change; report/tests wording corrected (above) to state precisely that the setup branch is present + unit-tested but gated behind the documented onboarding placeholder.
- **F2 — CloneRoom "action extraction" was a static route.** **Really fixed** (implement, don't walk back): extraction is now content-carrying — the message text is transported into Pierre's real composer (`?compose=` → additive `initialValue` on the P9.3 composer; empty seed = unchanged P9.3 behavior). Proven in-browser (directSeed + cloneRoomFlow both `ok:true`).
- **Self-surfaced (deeper interaction proof): public footer chrome-leak.** The `cs-footer` rendered on the no-scroll console and intercepted the composer → extracted to [`SiteFooter`](src/components/site/site-footer.tsx) which hides **only** on cos-root cockpit routes (`isCockpitSurfaceRoute`); identical everywhere else, so P8–P11 surfaces (`/profile`, `/agents/pierre/use`, `/assistant`, `/mon-clonestore`, public site) are unchanged. Proven: `room.noPublicFooter` true.

## Gates
- tsc **0 source errors** · P12 tests **15** (contract 7 + shell invariants 8, incl. the content-carrying extraction test) · cloneos + pierre-cockpit + guided-tour **401/401** · non-regression **14318 passed** across `src/lib` + `src/components` — the only 5 failures are **pre-existing** and in P12-untouched files (4 in `premium-document-system.test.ts`, identical to the P9.4.2 baseline log; 1 in `fair-claim.test.ts`, an embedded-postgres timing test that passes in 5.2 s isolated).
- Browser proof **P12_SHELL_OK / pass:true** (3 viewports; redirects; no-page-scroll via real scroll-attempt; no-overflow; framing; CloneRoom 6 participants; footer not leaking; Mon CloneStore distinct; **action extraction directSeed + cloneRoomFlow both proven** — the exact message text reaches Pierre's real composer; 0 console errors; **ZERO RESIDUE**).
- **Pierre V1 runtime + P8/P9/P10/P11 HR logic untouched** (P12 adds new files + additive edits to middleware/connected-routes/globals.css/layout; the one P9.3 touch is an *additive optional prop* on MissionComposer with an empty default → unchanged behavior + untouched createMission/idempotency path) · **no second HR brain** · auth not weakened/faked · **production untouched** (PRODUCTION_AUTHORIZED still false) · no migration · nothing staged/committed/pushed/deployed.

Proofs: [.p12-proofs/p12-run1/](.p12-proofs/p12-run1/) (perimeter · tests · adversarial-review · browser-shell) · Screenshots: [docs/qa-screenshots/p12/](docs/qa-screenshots/p12/).
