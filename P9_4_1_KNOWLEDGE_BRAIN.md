# P9.4.1 — Knowledge Brain (grounded, bounded, cited)

**Avant (P9.4)** : 14 chunks de prose hardcodée. **Après (P9.4.1)** : registre dérivé
DYNAMIQUEMENT des vraies sources canoniques du produit — **64 chunks**, **0 catégorie
manquante**, prix/routes/employés jamais réinventés.

## Sources canoniques adaptées (`src/lib/clonechat/knowledge/sources.ts`)
| Adaptateur | Source de vérité lue (read-only) |
|---|---|
| vision | vision produit + `public-catalog.ts` |
| employees | `public-catalog.ts` (Pierre actif + `FUTURE_DEPARTMENTS` génériques) |
| technologies | `technologies/registry.ts` (`getCloneStoreTechnologyDefinitions()`) |
| prices/offers | `commercial-state.ts` (`FOUNDER_PRICE_MONTHLY` = 449 € HT/mois, fenêtre fondateur) |
| routes/pages | `nav/route-registry.ts` (`ROUTE_REGISTRY`, audience→visibilité) |
| client surfaces | onboarding/cockpit/missions/validations/salariés/documents/messagerie |
| capabilities | **P8 `hr-canon/capability-registry.ts` (read-only)** — agrégats par autonomie |
| governance | validation/permissions/isolation/confirmation |
| release state | `product-availability.ts` |
| known issues | `support-memory` SEED_REUSABLE (VÉRIFIÉS uniquement) |

## Visibilité 4 niveaux (`types.ts`)
`PUBLIC` (38) / `AUTHENTICATED_CLIENT` (24) / `INTERNAL_CLONESTORE` (2) / `RESTRICTED` (0).
`allowedVisibilities(viewer)` : public→PUBLIC ; connecté→PUBLIC+AUTHENTICATED_CLIENT.
**INTERNAL/RESTRICTED ne sont JAMAIS servis à un viewer client** (prouvé
`knowledge-visibility.json`). Les 4 capacités **HUMAN_ONLY** ne sont jamais surfacées
(`capability-grounding.json` : `humanOnlyHidden=true`).

## Honnêteté (source public-catalog)
Pierre est le **seul employé nommé/actif**. Clara/Emma/Alex/Noah/Adrien/Lucas/Sophie
sont **retirés de la surface publique** ; l'avenir = **départements génériques** (sans
nom/prix/date). Le test `knowledge-brain.test.ts` échoue si l'un est présenté comme
employé disponible.

## Récupération bornée + citations (`index.ts`)
`retrieveWithBudget(query, viewer, {limit:6, maxChars:1800})` — top-k + budget de
caractères, route exacte priorisée. Hash FNV-1a par chunk (intégrité). `diffKnowledge`
/`knowledgeSnapshot` (invalidation). `validateCitations(ids, contextChunks)` : le
serveur SUPPRIME toute citation absente du contexte réellement envoyé et la signale
`malformed` (`citation-validation.json`). L'UI affiche des étiquettes DISCRÈTES
(« D'après la page Pierre ») — jamais de chemin de fichier/table/hash.

## Coverage gate (`computeCoverage`)
21 catégories obligatoires, toutes couvertes dynamiquement (`knowledge-coverage.json` :
`complete=true, missingCategories=[]`). Le verdict « complete » est interdit si une
catégorie manque, un prix ne vient pas de la config, ou une source stale est servie.

## Preuves
`.p941-proofs/p941-run1/{knowledge-sources,knowledge-coverage,knowledge-freshness,knowledge-visibility,citation-validation,route-grounding,capability-grounding}.json` ;
tests `knowledge-brain.test.ts` (13) + `p941-proofs.itest.ts` (3).
