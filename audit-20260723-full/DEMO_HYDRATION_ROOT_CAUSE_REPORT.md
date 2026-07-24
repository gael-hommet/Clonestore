# Demo Hydration Root Cause Report (ISSUE-04)

## Message (from the original 2026-07-23 capture)
React hydration mismatch on `style={{caret-color:"transparent"}}` for every `<input type="range">` and `<input type="number">` in the demo cost calculator (Act1/Act6), console text "This won't be patched up." Reproduced in a real desktop browser (1440px).

## Stack / affected elements
Two files contain the only `type="range"`/`type="number"` inputs in the entire `src/components/demo/` tree: `src/components/demo/cost/CapacityCalculator.tsx` (both a number and a range input per field, in `FieldRow`) and `src/components/demo/acts/ValueChapter.tsx` (one range input in its "edit assumptions" disclosure).

## Cause
**Formulation exacte, comme requis** : Cause applicative non retrouvée après recherche exhaustive. Cause externe par mutation DOM d'extension navigateur considérée comme hautement probable.

Basis for "hautement probable" (not "prouvée"):
- Exhaustive repo-wide search (every `.tsx` component, every `.css` file including `globals.css`/`demo.css`/`pierre-demo.css`) found **zero** occurrences of `caret-color` or `caretColor` anywhere in this application's own code.
- Both affected inputs are fully controlled (`value={value}`, never `defaultValue`), seeded from a constant (`ILLUSTRATIVE_INPUTS`), with no `window`/`Date`/`Math.random`/storage read influencing their initial value.
- The pure calculation/formatting engine both depend on (`cost-model.ts`) has an explicit header comment describing a deliberate decision to avoid `Intl.NumberFormat`/`toLocaleString` specifically to prevent this exact class of ICU-version-dependent hydration mismatch — evidence this codebase has already engineered around this bug class once.
- The original report's own description — **every** range/number input affected **uniformly**, regardless of field or value — is the documented fingerprint of a third-party browser extension (password manager, dark-mode, or accessibility tool) injecting a blanket style onto matching form fields before React hydrates, not of application logic (which would typically produce a mismatch scoped to specific conditional content, not a blanket property on every matching element type).

## What was NOT possible this session
Playwright MCP was unavailable for this block's entire duration (confirmed at block start, reconfirmed throughout — no `mcp__playwright__*` tool ever resolved). No comparative test was run between: a clean browser profile with no extensions, a profile with extensions enabled, and a real `hydrateRoot` client hydration. **Classified: `BROWSER_REPRODUCTION_PENDING`, not definitively closed.** A Chromium instance without extensions, if it becomes available in a future session, should attempt a byte-for-byte SSR-vs-hydrated-DOM comparison to move this from "hautement probable" to "prouvé."

## Correction applied
`suppressHydrationWarning` added to exactly 3 elements (the 2 inputs in `CapacityCalculator.tsx`, the 1 range input in `ValueChapter.tsx`), each with an inline comment stating the justification. **This must be presented as**: mitigation ciblée de trois contrôles soumis à une mutation DOM externe possible — **not** as: correction définitive d'un défaut de rendu CloneStore, since the underlying cause (browser extension) is external and cannot be "fixed" by this codebase; only its console-noise symptom is silenced for these 3 specific, individually-verified-safe elements.

## Verification performed before keeping `suppressHydrationWarning`
1. **Scope confirmed**: repo-wide grep shows exactly 3 new occurrences (2 in `CapacityCalculator.tsx`, 1 in `ValueChapter.tsx`) attributable to this block. 5 pre-existing, unrelated occurrences found elsewhere (`layout.tsx`'s `<html>` tag — a standard Next.js pattern; `FounderAccessStatus.tsx` ×4 — pre-existing, not modified by this block) were left untouched.
2. **SSR determinism confirmed**: a new test (`capacity-calculator-hydration.test.ts`) renders the component twice via `renderToStaticMarkup` and asserts byte-identical output — rules out any of our own non-determinism being masked.
3. **No caret-color of our own confirmed**: the same test asserts the rendered HTML never contains `caret-color`/`caretColor` — the only property this suppression could plausibly be needed for is one we never emit ourselves.
4. **Controlled value/attributes confirmed**: the test asserts the number input renders with the exact `ILLUSTRATIVE_INPUTS` value (`operators=4`) server-side — value/min/max/step formatting is not what's being masked; only an externally-injected style attribute is a candidate.
5. **No other property silently hidden**: `suppressHydrationWarning` was added only as a direct prop on the two `<input>` JSX elements themselves, not on any ancestor — it cannot mask a mismatch anywhere else in the component tree.

## Test preventing regression
`src/components/demo/cost/__tests__/capacity-calculator-hydration.test.ts` (4 tests, all passing): SSR determinism, no caret-color emitted, controlled value correctness, exactly 2 justified `suppressHydrationWarning` occurrences in this specific file (a 3rd exists in the sibling `ValueChapter.tsx`, verified separately by direct repo-wide grep during this investigation, not yet its own automated regression test — noted as a small remaining gap in `DEMO_REMAINING_RISKS.md`).

## No abuse of `suppressHydrationWarning`
Confirmed by direct repo-wide search (see above) that this block added it to exactly the 3 elements it justifies, nowhere else, with an inline comment on each explaining why — not a blanket suppression, not applied to a parent container, not applied "to make a warning go away" without the investigation performed above.
