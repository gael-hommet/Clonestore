# Demo Browser Test Matrix

**Statut : NON TESTÉ — outil indisponible.** Playwright MCP n'a jamais résolu (`ToolSearch` vérifié en début et en cours de bloc) durant l'intégralité de ce bloc. Aucun des scénarios ci-dessous n'a été exécuté dans un navigateur réel — Chromium, Firefox, ou WebKit/Safari simulé.

| Navigateur | Viewport | Route | Scénario | Résultat | Capture/trace |
|---|---|---|---|---|---|
| Chromium desktop | 1440×900 | `/` | Scroll jusqu'au seuil, apparition du prompt (flag ON) | NON TESTÉ | — |
| Chromium mobile | 390×844 | `/` | Idem | NON TESTÉ | — |
| Chromium desktop | 1440×900 | `/demo` | Interaction slider, absence d'erreur console | NON TESTÉ | — |
| Chromium mobile | 390×844 | `/demo/pierre` | Parcours cockpit, retour vers `/demo` | NON TESTÉ | — |
| Firefox | — | — | — | NON TESTÉ (non disponible) | — |
| WebKit (Playwright) | iPhone viewport | `/demo/pierre` | — | NON TESTÉ | — |

**Honnêteté explicite requise par le master prompt** : aucune affirmation de test Safari réel sur iPhone n'est faite ici — même si Playwright avait été disponible, seul WebKit via Playwright aurait pu être testé, jamais Safari réel. Cette distinction est documentée pour éviter toute confusion future.

## Ce qui remplace la preuve navigateur dans ce bloc
Tests unitaires/composants exécutés (SSR via `renderToStaticMarkup`, logique pure) — voir `DEMO_TEST_MATRIX.md` pour le détail complet des 23+ tests couvrant le prompt contextuel, la logique d'hydratation, et l'arbitrage anti-collision. Ces tests prouvent le comportement du CODE, pas l'expérience réelle dans un navigateur.
