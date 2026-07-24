# Demo Performance Matrix

**Statut : NON MESURÉ — Playwright/Lighthouse indisponibles ce bloc.** Aucun FCP/LCP/CLS/INP/TBT réel n'a été capturé. Ce document liste les métriques requises par la Phase 14 du master prompt et ce qui peut être dit à leur sujet à partir de la seule lecture de code.

| Métrique | Route | Appareil | Réseau | Avant | Après | Budget | Verdict |
|---|---|---|---|---|---|---|---|
| FCP/LCP/CLS/INP/TBT | `/`, `/demo`, `/demo/pierre` | — | — | Non mesuré | Non mesuré | — | NON TESTÉ |
| Poids JS initial | toutes | — | — | Non mesuré | Non mesuré | — | NON TESTÉ |
| Calcul ROI local et instantané | `/demo` (`CapacityCalculator`) | — | — | Déjà vrai avant ce bloc (moteur pur `cost-model.ts`, aucun appel réseau) | **Inchangé** — ce bloc n'a ajouté qu'un attribut `suppressHydrationWarning`, aucune logique de calcul modifiée | Aucun appel réseau par mouvement de slider | Conforme (par lecture de code, non chronométré) |
| Télémétrie non bloquante | `/demo`, `/demo/pierre` | — | — | Déjà vrai (analytics locale = array + CustomEvent, BLOC3 = `fetch` non bloquant avec `keepalive`, founder-access = `sendBeacon`) | Inchangé | Aucun blocage de rendu par l'analytics | Conforme (par lecture de code) |
| Nouveau composant `DemoContextualPrompt` | `/` | — | — | N/A | Un seul listener de scroll passif (`{passive:true}`), pas de calcul lourd, retourne `null` (aucun DOM) si le flag est OFF | Pas de bundle chargé avant la première preuve si le flag est OFF | Conforme par construction (flag OFF par défaut = code mort côté rendu), non chronométré |

## Recommandation
Avant le prochain bloc de mesure (ANALYTICS, FUNNEL AND LAUNCH MEASUREMENT CLOSURE), exécuter un passage Lighthouse/Playwright réel sur `/`, `/demo`, `/demo/pierre` en conditions Slow 3G/Fast 3G/latence 500ms simulées, avec le nouveau flag activé ET désactivé, pour établir une vraie baseline chiffrée.
