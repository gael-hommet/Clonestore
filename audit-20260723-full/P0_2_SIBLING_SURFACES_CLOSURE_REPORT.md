# P0.2 Sibling Execution Surfaces Closure — Rapport de fermeture

**Date** : 2026-07-23. **Périmètre** : fermeture des deux surfaces confirmées par P0.1 comme ayant le même défaut de gouvernance que `/api/pierre/execute` : `src/app/api/pierre/action/route.ts` et `src/app/api/router/route.ts` (ISSUE-38/39). Strictement backend/gouvernance/sécurité/tests — aucune modification du produit commercial, de la homepage, de la démo, du paiement ou des pages légales. `PRODUCTION_AUTHORIZED` inchangé (`false`).

## Résumé exécutif

Les deux surfaces avaient en commun **zéro référence à CloneGuard/gouvernance** (confirmé par grep), mais des profils très différents :

- **`/api/pierre/action`** : route moderne, bien construite (auth Bearer Supabase réelle, entitlement sur `orders` — la table canonique, résolution d'identité, pièces jointes, journalisation `agent_history`), mais qui dispatchait `email.send`/`doc.generate` directement vers Make.com sans aucune évaluation de risque ni approbation humaine — et sans aucune protection d'idempotence (un double-clic aurait envoyé deux emails réels). Aucun appelant produit actuel confirmé, mais son degré de finition ne permet pas de conclure au code mort avec certitude → **traitée avec précaution (Option B, adaptateur fin)**.
- **`/api/router`** : route ancienne, générique (accepte n'importe quel payload pour n'importe quel "agent"), avec une URL de webhook Make **codée en dur en clair dans le source**, un jeton d'authentification comparé contre une table (`api_tokens`) **absente de toute migration suivie**, et un modèle d'entitlement (`agents_owned`) divergent du reste du produit. **Zéro appelant** trouvé nulle part dans le dépôt (grep exhaustif) → **neutralisée (Option A, 410 Gone)**.

Les deux corrections réutilisent **exclusivement** le module créé en P0.1 (`evaluateLegacyExecuteGovernance`), sans dupliquer de règle métier ni créer de nouvelle architecture de gouvernance.

## Cartographie de `/api/pierre/action`

Voir `P0_2_EXECUTION_SURFACES_MATRIX.md` et `P0_2_CALLER_INVENTORY.md`. En synthèse (fichier:ligne, avant correctif) :
- Auth : `getAuthenticatedUser` (L309-329), Bearer Supabase réel.
- Entitlement : `hasPierreAccess` (L331-353), table `orders`, `status in (active, trialing)`.
- Validation : `validateBody` (L451-537), schémas stricts email/document.
- **Aucune évaluation de risque** entre la validation du payload et l'appel `fetch(webhook.url, ...)` (L903 avant correctif) — confirmé par grep `cloneguard|governance|CloneGuard|evaluateGovernance` = 0 résultat sur le fichier complet (1037 lignes).
- Webhooks : `MAKE_PIERRE_ACTION_WEBHOOK_URL` / `MAKE_PIERRE_EMAIL_WEBHOOK_URL` / `MAKE_PIERRE_DOC_WEBHOOK_URL` (`resolveWebhook`, L264-291) — un jeu de variables distinct de celui retiré d'`/api/pierre/execute` en P0.1, confirmant une architecture de dispatch réellement parallèle (troisième occurrence du même motif).
- Idempotence : **absente** — `buildRequestId()` (L167-169) génère un ID serveur FRAIS à chaque appel HTTP ; aucun mécanisme ne permettait de détecter un doublon avant ce correctif.

## Cartographie de `/api/router`

Voir mêmes documents. En synthèse (avant correctif) :
- Auth : jeton opaque comparé via `.eq("token", token).eq("active", true)` contre `api_tokens` (L138-142) — table absente de `supabase/migrations/` (confirmé par grep).
- Entitlement : `agents_owned` (L171-176), clé `client_id`+`agent_name` — schéma divergent de `orders` (clé `user_id`+`agent_slug`) utilisé par `/api/pierre/action` et le reste du produit.
- URL Make **codée en dur** (L12) : `const MAKE_WEBHOOK_URL = "https://hook.eu2.make.com/..."` — un vrai secret/URL exposé dans le code source, pas seulement en variable d'environnement.
- Dispatch : n'importe quel `payload` pour n'importe quel `agent` string est forwardé tel quel (L83-94) — aucune classification d'action possible, donc aucune gouvernance ne pouvait être branchée sans changer le contrat d'entrée.
- **Zéro appelant** : `grep -r "/api/router" src/ scripts/ docs/` → 1 seul résultat, le fichier lui-même.

## Appelants

Voir `P0_2_CALLER_INVENTORY.md` pour le détail complet et la distinction appelant produit / documentation / aucun.

## Architecture avant

Trois architectures de dispatch Make.com parallèles pour des actions Pierre, chacune avec son propre jeu de variables d'environnement et son propre modèle d'authentification, aucune ne passant par CloneGuard/gouvernance :
1. `/api/pierre/execute` — fermée en P0.1.
2. `/api/pierre/action` — fermée dans ce bloc.
3. `/api/router` — neutralisée dans ce bloc.

## Stratégie choisie pour chaque route

- **`/api/pierre/action` → Option B (adaptateur fin)**. Conservé : auth, entitlement, validation, structure de réponse, dispatch Make (branche désormais inatteignable en pratique, conservée pour le cas où un contexte de confiance réel serait fourni un jour — même logique qu'en P0.1). Ajouté : appel à `evaluateLegacyExecuteGovernance` (réutilisé tel quel de P0.1) juste avant la résolution du webhook ; idempotence best-effort via un `request_id` optionnel vérifié contre `agent_history`.
- **`/api/router` → Option A (neutralisation)**. Fichier conservé (pas supprimé, pour rester réversible et donner un signal HTTP explicite `410 Gone` plutôt qu'un 404 ambigu à un éventuel appelant externe historique). Tout le code d'auth/entitlement/dispatch Make retiré, y compris l'URL codée en dur.

## Architecture après

Un seul module de gouvernance (`src/lib/pierre/legacy-execute-governance.ts`, créé en P0.1, **non modifié** dans ce bloc) est désormais consulté par **deux** routes API distinctes (`/api/pierre/execute`, `/api/pierre/action`) avant tout effet externe potentiel. La troisième route (`/api/router`) n'a plus aucun chemin d'exécution du tout. Aucune nouvelle règle métier n'a été ajoutée à CloneGuard dans ce bloc (contrairement à P0.1 qui avait ajouté `integration_sync_require`) — la vocabulaire existant (`email.send`, `doc.generate`) suffisait.

## Auth, tenant, entitlement

Inchangés et déjà corrects sur `/api/pierre/action` (Bearer Supabase réel, `orders`) — ce bloc n'a pas eu besoin de les durcir, seulement d'ajouter la gouvernance en aval. Sur `/api/router`, l'ensemble du mécanisme d'auth/tenant a été retiré avec la route elle-même (neutralisée), donc sans objet.

## CloneGuard / Gouvernance

`email.send` sur `/api/pierre/action` : **DENY** garanti (même floor non-contournable qu'en P0.1). `doc.generate` : **REQUIRE_APPROVAL** en pratique (CloneTrust "supervised" faute de contexte de confiance réel — identique au constat empirique de P0.1). Preuve : tests A4/A5 (`P0_2_TEST_MATRIX.md`).

## Human-only floors

Inchangés dans leur définition (`hr/cloneguard.ts`, non modifié dans ce bloc) — désormais appliqués sur `/api/pierre/action` aussi, via le même mécanisme qu'en P0.1.

## Effets externes

**Preuve directe** : dans les 12 tests d'intégration des deux routes, `global.fetch` est stubé pour lever une exception s'il est appelé ; chaque test vérifie explicitement `expect(fetch).not.toHaveBeenCalled()`. Tous passent. Le code d'appel à Make.com dans `/api/router` a été **supprimé du fichier** (pas seulement contourné) ; celui de `/api/pierre/action` est désormais précédé d'une porte de gouvernance qui, empiriquement, ne le laisse jamais s'exécuter en l'absence de contexte de confiance réel.

## Idempotence

`/api/pierre/action` dispose désormais d'une protection best-effort (`request_id` optionnel + vérification contre `agent_history`, même esprit que P0.1) — preuve tests A7/A8. `/api/router` neutralisée : la question ne se pose plus, aucune exécution n'est possible sous aucune forme.

## Secrets et tokens

L'URL Make codée en dur dans `/api/router` (`hook.eu2.make.com/...`) a été **retirée du code source** — plus aucune trace dans le fichier (vérifié par test R3, lecture directe du fichier). Aucune valeur réelle n'apparaît dans ce rapport ni dans les fichiers de preuve.

## Tests

Voir `P0_2_TEST_MATRIX.md`. Synthèse : **15 tests nouveaux** (9 intégration `/api/pierre/action` + 3 intégration `/api/router` + 3 transversaux), **tous verts**. **5615 tests de non-régression exécutés en direct** (`src/lib/pierre/**` + `src/app/api/pierre/**` + `src/app/api/router/**`), **0 échec**.

## Build

`NEXT_DIST_DIR=.next-p0-2-closure NODE_OPTIONS=--max-old-space-size=8192 npx next build`, isolé (sans Graphify/lint massif/agents concurrents). **Résultat : succès** — exit code 0, `BUILD_ID` généré (`L72Jd4dyDrvTa2LD6HAXm`), les deux routes modifiées compilées sans erreur (`/api/pierre/action/route.js` 22 Ko — plus volumineux qu'avant, cohérent avec l'ajout de la gouvernance et de l'idempotence ; `/api/router/route.js` 7,8 Ko — nettement réduit, cohérent avec la neutralisation), manifeste de routes complet (196 pages statiques + toutes les API). Voir `CLONESTORE_AUDIT_EVIDENCE/p0-2-sibling-surfaces-closure/` pour la sortie brute.

## Risques restants

Voir `P0_2_REMAINING_EXECUTION_RISKS.md` — synthèse : (1) `/api/pierre/action` bloque désormais potentiellement une fonctionnalité self-service légitime si un appelant existe réellement (compromis assumé, pas un oubli) ; (2) aucune preuve absolue de l'absence d'appelant externe historique sur `/api/router` (d'où la neutralisation plutôt que la suppression) ; (3) fragmentation de gouvernance globale du moteur v1/hr (ISSUE-07) toujours non résolue, hors périmètre.

## Verdict

**Les trois surfaces historiquement capables de contourner CloneGuard pour une action Pierre (`/api/pierre/execute`, `/api/pierre/action`, `/api/router`) passent désormais toutes par la gouvernance canonique ou n'ont plus aucun chemin d'exécution du tout.** Recherche exhaustive finale (`MAKE_`, URLs codées en dur, `fetch`/webhook dans `src/app/api`) : plus aucune surface non gouvernée trouvée.
