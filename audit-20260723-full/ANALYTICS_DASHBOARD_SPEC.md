# Analytics Dashboard Spec

Implémenté : `src/app/internal/[slug]/command-center/analytics/page.tsx` +
`src/lib/analytics/dashboard-guard.ts`. Surface **propriétaire**, jamais publique.

## Garde d'accès — identique au reste du Command Center, jamais dupliquée

Réutilise `resolveOwnerGateState`/`resolveFounderAdmin` (`founder-access/admin-guard.ts`), en
lecture seule, aucune modification. Même triple exigence que le reste du cockpit
(`isOwnerGateConfigured()` : hash mot de passe format-valide + secret cookie + slug), testée
(7 tests, `dashboard-guard.test.ts`) : slug erroné → `notfound` ; porte non configurée →
`notfound` ; porte configurée sans cookie valide → `locked` ; cookie forgé → jamais `ready`.

## Contenu affiché

- Fenêtre temporelle explicite (par défaut 30 jours), affichée en tête de page.
- Tableau funnel : 15 étapes canoniques v1, avec pour chacune visiteurs distincts, sessions
  distinctes, runs démo distincts, total événements — **jamais un seul nombre ambigu**.
- Marqueur `échantillon insuffisant` si `distinctVisitors < 10` (seuil `MIN_SAMPLE_SIZE`) — ne
  présente jamais une petite cohorte comme représentative sans avertissement visible.
- 3 taux d'étape à étape, chacun affiché avec son numérateur/dénominateur bruts entre
  parenthèses — jamais un pourcentage seul.
- Section « Santé de la mesure » : événements acceptés sur la fenêtre + répartition par niveau
  de confiance.
- Si le stockage est indisponible : message explicite (« stockage indisponible »), **jamais**
  interprété ou affiché comme « zéro visiteur ».

## Ce qui n'est jamais affiché

Aucun email, nom, IP, contenu de formulaire, liste de visiteurs nominative. Uniquement des
comptes agrégés (`count(distinct ...)`), jamais une ligne individuelle.

## Filtres — non implémentés dans ce bloc

Le master prompt liste période/source/pays/device/navigateur/route/campagne/partenaire/traffic
class/version comme filtres possibles. Le dashboard v1 livré dans ce bloc n'a **qu'un seul filtre
implicite** (fenêtre temporelle fixe, trafic externe uniquement) — les filtres interactifs sont
documentés comme non faits, pas fabriqués comme fonctionnels sans l'être.
