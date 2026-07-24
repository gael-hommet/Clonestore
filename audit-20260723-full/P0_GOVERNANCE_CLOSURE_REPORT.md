# P0 Governance Closure — Rapport de fermeture

> **⚠ SUPERSÉDÉ (2026-07-24)** — Ce rapport historique a été supersédé par
> `P0_1_EXECUTE_ROUTE_GOVERNANCE_RECLOSURE_REPORT.md` après découverte d'un écart entre les
> affirmations de clôture ci-dessous et le code présent au HEAD du 24 juillet 2026 :
> `src/app/api/pierre/execute/route.ts` avait perdu tout le câblage de gouvernance décrit ici
> (jamais commité en Git, puis écrasé sur disque par un chantier externe concurrent de
> refactor lazy-init). Le travail décrit ci-dessous était réel et a été retrouvé correctement
> architecturé (module `legacy-execute-governance.ts`, règle `cloneguard.ts`, 18 tests) — seule
> son intégration dans `route.ts` avait disparu. Voir `P0_1_GIT_FORENSIC_TIMELINE.md` (preuve
> forensique) et `P0_1_PREVIOUS_REPORT_RECONCILIATION.md` (classification affirmation par
> affirmation) pour le détail complet. Ce rapport n'est PAS supprimé — il reste une preuve
> fidèle du travail effectué le 2026-07-23, mais sa conclusion de clôture ne décrivait plus
> l'état réel du HEAD avant la re-clôture du 2026-07-24.

**Date** : 2026-07-23. **Périmètre** : fermeture du contournement de gouvernance identifié dans `CLONESTORE_ISSUE_REGISTER.md` (ISSUE-01, P0) sur `src/app/api/pierre/execute/route.ts`. Aucune refonte de Pierre, aucune nouvelle architecture de gouvernance, aucune modification du produit commercial (homepage/démo/paiement/légal). `PRODUCTION_AUTHORIZED` reste `false`.

## Résumé exécutif

La route legacy `/api/pierre/execute` exécutait `email.send` / `doc.generate` / `hris.sync` en appelant directement des webhooks Make.com, **sans aucune évaluation CloneGuard/gouvernance** — contredisant directement la règle "un email n'est jamais auto-exécuté par Pierre" appliquée partout ailleurs dans le moteur v1/hr. Après cartographie complète des appelants réels (aucun producteur n'alimente la file dont dépend son seul appelant interne `/api/pierre/tick` ; les autres usages sont des scripts de dev manuels), la route a été conservée (pas de suppression, faute de preuve absolue qu'aucun appelant externe n'en dépend) mais transformée en **adaptateur fin fail-closed** : chaque action passe désormais par les **mêmes évaluateurs purs que le moteur canonique** (`evaluatePierreCloneGuard` + `evaluateGovernance`, `src/lib/pierre/hr/{cloneguard,governance}.ts`) avant toute exécution, et **tout appel externe direct (Make.com) a été retiré du fichier**. Preuve empirique (18 tests réels, tous verts) : les trois actions résultent aujourd'hui en `DENY` ou `REQUIRE_APPROVAL` — **aucune ne peut plus déclencher un effet externe réel via cette route**, dans aucune condition testée.

## Problème initial

- **Fichier** : `src/app/api/pierre/execute/route.ts` (551 lignes avant correctif).
- **Preuve du contournement** : `grep "cloneguard|governance|requires_human|approval"` sur le fichier → 0 résultat. Le handler POST acceptait `email.send`/`doc.generate`/`hris.sync` et les transmettait directement à `MAKE_EMAIL_WEBHOOK_URL`/`MAKE_DOC_WEBHOOK_URL`/`MAKE_INTEGRATIONS_WEBHOOK_URL` via `callMake()`, seule barrière = authentification HMAC + vérification d'un `agent_configs` row (`assertPierreAccess`) — aucun filtre de contenu, aucune validation humaine, aucune classification de risque.
- **Contraste direct** : `src/lib/pierre/hr/cloneguard.ts` (règle `email_send_block`, `can_override:false`, "Les envois d'emails ne peuvent jamais être auto-exécutés par Pierre") et `src/lib/pierre/tasks/execute-task.ts` (le chemin v1 canonique bloque explicitement `email.send` avant exécution) — cette route legacy ignorait entièrement ces garanties.

## Architecture avant

Voir `P0_EXECUTION_PATH_MATRIX.md` (section "AVANT"). En synthèse : un chemin d'exécution HTTP totalement parallèle au moteur v1/hr, sans passer par aucune des couches de contrôle (CloneGuard, gouvernance, floors human-only, CloneTrace).

## Architecture canonique après

Un nouveau module pur et minimal, **réutilisant** (pas remplaçant) le moteur canonique existant :

- **`src/lib/pierre/legacy-execute-governance.ts`** (nouveau, ~90 lignes) : expose `evaluateLegacyExecuteGovernance({action, payload, now})`, qui construit un contexte CloneGuard/Gouvernance à partir de l'action legacy (utilisée directement comme `task_type`, déjà reconnue par le vocabulaire dot-notation existant), appelle `evaluatePierreCloneGuard` puis `evaluateGovernance` — **exactement le même enchaînement que `execute-task.ts`** — et retourne une décision structurée `ALLOW | REQUIRE_APPROVAL | DENY` avec les événements d'audit canoniques.
- **`src/app/api/pierre/execute/route.ts`** (modifié) : appelle ce module pour les 3 actions reconnues avant toute exécution. `DENY` → 403 `GOVERNANCE_BLOCKED`. `REQUIRE_APPROVAL` → 202 `HUMAN_APPROVAL_REQUIRED`. `ALLOW` (uniquement `doc.generate`, en théorie, si un score de confiance réel était un jour fourni) → persistance **locale uniquement** (`documents`, `doc_url:null`, `status:"generated"`), **plus aucun appel à Make.com nulle part dans le fichier**. `email.send` et `hris.sync` ont en plus une garde de sécurité absolue en dur (refus explicite) même si `ALLOW` était atteint par erreur.
- **`src/lib/pierre/hr/cloneguard.ts`** (modifié, additif) : ajout d'un type d'action `integration_sync` + règle `integration_sync_require` (require_approval, non-contournable) — **comblant un vrai gap** : `hris.sync` ne matchait auparavant AUCUNE règle et retombait sur `allow` par défaut. C'est une amélioration du module canonique partagé, pas une architecture parallèle.

Aucun autre fichier du moteur v1/hr n'a été touché.

## Stratégie choisie pour `/api/pierre/execute`

**Option B (adaptateur fin)**, et non suppression, car :
1. `/api/pierre/tick` (cron interne réel) en dépend structurellement — même si sa file `pierre_queue` n'a aujourd'hui aucun producteur (donc inerte en pratique), le supprimer casserait silencieusement ce chemin si un producteur était un jour ajouté sans que quiconque pense à corriger `tick`.
2. Deux scripts de développement (`scripts/pierre-send.mjs`, `scripts/pierre_test_hmac.mjs`) l'utilisent pour des tests manuels.
3. Impossible de prouver depuis le code seul qu'aucun système externe (Make.com configuré côté SaaS) n'appelle cette route aujourd'hui avec un vrai secret HMAC (voir `P0_REMAINING_GOVERNANCE_RISKS.md`, RISQUE-3).

## Fichiers modifiés / créés (inventaire exact)

| Fichier | Type | Résumé |
|---|---|---|
| `src/app/api/pierre/execute/route.ts` | Modifié | Gouvernance canonique branchée ; appels Make.com retirés ; env vars Make retirées ; `tryInsertDocument` corrigé pour retourner l'id réel |
| `src/lib/pierre/hr/cloneguard.ts` | Modifié (additif) | Nouveau type d'action `integration_sync` + règle `integration_sync_require` + signal + fast-path |
| `src/lib/pierre/legacy-execute-governance.ts` | **Créé** | Pont de gouvernance pur, réutilisant `hr/cloneguard.ts` + `hr/governance.ts` |
| `src/lib/pierre/__tests__/legacy-execute-governance.test.ts` | **Créé** | 8 tests unitaires |
| `src/app/api/pierre/execute/__tests__/p0-governance-closure.test.ts` | **Créé** | 10 tests d'intégration |
| `audit-20260723-full/P0_*.md` (4 fichiers) | **Créés** | Ce rapport + 3 annexes |
| `audit-20260723-full/CLONESTORE_{ISSUE_REGISTER,LAUNCH_READINESS,PIERRE_AUDIT,TECHNICAL_AUDIT,OPTIMIZATION_BACKLOG}.md` | Mis à jour | Reflet du P0 fermé |

Aucun autre fichier produit, marketing, paiement ou légal n'a été touché. `PRODUCTION_AUTHORIZED` inchangé (`false`).

## Règles de gouvernance

Décision structurée `ALLOW | REQUIRE_APPROVAL | DENY`, dérivée de `evaluateGovernance().decision` :
- `refuse` / `block` → **DENY**
- tout ce qui n'est pas `allowed_to_auto_execute` (incluant `supervised`, `require_approval`) → **REQUIRE_APPROVAL**
- sinon → **ALLOW**

Aucune branche n'interprète l'absence de décision comme une autorisation — `evaluatePierreCloneGuard`/`evaluateGovernance` renvoient toujours une décision explicite, jamais `undefined`.

## Human-only floors

Inchangés dans leur définition (`hr/cloneguard.ts`, non modifiés sauf l'ajout additif `integration_sync`) — **désormais appliqués sur ce chemin aussi**. `email.send` reste bloqué de façon non-contournable (`can_override:false`) même dans l'hypothèse où la classification amont serait un jour modifiée : une garde de sécurité absolue en dur dans `route.ts` refuse explicitement toute tentative d'envoi, indépendamment du résultat de `evaluateLegacyExecuteGovernance`.

## Idempotence

Le mécanisme existant (`request_id` + `audit_log`, best-effort) est conservé sans modification — un replay d'un `request_id` déjà enregistré `ok:true` renvoie le résultat en cache sans ré-exécuter (preuve : test I9). Un replay d'une décision `DENY`/`REQUIRE_APPROVAL` (jamais marquée `ok:true`) réévalue la gouvernance de façon déterministe et obtient le même refus, sans aucun effet de bord (rien n'avait été exécuté la première fois).

## Sécurité tenant/auth

Inchangée : authentification HMAC anti-rejeu (fenêtre 5 min, comparaison en temps constant), vérification `client_id` signé == `client_id` du corps, `assertPierreAccess` (vérifie une ligne `agent_configs` pour ce `client_id`). Ce bloc n'a pas modifié ce périmètre — il a ajouté une couche de gouvernance **après** ces contrôles, jamais à leur place.

## Tests

Voir `P0_GOVERNANCE_TEST_MATRIX.md` pour le détail complet. Synthèse : **18 tests nouveaux (8 unitaires + 10 intégration), tous verts** ; **6064 tests de non-régression existants exécutés en direct, tous verts, 0 échec**.

## Effets externes

**Preuve directe** : dans les 10 tests d'intégration, `global.fetch` est stubé pour lever une exception s'il est appelé, et chaque test vérifie explicitement `expect(fetch).not.toHaveBeenCalled()`. Tous passent — **aucun test, dans aucun scénario (y compris les cas ALLOW théoriques), n'a déclenché d'appel réseau sortant**. Le code d'appel à Make.com (fonction `callMake` et les 3 variables d'environnement associées) a été **supprimé du fichier**, pas seulement contourné par la logique — il n'existe donc plus de chemin de code possible vers un appel externe direct depuis cette route.

## Limites

- Ne couvre PAS `/api/pierre/action` ni `/api/router`, deux autres surfaces confirmées sans gouvernance (voir `P0_REMAINING_GOVERNANCE_RISKS.md`, RISQUE-1/2) — hors périmètre explicite de ce bloc par discipline de scope.
- Ne peut pas prouver l'absence d'un appelant externe Make.com configuré hors dépôt (RISQUE-3) — c'est précisément pourquoi la route a été rendue fail-closed plutôt que supprimée.
- La fragmentation de gouvernance en 4 implémentations (documentée dans l'audit initial, ISSUE-07) n'est pas résolue par ce bloc — ce correctif ferme UN contournement précis en réutilisant l'existant, il n'unifie pas l'architecture globale.

## Build de production (isolé)

`NEXT_DIST_DIR=.next-p0-closure NODE_OPTIONS=--max-old-space-size=8192 npx next build`, exécuté seul (sans Graphify/ESLint massif/agents concurrents). **Résultat : succès** — exit code 0, `BUILD_ID` généré, manifeste de routes complet (196 pages statiques + toutes les routes API, dont `/api/pierre/execute` bundlé avec succès, 13,9 Ko). Aucune erreur.

## Verdict

**Le contournement `/api/pierre/execute` est fermé.** Toute action email/document/HRIS passant par cette route est désormais évaluée par la gouvernance canonique avant exécution, et ne peut plus atteindre un système externe automatiquement — prouvé par 18 tests réels et 6064 tests de non-régression, tous verts.
