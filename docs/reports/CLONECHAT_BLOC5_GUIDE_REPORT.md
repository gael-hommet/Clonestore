# CloneChat — BLOC 5 : CloneGuide V1

**Verdict local : PASS.** CloneGuide transforme une **intention ou un diagnostic** en accompagnement **concret, sûr et progressif** vers un résultat réel — **sans exécuter d'action** et **sans inventer l'interface**. Toute autorité (routes, statuts, prérequis, disponibilités) provient des sources réelles ; le guide reste au niveau **route + instruction textuelle vérifiable** (le guidage visuel appartient au BLOC 9).

## Architecture (`src/lib/clonechat/guide/`)

| Fichier | Rôle |
|---|---|
| `types.ts` | `CloneGuide` (`guide-1`) : objectif, état initial réel, route de départ, étapes ordonnées (texte précis, route réelle, prérequis, **condition de réussite observable**, **condition de blocage**, **action de récupération**), étape actuelle, nombre total d'étapes, clarification/confirmation/escalade, `state` ∈ ready/blocked/needs_clarification/completed/escalate. |
| `catalog.ts` | **Catalogue déterministe** des parcours (blueprints) — texte précis + routes RÉELLES (validées via `getRouteEntry`, `null` sinon, jamais de lien mort). |
| `build.ts` | **Sélection + finalisation** : choisit le parcours depuis diagnostic + contexte + intention Brain, calcule étape actuelle (portes de prérequis) et état. |
| `guide-with-context.ts` | `decideDiagnoseAndGuide()` : Brain → contexte → diagnostic → guide, en une passe ; `structured` **inchangé**. |
| `index.ts` | Surface publique. |

## Parcours couverts (≥ 13 requis + clarification)
`reserve_pierre` · `view_demo` · `checkout` · `login` · `signup` · `resolve_no_company` · `select_company` · `resolve_no_pierre` · `recover_entitlement_lookup` (panne de vérification) · `contact_support` · `unknown_route` · `after_payment_diagnosis` · `resolve_tenant_or_permission` (blocage tenant **ou** permission) · `clarify_request`.

## Autorité déterministe (aucune invention)
- **Routes** : registre canonique uniquement (`getRouteEntry`) ; toute route d'étape ou de départ est réelle ou `null`.
- **CTA de prérequis** : `prerequisiteCta` réel (routes d'activation/connexion/entreprise validées).
- **Diagnostic** (BLOC 4) : dicte le parcours de blocage, la clarification, l'escalade, la route recommandée.
- **CloneContext** (BLOC 3) : viewer/tenant/Pierre réels → portes de prérequis et état initial (jamais un état deviné, jamais de `companyId`).
- **Intention** : lue depuis la décision réelle du Brain (`suggestedRoute` / `requestedAction.targetRoute`), jamais du modèle libre.
- Le modèle n'invente **jamais** une route, un bouton, un champ UI, une étape, une permission, une réussite, un état de compte, ni une action déjà exécutée.

## Sélection déterministe (résumé)
Blocages durs d'abord — `permission_denied` → parcours permission (bloqué, aucun contournement) ; `tenant_security_failure` → rétablir l'accès (suspendu = escalade, panne = réessayer) ; `provider_failure` entitlement → reprise après panne (bloqué) ; route inconnue → clarification ; escalade → support. Diagnostic de paiement → reprise (confirmé = prêt, probable = clarification). Sinon **intention** (le parcours intègre les portes de prérequis) ; à défaut, **résolution du prérequis** le plus proche ; sinon **aucun guide** (question conversationnelle sans objet).

## Invariants prouvés (25/25)
- **Jamais de fausse complétion** : `completed` n'apparaît que lorsqu'un état RÉEL du contexte prouve le but (ex. déjà connecté) ; un parcours « à faire » (réserver/payer/démo) reste `ready`, jamais `completed`.
- **Aucune route inventée** : chaque route (étape, départ, recommandée) validée via `getRouteEntry`.
- **Aucune étape vide** : texte, condition de réussite, condition de blocage et récupération toujours non vides ; ordre stable 1..N.
- **Isolation inter-tenant** : le guide ne contient **aucun `companyId`** (état initial décrit en catégories).
- **Permission/injection** : parcours bloqué, aucune étape ne propose de route pour accomplir l'action interdite ; `executed=false`.
- **Déterministe** ; **modèle indisponible** → parcours de reprise honnête (jamais `completed`).
- **Compatibilité API** : `decideDiagnoseAndGuide` fournit `{decision, context, diagnosis, guide, structured}` avec `structured` = `{answer,honesty,tool_call,citations}` **inchangé**.

## Gate local (tout vert)
- CloneGuide **25/25** · régressions **195/195** (diagnosis 25, context 25, brain 27, product-truth 15, context-boundary 51, corpus 6, injection-114 114/114, universal-clonechat 20).
- **tsc** 0 nouvelle erreur (1 pré-existante `embedded-postgres`) · **ESLint** 0 sur `src/lib/clonechat/guide/` · **Build Next isolé** (`.next-hotfix`) : **BUILD_EXIT_CODE=0**.

## Limites honnêtes / suite
- `decideDiagnoseAndGuide()` **pas encore câblé** dans `/api/assistant/chat` (adaptateur réel + tests d'intégration fournis ; aucun comportement risqué / gate Production requis n'est activé).
- **Guidage visuel précis** (cibles UI réelles : boutons/champs) = **BLOC 9** ; ici tout reste au niveau route + instruction textuelle.
- Aucune action n'est exécutée : CloneGuide prépare le chemin, l'utilisateur agit et confirme.
