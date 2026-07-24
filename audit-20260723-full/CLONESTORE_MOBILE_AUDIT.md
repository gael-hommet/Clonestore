# CloneStore — Audit mobile

Audit du 2026-07-23, Playwright (Chromium), viewports réels. **Limite assumée n°1** : par contrainte de temps (compilation `next dev` extrêmement lente sous charge concurrente, voir CLONESTORE_TECHNICAL_AUDIT.md), le balayage mobile approfondi a porté sur la **homepage** (route la plus commercialement critique pour la question posée par le commanditaire) sur 3 largeurs ; `/demo`, `/agents/pierre` et `/paiement` ont été vérifiés en desktop uniquement — **NON TESTÉS en mobile réel**.

**Limite assumée n°2 (survenue en cours d'audit)** : le serveur MCP Playwright s'est déconnecté au milieu de cette session, sans possibilité de reconnexion. Le viewport Android moyen (~412×915) prévu pour compléter ce balayage, ainsi que tout test d'interaction tactile (double-clic, défilement, clavier virtuel), **n'a pas pu être exécuté** — pas par manque de temps, mais par indisponibilité pure de l'outillage navigateur pour le reste de la session. Ceci est un fait d'infrastructure de cet audit, pas une caractéristique du produit.

## Largeurs testées

| Device visé | Largeur × hauteur | Captures |
|---|---|---|
| Grand iPhone (12/13/14) | 390 × 844 | `homepage-mobile-390-abovefold.png`, `homepage-mobile-390-full.png` |
| Petit iPhone (SE) | 375 × 667 | `homepage-mobile-375x667-iphoneSE-abovefold.png` |
| Tablette portrait | 820 × 1180 | `homepage-tablet-820x1180-abovefold.png` |
| Desktop (référence) | 1440 × 900 | `homepage-desktop-1440-full.png` |

## Résultats

### 390×844 (grand iPhone)
- CTA "Voir la démo Pierre" **visible sans scroll**, en gros bouton plein, avec deux CTA secondaires juste en dessous.
- Page complète mesurée à **10 807 px de haut** (vs 7 250 px desktop) — pas une simple mise à l'échelle proportionnelle, un contenu réellement plus long en scroll mobile.
- Aucune erreur console.

### 375×667 (petit iPhone / SE)
- Le CTA principal est **juste à la limite basse du viewport** — visible mais tout juste, les deux CTA secondaires ("Découvrir les employés", "Parler à CloneChat") sont **hors champ**, nécessitant un petit scroll pour les atteindre.
- Sur cette hauteur d'écran réduite, la marge de sécurité au-dessus du pli est faible — à surveiller sur des devices encore plus petits (non testés ici, aucun n'est disponible en dessous de 375px dans cette campagne).

### 820×1180 (tablette portrait)
- Les 3 CTA et les 3 badges de confiance (24/7, Traçable, Contrôlé) sont confortablement visibles au-dessus du pli, avec de la marge.
- Rendu propre, pas de débordement horizontal observé.

## Zones tactiles et navigation

Non vérifié systématiquement (taille exacte des cibles tactiles en pixels, espacement) au-delà de l'inspection visuelle des captures — **NON TESTÉ** de façon rigoureuse (nécessiterait une mesure programmatique des `getBoundingClientRect()` de chaque élément interactif, non réalisée dans le temps imparti).

## Constat transversal avec le funnel

La page mobile est proportionnellement **plus longue** que la version desktop, et contient en son milieu une grille de 10 badges technologiques propriétaires ("Clone*") qui, empilés en une seule colonne, occupent une part disproportionnée du scroll total. Voir CLONESTORE_FUNNEL_AUDIT.md pour l'hypothèse reliant cette longueur au signal utilisateur rapporté ("ingénieur qui scrolle tout sans cliquer sur la démo").

## Ce qui n'a PAS été testé (à faire, listé explicitement plutôt que supposé bon)

- **Viewport Android moyen (~412×915)** : prévu, non exécuté — déconnexion du serveur MCP Playwright en cours de session (raison d'outillage, pas de temps).
- `/demo` en mobile (interactions tactiles sur le calculateur de coût, dont un bug d'hydratation React est déjà confirmé en desktop — impact tactile inconnu).
- `/agents/pierre` en mobile (le CTA d'achat mort confirmé en desktop — comportement tactile non vérifié séparément, mais le bug est dans le JS, donc probablement identique sur mobile).
- `/paiement`, `/checkout`, formulaires (`/login`, `/signup`, `/reserver/pierre`) en mobile.
- Clavier virtuel, orientation paysage, comportement des modales/tiroirs (dont un bug d'accessibilité "piège Tab" est confirmé en lecture de code sur `AppShell.tsx` — le tiroir de navigation mobile du produit authentifié — non vérifié à l'écran dans cette session).
- Performance/chargement réel sur réseau mobile simulé (3G/4G throttling) — non exécuté.
- Android réel (Chrome Android) — seul un viewport Chromium desktop redimensionné a été utilisé, ce qui approxime la mise en page mais ne teste ni le moteur de rendu WebKit (iOS Safari réel) ni les comportements tactiles natifs Android.
