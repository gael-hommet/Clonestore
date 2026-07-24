# Mobile Viewport Test Matrix

**Statut global : NON TESTÉ EN NAVIGATEUR RÉEL — Playwright MCP indisponible durant l'intégralité de ce bloc** (confirmé par `ToolSearch` en début de bloc, jamais résolu ensuite). La matrice ci-dessous documente le plan de test tel que requis par le master prompt (Phase 5), avec les viewports et routes cibles, mais sans donnée mesurée — aucune capture, aucune mesure de CLS/débordement/zone tactile n'a été produite ce bloc. Ne pas interpréter les cellules vides comme "conforme" : elles signifient uniquement "non vérifié".

## Viewports requis (aucun testé)
| Catégorie | Résolution | Testé ? |
|---|---|---|
| Téléphone compact | 320×568 | Non |
| Téléphone compact | 360×640 | Non |
| Téléphone compact | 360×800 | Non |
| Téléphone standard | 375×812 | Non |
| Téléphone standard | 390×844 | Non |
| Téléphone standard | 393×873 | Non |
| Téléphone standard | 412×915 | Non |
| Téléphone standard | 430×932 | Non |
| Tablette | 768×1024 | Non |
| Tablette | 820×1180 | Non |
| Desktop | 1280×720 / 1366×768 / 1440×900 / 1920×1080 | Non |

## Routes à capturer (aucune testée)
`/`, `/demo`, `/demo/pierre`, `/agents/pierre`, `/reserver/pierre`, `/checkout` (contrôle de non-régression visuelle uniquement, non redesigné).

## Ce qui a été vérifié à la place (analyse statique de code, pas une mesure réelle)
- **Aucun `overflow-x` global ni conteneur à largeur fixe** trouvé dans `/demo/pierre` (cartographie agent, confirmé par un test existant `pierre-demo-responsive.test.ts:37-39` asserting no horizontal-scroll patterns).
- **Structure mobile déjà différenciée** (pas seulement redimensionnée) sur `/demo/pierre` : tabs de zone cockpit en dessous de 1080px, tiroir en bottom-sheet ≤560px, CTA pleine largeur ≤560px — confirmé par lecture directe du CSS (`pierre-demo.css`).
- **Le hero homepage a déjà fait l'objet d'un ajustement mobile antérieur** (`page.tsx:579-581`, commentaire explicite sur un `clamp()` réduit pour éviter le débordement horizontal 320-430px) — préexistant, non retouché par ce bloc.
- **`100svh` + `--demo-header-height` mesuré en JS** déjà en place sur `/demo` et `/demo/pierre` (fix connu du bug de hauteur de viewport mobile), non touché par ce bloc.

## Recommandation
Cette matrice doit être exécutée réellement (captures + mesures CLS/zone tactile/débordement) dès qu'un navigateur Chromium (Playwright ou équivalent) redevient disponible, avant de considérer la couverture mobile comme prouvée. Voir `DEMO_EXTERNAL_VALIDATION_PROTOCOL.md` et `DEMO_REMAINING_RISKS.md`.
