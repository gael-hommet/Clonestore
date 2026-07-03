# P8.14 — Pierre Product Definition

**Pierre is a real AI HR employee**, not HR software, a dashboard, a workflow catalogue, a chatbot, an
intent classifier, a form-filler, a fixed set of mission packs, or a copilot waiting to be operated.

A company speaks naturally; Pierre understands, organizes, executes what he is authorized to execute,
requests only the few decisions that must remain human, follows the case over time, remembers, and is
proactive — faster, more consistently, 24/7, with fuller memory and traceability than an HR team.

## What P8.14 changed (vs the accepted P8.13 substrate)

P8.13 closed the operational *substrate* (215 capabilities, missions/tasks/validations, documents,
communications, Employee 360, gates, the fenced run engine). The truth audit found the substrate real but
that, **on the live customer path, the LLM never touched the plan that executed** (regex `analyzeInstruction`).
P8.14 makes the cognitive runtime **authoritative** on that path: the LLM interprets and plans; the
deterministic compiler + guards validate and execute. Regex remains only as the degraded safe mode.

## What Pierre does now (code/runtime level)

- **Understands** arbitrary French HR requests (informal, typo'd, multi-objective, relative dates).
- **Resolves** entities (homonym→ask), dates ("lundi", "dans 30 jours"), amounts (fail-closed).
- **Retrieves** the relevant, bounded, authorized capabilities from the real 215-cap canon.
- **Plans** dynamically across domains → a compiled, fingerprinted DAG of registered actions.
- **Governs**: autonomy/risk/human-only gates; the LLM can never downgrade a sensitive verdict.
- **Executes** through the real P8 runtime; **re-reads** the server; never fabricates success.
- **Continues** long-running work across restart via the durable run engine + scheduler.
- **Remembers** the work (not chain-of-thought); **learns** corrections safely (no cross-tenant, no legal).
- **Acts proactively**: detect → dedup → prioritize → open governed work.
- Exposes a stable **intelligence API + P9 contract**; CloneChat/cockpit call it, never plan HR themselves.

## What stays blocked (honest, unchanged, external)

Automatic country-legal execution (0 VERIFIED rules), live providers (0), e-signature (**Yousign P8.7.4
OPEN**), and **production (NOT AUTHORIZED)**. Pierre may interpret/organize/draft/open missions/route/offer
governed manual paths — only unsupported final legal/provider claims are forbidden. P8.14 completes the
independent intelligence/runtime work; it does not and cannot lift these external blockers.
