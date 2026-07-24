# Raw finding — Commercial claims extraction across public pages

Source: read-only Explore agent, exact quotes with file:line.

## Homepage (`src/app/page.tsx`)
Slogan "Gagnez du temps et de l'argent" (L590-606, gradient hero) — **unchanged, not touched**. `<Metric value="24/7" label="Disponibilité opérationnelle">` (L636) — unqualified absolute availability claim, no SLA reference anywhere on the page. No testimonials/logos/client counts/certifications found. 12-item technology list (73-170) differs in count/curation from the demo's 15-item catalog — an internal cross-surface inconsistency, not a false claim to a visitor (no total count is ever displayed to them).

## `/demo` and `/demo/pierre`
"11h35 → 12 minutes" and "capacité libérée ~1,6M€/an" figures are consistently hedged: "Scénario illustratif — hypothèses affichées, modifiables", "Estimation — ordre de grandeur, jamais une garantie", explicit anti-overgeneralization language ("aucun chiffre n'est promis à «n'importe quelle entreprise»"). Autonomy copy always shows a partial human/AI split, never "100% autonome". "zéro erreur", "ne peut pas être piraté", "remplace un employé/salarié" — **not found anywhere** in demo copy (confirmed by both live search and the existing forbidden-claims test suite).

## `/agents/pierre`, `/questions`, `/comprendre-clonestore`
Generally well-hedged. Two items flagged:
- `/questions` FAQ ("Pourquoi Pierre vaut 449€/mois?") — originally **unqualified**: "doivent être perceptibles dès la première semaine d'utilisation" — a forward-looking, time-boxed performance guarantee with no hedge. **Fixed in this block** (see file 10) — now: "sont généralement perceptibles dès les premières semaines... selon le volume RH... un résultat individuel peut varier."
- `/comprendre-clonestore` FAQ: "Pierre peut devenir... l'équipe RH IA principale" / "Pierre peut-il remplacer une équipe RH? ... oui, selon l'organisation" — borderline replacement-adjacent language, self-hedged within the same answer ("Les humains gardent les décisions sensibles"); left as-is (already hedged in-place), flagged for owner/legal awareness rather than rewritten.

## `/partenaires` — highest concentration of quantified claims
- Hero: "20% de commission récurrente" + "89,80 € par mois sur un abonnement à 449 € HT" (a correct static calculation, not a variable projection) — the page's "chiffres estimatifs" disclaimer appears later (Economics section), not immediately adjacent to the hero figure; assessed as low-risk since the hero number is exact arithmetic, not a forecast.
- FAQ "Comment suis-je rémunéré?" states the same 89,80€ calculation without a disclaimer directly inside that FAQ answer (the qualifier lives elsewhere on the page) — noted, not rewritten (same reasoning: correct math, not a forecast).
- Metadata/OG description stated "20% de commission récurrente" without the "réellement encaissé" qualifier present in the main meta description — **fixed in this block** (OG description now matches).
- "Continuité absolue" / "Aucun oubli silencieux" card titles — absolute-sounding labels describing real, already-implemented product behavior (missions persist across sessions, tracked items stay visible) rather than a numeric outcome promise; **not matched by any existing B47 forbidden pattern**; left unedited in this block (design/positioning risk, not a factual falsehood) and logged as a P2 backlog recommendation for a future copy pass, per the master prompt's instruction not to undertake UX/design rewrites in this block.
- "Pierre est-il meilleur qu'une équipe humaine? ... ne peut pas reproduire au même coût" — balanced by a following sentence acknowledging human superiority for judgment/negotiation/sensitive decisions; left as-is.

## SEO metadata scan
Only `/partenaires` carries a bare quantified claim directly in `<meta>` (see above, now fixed for OG). All other reviewed metadata blocks state price factually, matching canonical constants; no "#1"/"guaranteed"/superlative language found anywhere.

## Prohibited-phrasing sweep (exact pattern matches)
`garanti*`, `zéro erreur`, `totalement autonome`/`100% autonome`, `jamais piraté`/`sans faille`, `certifié`, `conforme au RGPD`, `remplace un employé/salarié`, `ne peut pas se tromper` — **none found as a positive claim anywhere in public copy.** Every hit is either a test asserting absence, a legal page denying the claim, or an active guardrail definition (`claims-linter.ts`, `pierre-commercial-claims.ts`) that already blocks the exact phrase. One exception noted but **out of scope** (authenticated `/profile` cockpit page, not public): `src/app/profile/technologies/page.tsx:350` — "Gouvernance et sécurité garanties par CloneStore — ne peut pas être désactivé" — flagged in `LEGAL_REMAINING_RISKS.md` for a future pass since it sits behind auth, not on the public site this block audits.

## Summary of edits made vs. left as findings
**Fixed**: `/questions` FAQ hedge (file 10), `/partenaires` OG description qualifier (file 10).
**Documented, not edited** (design/positioning risk only, no false-fact defect, B47-forbidden-pattern engine does not flag them, out of this block's narrow scope): "Continuité absolue"/"Aucun oubli silencieux" card titles, `/partenaires` FAQ compensation answer missing an inline disclaimer, homepage "24/7" metric, `/profile/technologies` authenticated-page "garanties" wording.
