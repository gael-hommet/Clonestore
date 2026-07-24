# Homepage Protected Elements — Proof of Integrity

## Hero boundary (established by cartography, `src/app/page.tsx`)
`<section id="overview" data-tour-id="homepage-primary">` — opens line 544 (+2 after this block's 2-line insertion elsewhere in the file, see below — the hero's own content lines are otherwise unchanged), closes line 648. Contains: eyebrow pills, `<h1>` slogan, body paragraph, 3 hero CTAs, 3-metric grid, `CloneCoreOrbit` visual.

## What this block touched in `page.tsx`
Exactly 2 lines added, both **outside** the hero boundary and both **before** it in source order:
1. Line ~30: `import { DemoContextualPrompt } from "@/components/home/DemoContextualPrompt";`
2. Inside `<main>`, immediately after the existing `<PresencePing event="site_viewed" />`: `<DemoContextualPrompt />`

Both are non-visual mount points (`PresencePing` renders `null`; `DemoContextualPrompt` renders `null` unless its feature flag is `"true"` AND the visitor has scrolled past 35% — default OFF in this block, see `DEMO_CONTEXTUAL_PROMPT_SPEC.md`). Neither reorders, resizes, restyles, or removes anything inside the hero.

## Proof of no change to protected content
- **Slogan**: "Gagnez du temps" / "et de l'argent." — verbatim string, still present at `page.tsx` (hero `<h1>`), never edited by this block. Verified by direct grep after all edits: the exact slogan string is unchanged.
- **Schemas/illustrations**: `CloneCoreOrbit`, `CloneCoreLegend`, `CloneTechnologyConstellation`, `CloneCockpitFlow` — all inline component definitions in `page.tsx` (lines 204-468 in the original cartography), none touched.
- **Animations**: `.clone-orbit-ring` / `.clone-orbit-ring--reverse` CSS keyframes (`globals.css`) — not touched; no CSS file was modified by this block at all.
- **Direction artistique / above-the-fold structure**: no Tailwind class, no `LiquidGlass` prop, no section reordering touched anywhere in `page.tsx`.

## Independent verification method
Since Playwright was unavailable, pixel-diff screenshots could not be produced. Instead: (1) the exact hero line range (544-648, +2 for the two unrelated insertions above it) was established by the homepage-cartography agent *before* any edit was made in this block; (2) after all edits, a direct `grep` for the slogan string and the 4 named visual-component identifiers confirms their continued presence, unchanged, at the same relative position; (3) mtime forensics (see `06-code-changes-diff-summary.md`) confirms `page.tsx`'s only touch in this block was the 2-line insertion described above — no other write to this file occurred.

## Explicitly not done
No `next/image` diffing, no visual regression tool, no frozen-animation pixel comparison — all require a real browser (Playwright), unavailable this session. This is stated plainly rather than fabricating a visual diff that wasn't actually produced.
