# Demo Three-State Reconciliation

## A. Version régressive (actuellement DÉPLOYÉE sur clonestore.pro/demo)

- Premier écran = `Act1Opening` (`id="demo-act-open"`) : hero institutionnel
  « N'achetez plus seulement des logiciels. Ouvrez des postes d'employés IA. » + lede + contrat de
  lecture.
- Pas de choc de valeur en premier écran, pas de chiffre fort immédiat.
- **Origine** : build déployé antérieur à `90932a0bc` (ère `≤ 02cf93180`, 2026-07-13).
- **N'existe plus comme premier écran dans le dépôt** (le blob committé est value-first depuis
  `90932a0bc`). Le texte de `Act1Opening` subsiste, mais en **2ᵉ** chapitre.

## B. Dernière bonne version value-first (dépôt committé, HEAD actuel)

- Premier écran = `ValueShock` (`id="demo-act-choc"`, « La preuve ») :
  - **11 h 35 de travail humain → 12 min d'attention humaine** (chiffres monumentaux) ;
  - **« Jusqu'à 1,6 M€ de capacité libérée par an »** (scénario groupe multi-sites) ;
  - « CloneStore ouvre des postes d'employés IA qui prennent en charge des missions entières » ;
  - CTA « Voir ce que Pierre absorbe ».
- Texte minimal, narration visuelle, value shock avant l'explication.
- **État du dépôt = cette version.** Prouvé visuellement (desktop + mobile).

## C. État Analytics récent (à préserver)

Branché dans `DemoExperience.tsx` (commit `90932a0bc` + corrélation) — **canonique, additif** :
- `track("demo_started" | "demo_completed" | "demo_step_completed" | "demo_pierre_reveal_viewed" |
  "discover_pierre_clicked", …)` ;
- `newDemoRunId("demo")` → un `demo_run_id` par exécution (guard ref, insensible au double-montage
  Strict Mode) ;
- `stepId` = identifiant de scène fermé (`demo-act-*`), **jamais `textContent`, jamais texte libre** ;
- déduplication par run (`dedupeKey`), best-effort, aucune PII ;
- émissions legacy (`emitDemoEvent`/`emitConversionEvent`/`emitFounderEvent`) conservées en
  parallèle — le funnel canonique ne lit que `clonestore_analytics_events_v1`, donc aucun double
  comptage.

## Réconciliation

**B (bonne version value-first) est DÉJÀ l'état du dépôt, et C (Analytics) y est DÉJÀ branché**
sur cette même version. Il n'y a pas de « mélange » à faire : le dépôt = B + C. A n'existe que sur
le déploiement périmé. Le résultat attendu (« bonne démo validée + Analytics actuelle ») est donc
**déjà réalisé** dans le dépôt — aucune troisième version inventée.
