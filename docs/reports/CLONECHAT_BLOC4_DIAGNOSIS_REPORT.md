# CloneChat — BLOC 4 : CloneChat Diagnosis

**Verdict local : PASS.** Le moteur de diagnostic produit, pour toute situation de blocage, un **diagnostic structuré, typé et versionné** (`diagnosis-1`), au-dessus du Brain (BLOC 2) et du CloneContext (BLOC 3). Il ne consomme que des **sources réelles** et ne devine jamais un état, une erreur, une permission, un tenant, un droit, une cause certaine, une résolution réussie ou une route inexistante.

## Architecture (`src/lib/clonechat/diagnosis/`)

| Fichier | Rôle |
|---|---|
| `types.ts` | `CloneChatDiagnosis` : `kind`, `blocked`, problème observé, cause racine, `causeCertainty` (confirmed/probable/none), `confidence`, preuves, informations manquantes, étape bloquée exacte, prérequis manquants, `blockerCategory` (permission/tenant/entitlement/route/environment/provider), actions de déblocage (routes réelles), route recommandée, `requiresClarification`, `requiresEscalation`. |
| `diagnose.ts` | **Moteur pur** `diagnoseCloneChat(ctx, {brainDecision?, modelUnavailable?})` — ordre de priorité déterministe (voir plus bas). Aucune lecture DB, aucune supposition. |
| `diagnose-with-context.ts` | Branche le diagnostic sur `decideWithContext()` : `decideAndDiagnose()` renvoie `{decision, context, structured, diagnosis}` — **`structured` inchangé** (`{answer,honesty,tool_call,citations}`). |
| `index.ts` | Surface publique. |

## Champs produits pour toute situation de blocage
Problème observé · cause racine (certaine **ou** probable) · niveau de confiance · preuves utilisées · informations manquantes · **étape exacte** de blocage · prérequis manquants · **catégorie** (permission / tenant / entitlement / route / environnement / provider) · actions de déblocage **réellement disponibles** · **route réelle** recommandée · clarification nécessaire ? · **escalade humaine** nécessaire ?

## Distinctions garanties (les 9 natures)
`confirmed_cause` · `probable_cause` · `insufficient_context` · `provider_failure` · `tenant_security_failure` · `missing_prerequisite` · `permission_denied` · `route_or_navigation_issue` · `unknown_requires_escalation` — plus `no_blocker` quand rien n'est observé.

## Ordre de priorité déterministe (résumé)
1. **Gouvernance / injection** → `permission_denied` (jamais reclassé en « prérequis à corriger »).
2. **Sécurité tenant** (suspendu → escalade ; indisponible → réessayer) → `tenant_security_failure`.
3. **Erreurs réellement présentes** (`surfacedErrors`) → `confirmed_cause` (token auto-descriptif : declined/expired/failed…) / `probable_cause` (domaine sans token dur) / `unknown_requires_escalation` (opaque, cause **jamais inventée**).
4. **Prérequis** par porte la plus proche : authentification → entreprise → Pierre.
   - Entreprise **non résolue** alors que l'utilisateur est authentifié (`refusalCode=null`) → `insufficient_context` (jamais « pas d'entreprise »).
   - **Panne de lecture entitlement** (`pierre.lookupFailed`) → `provider_failure` (entitlement), **jamais** interprétée comme une absence de droit.
5. **Modèle indisponible** (sans autre blocage) → `provider_failure` (provider).
6. **Route inconnue** du registre → `route_or_navigation_issue` (aucune route de remplacement inventée).
7. **Route verrouillée réelle + question de diagnostic** → `probable_cause` via la **note de gating RÉELLE** du registre (cause probable, jamais certaine ; l'erreur exacte est demandée).
8. **Dysfonctionnement signalé** sans cause identifiable → `unknown_requires_escalation`.
9. **Diagnostic sans signal concret** → `insufficient_context`.

## Sources réelles consommées (aucune invention)
CloneContext (BLOC 3) · Product Truth Engine (via le Brain) · registre des routes (`getRouteEntry`, notes de gating réelles) · viewer/tenant/entitlement réels (reflétés par le contexte) · `surfacedErrors` réellement fournis · prérequis/blockers réels (`resolveCloneChatPlan`) · indisponibilité provider réellement observée. **Le diagnostic est agnostique au tenant** : il ne contient **aucun identifiant d'entreprise** (raisonnement en catégories / étapes / routes) → isolation inter-tenant par construction.

## Gate local (tout vert)
- Diagnosis **25/25** ; régressions **170/170** (context 25, brain 27, product-truth 15, context-boundary 51, corpus 6, injection-114 114/114, universal-clonechat 20).
- **tsc** 0 nouvelle erreur (1 pré-existante `embedded-postgres`). **ESLint** 0 sur `src/lib/clonechat/diagnosis/`. **Build Next isolé** (`.next-hotfix`) : **BUILD_EXIT_CODE=0**.
- Fix pendant le gate : `\b` ne délimite pas les tokens autour d'un underscore (l'underscore est un caractère de mot) → `checkout_declined` n'était pas reconnu comme auto-descriptif ; normalisation des séparateurs en espaces avant le test. Re-run → 25/25.

## Limites honnêtes / suite
- `decideAndDiagnose()` **n'est pas encore câblé** dans `/api/assistant/chat` (câblage = étape ultérieure délibérée ; la compatibilité — mêmes entrées réelles et même format de sortie — est prouvée par tests).
- Le **guide pas-à-pas** (transformer le diagnostic en accompagnement actionnable) est **BLOC 5 (CloneGuide)** — hors périmètre ici ; aucune action n'est exécutée.
- `ctx.pierre` ne distingue pas « droit non récupéré » de `NO_ENTITLEMENT` (les deux → `granted=false`, `lookupFailed=false`) ; en pratique la route résout toujours l'entitlement avec le tenant, donc un `pierre_entitlement` manquant sur une entreprise résolue est un refus réel. La panne de lecture (`LOOKUP_FAILED`) est, elle, distinguée sans ambiguïté.
