# P0.1 — Execute Route Governance Re-Closure — Verdict final (24 questions)

**1. Une version gouvernée de `/api/pierre/execute` a-t-elle existé dans l'historique Git ?**
Non, jamais dans un commit. Une version gouvernée a existé, mais uniquement dans l'arborescence
de travail non commitée du 2026-07-23 (61 commits vérifiés par hash de contenu, 2026-05-24 →
2026-07-24, aucun ne contient de gouvernance sur ce fichier).

**2. Si oui/en partie, comment et quand a-t-elle disparu du HEAD actuel ?**
Elle n'a jamais été dans le HEAD au sens Git — mais elle a disparu de l'**arborescence de
travail** entre le 2026-07-23 (22h02, dernière trace P0.2 intacte) et le 2026-07-24 16:44:32
(mtime de `route.ts`), très précisément dans la fenêtre des commits externes concurrents
`bea7a7dd1`/`0b3d79e61` (refactor lazy-init), qui ont réécrit ce fichier à partir d'une base ne
contenant aucune trace de la gouvernance non commitée de la veille.

**3. Si le code n'avait jamais existé, pourquoi les anciens rapports/tests l'affirmaient-ils ?**
Ce n'est pas le cas — le travail décrit dans `P0_GOVERNANCE_CLOSURE_REPORT.md` était réel et
détaillé avec précision (noms de fichiers exacts, comptages de lignes, architecture correcte).
Le module `legacy-execute-governance.ts` et ses 18 tests existent réellement, intacts,
non commités. Seule l'intégration dans `route.ts` lui-même a été perdue — voir
`P0_1_PREVIOUS_REPORT_RECONCILIATION.md`.

**4. Classification retenue pour la cause de l'écart ?**
`GOVERNED_VERSION_EXISTED_AND_WAS_OVERWRITTEN` — voir `P0_1_GIT_FORENSIC_TIMELINE.md` pour la
preuve forensique complète (deux méthodes indépendantes convergentes).

**5. Le HEAD final empêche-t-il désormais tout dispatch externe non gouverné ?**
Oui. `callMake` et les 3 URLs `MAKE_*_WEBHOOK_URL` ont été retirés entièrement du fichier
(aucun chemin de code de dispatch ne subsiste physiquement) ; le seul cas hypothétique où le
moteur retournerait `ALLOW` aboutit à un refus explicite `501 EXECUTION_NOT_AVAILABLE`, jamais
à un appel réseau.

**6. La route appelle-t-elle désormais le moteur de gouvernance canonique ?**
Oui — `evaluateLegacyExecuteGovernance` (réutilisé tel quel, aucun second évaluateur créé),
lequel enchaîne `evaluatePierreCloneGuard` puis `evaluateGovernance`, le même chemin que le
pipeline mission/tâche canonique (`execute-task.ts`).

**7. La décision pour `email.send` est-elle correcte ?**
Oui — `DENY` inconditionnel (403, `GOVERNANCE_BLOCKED`), floor CloneGuard non-contournable
(`email_send_block`, `can_override:false`), confirmé par 3 tests indépendants (unitaire,
intégration, transversal).

**8. La décision pour `hris.sync` est-elle correcte (jamais ALLOW) ?**
Oui — `integration_sync_require` impose `REQUIRE_APPROVAL` par défaut, et un **plancher route
supplémentaire indépendant du moteur** force `REQUIRE_APPROVAL` même si le moteur retournait
`ALLOW` par erreur. Confirmé par tests unitaires + intégration + transversaux.

**9. La décision pour `doc.generate` est-elle correcte ?**
Oui — `REQUIRE_APPROVAL` (202, `HUMAN_APPROVAL_REQUIRED`), CloneTrust retombant sur un niveau de
confiance bas par défaut en l'absence de contexte réel câblé sur cette route legacy ; aucune
écriture `documents`, aucun appel réseau.

**10. Le dispatch Make est-il encore atteignable depuis cette route ?**
Non — recherche exhaustive confirmée : 0 référence à `callMake`/`MAKE_*_WEBHOOK_URL` dans tout
`src/` après correctif.

**11. Les variables d'environnement Make sont-elles encore nécessaires à une décision de
sécurité ?**
Non — elles ont été retirées de `getRuntime()` ; seules 3 variables (Supabase ×2 +
`ROUTER_HMAC_SECRET`) sont désormais requises, aucune n'est liée à Make.

**12. L'authentification HMAC est-elle intacte ?**
Oui — `assertRouterAuth` (signature + anti-rejeu 5 min) inchangée bit pour bit, testée (401 sur
absence/invalidité de signature).

**13. Le contrôle d'entitlement (`assertPierreAccess`) est-il intact ?**
Oui — inchangé, testé (403 `FORBIDDEN` si `agent_configs` absent).

**14. L'idempotence est-elle intacte et correctement délimitée ?**
Oui, et **précisément scopée** : elle rejoue uniquement un résultat déjà `ok:true` d'une
exécution passée (pas un contournement de la gouvernance pour une nouvelle action) — testée à
la fois pour le rejeu simple et pour la concurrence (deux requêtes simultanées, même
`request_id`, pas encore en cache → gouvernance évaluée pour chacune, jamais de dispatch).

**15. `/api/pierre/action` (P0.2) est-il toujours gouverné ?**
Oui — inchangé, 9 tests d'intégration + les 3 tests transversaux confirment une décision
identique à `execute` pour les mêmes actions (même module partagé).

**16. `/api/router` (P0.2) est-il toujours neutralisé ?**
Oui — 410 Gone inconditionnel, inchangé, 3 tests verts, confirmé par le test transversal
qu'aucune branche d'exécution Pierre n'existe plus dans ce fichier.

**17. Toutes les surfaces ont-elles été re-cartographiées ?**
Oui — `execute`, `action`, `run`, `router`, plus les 2 appelants internes réels (`tick`,
confirmé et déjà cité par le rapport historique ; `run`, nouvellement cartographié, boucle
`generate→execute`). Aucune 5ᵉ surface active trouvée. Détail : `P0_1_CALLER_AND_SURFACE_MATRIX.md`.

**18. Statut de la suite de tests P0.1 ?**
18/18 verts (8 unitaires + 10 intégration) — comptage identique à celui annoncé par le rapport
historique, réellement exécuté cette fois.

**19. Statut des tests transversaux P0.1/P0.2 ?**
15/15 verts (3 transversaux + 9 P0.2/action + 3 P0.2/router).

**20. Statut de la non-régression (comptages séparés, non cumulés) ?**
Zone Pierre complète : 5611/5613 verts (1 flake de parallélisme préexistant sans rapport,
confirmé vert en isolation ; 1 ignoré). `npm test` (périmètre majoritairement hors Pierre) :
9165/9165 verts. Ces deux totaux et les lots 1/2 ci-dessus se recouvrent partiellement — jamais
additionnés (détail : `P0_1_TEST_MATRIX.md`).

**21. Statut TypeScript ?**
`tsc --noEmit` : 0 erreur sur l'ensemble du dépôt.

**22. Statut ESLint ?**
0 finding sur les 2 fichiers modifiés (scope exact du changement).

**23. Statut du build de production isolé ?**
Vert après une relance (1ʳᵉ tentative : échec environnemental, contention mémoire système, sans
rapport avec le code — schéma déjà documenté dans plusieurs blocs précédents de cette session).
`BUILD_ID=q9cJcei7BiG1AL_u47dDK`, les 4 routes cibles confirmées présentes et bundlées, 0 erreur
dans la sortie. Le succès du build ne dit rien à lui seul de la gouvernance — c'est la suite de
tests (18/18 etc.) qui la prouve, pas la compilation.

**24. `PRODUCTION_AUTHORIZED` est-il resté inchangé ?**
Oui — toujours `false as const` (`src/lib/clonestore/production/p10-production-gate.ts:15`),
non touché par ce bloc.

---

## Documentation réconciliée

`P0_GOVERNANCE_CLOSURE_REPORT.md` a reçu une bannière de supersession (contenu conservé, non
supprimé). `P0_1_PREVIOUS_REPORT_RECONCILIATION.md` classe chaque affirmation historique. Les 6
fichiers généraux (`CLONESTORE_FULL_AUDIT.md`, `CLONESTORE_TECHNICAL_AUDIT.md`,
`CLONESTORE_LAUNCH_READINESS.md`, `CLONESTORE_ISSUE_REGISTER.md`,
`CLONESTORE_OPTIMIZATION_BACKLOG.md`, `DEMO_REMAINING_RISKS.md`) sont mis à jour ; ISSUE-40
fermée, ISSUE-01 marquée re-fermée avec son historique complet de régression documenté.

## P0.1 est-il réellement clos ?

**Oui.** Les 4 questions centrales du prompt maître ont une réponse ferme et prouvée (pas
devinée) ; la gouvernance est réellement câblée et testée bout-en-bout ; aucun dispatch externe
n'est atteignable ; les rapports historiques sont réconciliés sans suppression ; le lazy-init
externe légitime est préservé ; les 4 tentations de raccourci interdites par le prompt maître
(Make avant gouvernance, exiger DENY seulement via absence d'env, appeler `callMake` avant
décision finale, laisser une action inconnue atteindre un webhook) sont toutes vérifiées
absentes par construction et par test.

## Risques résiduels (non bloquants pour cette clôture)

Voir `P0_1_REMAINING_RISKS.md` : R1 (`run/route.ts` hérite sans logique propre), R2 (`tick`
secret partagé, pas HMAC — hors périmètre), R3 (aucun contexte CloneTrust réel câblé sur cette
route legacy — ALLOW restera toujours inatteignable tant que non conçu), R4 (réintroduction
future du connecteur nécessitera une revue délibérée), R5 (aucun commit Git réel n'existe encore
— risque de perte répétée tant que `git.exe` reste bloqué dans cet environnement), R6 (flake de
test préexistant sans rapport).

## Le bloc ANALYTICS, FUNNEL AND LAUNCH MEASUREMENT CLOSURE peut-il démarrer ?

**Oui.** P0.1 est fermé avec preuve complète, aucun blocage résiduel de ce bloc n'empêche le
démarrage du prochain chantier.
