# P0.1 — Réconciliation avec `P0_GOVERNANCE_CLOSURE_REPORT.md`

Classification de chaque affirmation du rapport historique (2026-07-23) : **CORRECT** (toujours
vrai aujourd'hui) / **INCORRECT** (jamais vrai) / **VRAI_UNE_FOIS_PUIS_PERDU** (réellement
réalisé sur disque le 23/07, puis effacé avant le début de ce bloc) / **INVÉRIFIABLE** (ne peut
plus être établi avec les preuves disponibles).

| # | Affirmation du rapport historique | Classification | Preuve |
|---|---|---|---|
| 1 | `route.ts` avant correctif = 551 lignes, zéro correspondance de gouvernance | **CORRECT** (décrit l'état pré-existant, toujours celui retrouvé au début de ce bloc) | Lecture directe + forensique blob (`P0_1_GIT_FORENSIC_TIMELINE.md`) |
| 2 | Création de `src/lib/pierre/legacy-execute-governance.ts` (~90 lignes), réutilisant `evaluatePierreCloneGuard` + `evaluateGovernance` | **CORRECT** | Fichier présent, 97 lignes, lu en entier ce bloc — architecture exactement telle que décrite |
| 3 | `route.ts` modifié : DENY→403 `GOVERNANCE_BLOCKED`, REQUIRE_APPROVAL→202 `HUMAN_APPROVAL_REQUIRED` | **VRAI_UNE_FOIS_PUIS_PERDU** | Doit avoir existé sur disque le 23/07 pour que les 10 tests d'intégration passent comme annoncé (ils mockent `fetch` pour lever une exception s'il est appelé — un `route.ts` non gouverné les aurait fait échouer) ; absent au début de ce bloc (confirmé par lecture directe et par hash de contenu identique au commit du 24/05) |
| 4 | "Tout appel externe direct (Make.com) a été retiré du fichier" (callMake + 3 env vars MAKE_*) | **VRAI_UNE_FOIS_PUIS_PERDU** | Même raisonnement que #3 — `callMake` et les 3 `MAKE_*_WEBHOOK_URL` étaient bien présents et actifs au début de ce bloc, ce qui contredit directement cette affirmation à cette date-là — mais ils ont dû être absents le 23/07 pour que le mock `fetch` ne soit jamais déclenché |
| 5 | `src/lib/pierre/hr/cloneguard.ts` modifié additivement (kind `integration_sync` + règle `integration_sync_require`) | **CORRECT** | Confirmé présent et intact au début de ce bloc (`git status: *modified`, mtime 23/07 19:19:25, jamais retouché depuis) |
| 6 | 18 tests créés (8 unitaires + 10 intégration), tous verts | **VRAI_UNE_FOIS_PUIS_PERDU au niveau de l'exécution, CORRECT au niveau de l'existence des fichiers** | Les 2 fichiers de test existent, intacts, jamais commités, jamais modifiés depuis le 23/07 — mais ils échouaient au début de ce bloc (9/10 sur l'intégration, à cause à la fois de l'absence de gouvernance dans `route.ts` ET des 3 variables `MAKE_*` manquantes dans le `beforeAll`) ; redevenus 18/18 verts après le correctif de ce bloc |
| 7 | 6064 tests de non-régression verts | **INVÉRIFIABLE** | Aucun artefact de cette exécution du 23/07 n'a été conservé ; ni confirmable ni contredit — le sweep équivalent de ce bloc (zone Pierre) montre 5611/5613 verts (1 flake préexistant sans rapport), ce qui est cohérent en ordre de grandeur mais ne prouve pas le chiffre exact de l'époque |
| 8 | Build isolé réussi, `BUILD_ID` cité, route `execute` groupée à 13,9 Ko | **INVÉRIFIABLE** | Aucun artefact `.next-*` de cette date n'a été retrouvé pour vérifier ; ni confirmable ni contredit |
| 9 | Tableau d'inventaire des fichiers (execute/route.ts modifié, cloneguard.ts modifié, legacy-execute-governance.ts créé, 2 fichiers de test créés) | **CORRECT pour 4 des 5 lignes, VRAI_UNE_FOIS_PUIS_PERDU pour `execute/route.ts`** | Voir #2, #3, #5 ci-dessus |

## Verdict de réconciliation

Le rapport historique décrit un travail d'ingénierie réel, précis et correctement architecturé
— **il n'est pas frauduleux ni fabriqué**. La cause de l'écart n'est pas que "les tests et les
rapports avaient tort", mais que **le résultat de ce travail sur un seul fichier
(`execute/route.ts`) n'a jamais été commité et a ensuite été écrasé sur disque** par un chantier
externe concurrent de refactor lazy-init (2026-07-24), qui a réécrit le même fichier à partir
d'une base ne contenant aucune trace de la gouvernance non commitée de la veille. Voir
`P0_1_GIT_FORENSIC_TIMELINE.md` pour la preuve forensique complète et la classification retenue
(`GOVERNED_VERSION_EXISTED_AND_WAS_OVERWRITTEN`).

## Conséquence pour les rapports historiques

`audit-20260723-full/P0_GOVERNANCE_CLOSURE_REPORT.md` reçoit une bannière de supersession en
tête (voir ce fichier) — il n'est PAS supprimé, conformément à la contrainte du prompt maître.
Son contenu reste une preuve forensique utile (il documente fidèlement ce qui a été construit),
mais son affirmation de clôture ("P0 governance closure : DONE") ne décrit plus l'état réel du
HEAD tel que trouvé au début de ce bloc — seulement l'état réel du HEAD **après** ce bloc de
re-clôture.
