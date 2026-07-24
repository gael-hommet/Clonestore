# Demo and Mobile Conversion Closure — Evidence Index

Generated 2026-07-24. Tooling note stated upfront and honestly: **Playwright MCP was unavailable for the entire duration of this block** (confirmed via ToolSearch at block start — no `mcp__playwright__*` tools resolved). Every "browser test", "viewport capture," "console scan," and "network scan" requirement in the master prompt is therefore satisfied via static code analysis, direct-code SSR rendering, and unit/integration tests instead of a live browser — and is marked **NON TESTÉE (outil indisponible)** wherever a real browser was the only way to verify it. Nothing below claims a browser-verified result that wasn't actually browser-verified.

## Contents

| File | Covers |
|---|---|
| `01-homepage-cartography-raw.md` | Full homepage section/CTA/hero-boundary/hydration-risk cartography (research agent) |
| `02-demo-pierre-cartography-raw.md` | Full `/demo/pierre` component tree, CTA, analytics, mobile-structure cartography (research agent) |
| `03-analytics-contract-audit-raw.md` | Full audit of the 3 coexisting analytics systems + identifiers + PII risk + dedup (research agent) |
| `04-mobile-utilities-audit-raw.md` | Reduced-motion, viewport-detection, PWA-prompt pattern, feature-flag convention, dvh/svh precedent (research agent) |
| `05-hydration-root-cause-investigation.md` | My own direct code investigation — every `type="range"`/`type="number"` input in the demo tree read and checked, cost-model.ts's deliberate no-Intl policy, pinned.tsx/motion.tsx/useSequentialReveal.ts's deliberate SSR-safety comments, conclusion |
| `06-code-changes-diff-summary.md` | Exact file inventory for this block |
| `07-test-results.md` | tsc / ESLint / vitest results, including the discovered pre-existing P0.1 test-fixture issue |

## Method note

Four research passes were dispatched as parallel background Explore agents (homepage, /demo/pierre, analytics contract, mobile utilities) and returned complete, file:line-cited findings — reproduced in files 01-04. The hydration-mismatch root cause (file 05) was investigated directly, not delegated, since it required judgment calls feeding directly into a code fix. No agent output was fabricated; every citation is traceable to the repo as it stood on 2026-07-24.
