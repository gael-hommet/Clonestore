# P9.4.1 — TRUTH AUDIT (avant toute écriture)

> Section 0 du brief P9.4.1 : **« Ne commence pas en supposant que les claims sont vrais. »**
> Cet audit a été mené par 14 investigateurs read-only sur le code RÉEL (≈789k tokens),
> avec consigne adversariale (un Map en scope module n'est PAS durable/multi-instance ;
> localStorage n'est PAS de la continuité serveur ; valider mime/taille n'est PAS
> stripping/resize/compression ; un tableau de 14 chunks n'est PAS « connaissance complète »).
> Verdict global d'entrée : **plusieurs claims P9.4 sont trop larges** et doivent être
> corrigés + fermés par du réel durable. Détail ci-dessous.

## Matrice de vérité

| Claim P9.4 | Réalité actuelle | Durable | Multi-instance | Exhaustif | Action P9.4.1 |
|---|---|:--:|:--:|:--:|---|
| Complete knowledge brain | 14 chunks statiques hardcodés (~700 mots) dans `knowledge.ts` | ❌ | ❌ | ❌ | Registre de sources qui **grounde sur les vrais modules canoniques** (voir §Sources réelles) + coverage gate |
| Persistent bug memory | `createInMemoryBugStore` via `globalThis.__clonechatBugs` (Map par process, 2 seeds) | ❌ | ❌ | ✅(modèle) | Store **Postgres durable** + politique de réutilisation vérifiée |
| Hard daily/monthly GLOBAL budget | Array in-memory par process ; check→record **non atomique** (course entre snapshot et record) | ❌ | ❌ | ❌ | **Ledger Postgres atomique** (reserve→record→release) + preuve concurrence/restart/2-instances |
| Persistent multi-device conversation continuity | localStorage `clonestore.clonechat.thread.v1` (40 msgs, 1 navigateur) ; `continuity.ts`/`thread-storage.ts` **jamais implémentés** | ❌ | ❌ | ✅(modèle) | Store serveur **Postgres** + API + reprise cross-device/restart ; localStorage = cache offline |
| Image metadata stripping | **Aucun** décodage/EXIF strip ; regex mime + estimation taille ; original passé à OpenAI | n/a | n/a | ✅(modèle) | Sanitisation **réelle** (décodage, magic bytes, resize, recompression, EXIF strip) OU documenter honnêtement |
| Image resize / compression | **Non implémenté** (aucune lib image ; `detail:low` = param OpenAI, pas un resize local) | n/a | n/a | ✅(modèle) | Idem ci-dessus |
| Complete governed tools | **1/16 câblé** (`create_mission`) ; `decide_validation`/`cancel_mission` déclarés mais tombent en `unsupported_kind` ; `create_support_case`/`retrieve_bug` sans impl | ⚠️ | ❌ | ❌ | Registre complet ; câbler decide_validation (contrats V1 réels existent) ; support tools durables ; **UNAVAILABLE** honnête pour le reste |
| Support-case persistence | Aucune table, aucun executor | ❌ | ❌ | ❌ | Store Postgres + outils gouvernés |
| Multi-device continuity | localStorage uniquement | ❌ | ❌ | ✅ | Comme conversations |
| All CloneStore knowledge | Manque : 7 autres employés (roadmap), prix détaillés, flags, permissions, techs, contrats | ❌ | ❌ | ❌ | Grounder sur les sources réelles + coverage gate mesurable |

## Sources canoniques RÉELLES découvertes (à grounder, jamais réinventer)

| Domaine | Source de vérité (read-only) |
|---|---|
| Prix / fenêtre fondateur | `src/lib/demo/presentation/commercial-state.ts` (`FOUNDER_PRICE_MONTHLY` = 449 € HT/mois, fenêtre → 2026-08-31) |
| Surface commerciale publique | `src/lib/catalog/public-catalog.ts` (**source unique**, Pierre seul exposé ; Clara/Emma/Alex/Noah/Adrien/Lucas/Sophie non publics) |
| Catalogue employés | `src/lib/clonestore/employees/employee-registry.ts` (Pierre actif + roadmap) |
| Technologies (12) | `src/lib/clonestore/technologies/registry.ts` (`TECHNOLOGY_DEFINITIONS`, specs, readiness) |
| Routes | `src/lib/nav/route-registry.ts` (~30 routes machine-readable, durable) + `P9_1_ROUTE_NAVIGATION_MATRIX.md` (60+ documentées) |
| Disponibilité produit / flags | `src/lib/features/product-availability.ts` (`ProductKey`, `isCloneChatEnabled`) |
| Capacités Pierre (P8, read-only) | `src/lib/pierre/v1/hr-canon/capability-registry.ts` (215 capacités ; canon-summary : 68 autonomes / 59 avec validation / 71 draft). **4 HUMAN_ONLY à NE JAMAIS exposer** : `relations.whistleblower`, `disciplinary.qualify`, `disciplinary.decision`, `offboarding.dismissal` |
| Contrats client-safe | `src/lib/pierre/cockpit/api-client.ts` (dont `approvePierreValidation`/`rejectPierreValidation`/`requestPierreValidationChanges` **réels**) + `src/lib/client-cockpit/**` |

## Contrats & gaps confirmés (héritage P9.3)

- **GAP-1** : les décisions de validation V1 acceptent `version` mais **pas de motif** (`reason`). CloneChat doit donc décider sans fabriquer de champ motif.
- **GAP-2** : pas d'endpoint `GET .../documents` dédié ; les livrables sont **dérivés des tâches** (`deriveV1Artifacts`) — honnête mais non exhaustif. Pas de contrat d'upload.
- **HUMAN_ONLY** (4) : structurellement réservés, jamais surfacés au client.

## Infrastructure de durabilité (décision)

- **PGlite** (harness P8) est **in-memory** → détruit au restart → **ne prouve pas** la persistance.
- **`embedded-postgres`** (déjà devDependency, utilisé par `scripts/p89-postgres-100k-benchmark.mjs`) fournit un **vrai Postgres persistant** avec un data-dir qui **survit au restart de process** et supporte **plusieurs connexions/processus** → c'est l'outil de preuve honnête, **sans toucher Supabase**.
- **RLS pattern du repo** : `company_id::text = current_setting('app.current_company', true)` + `enable row level security` + `force`.
- **Runner** : `scripts/db/migrate.mjs` et les 2 harness P8 filtrent sur `filename.includes("pierre_v")` → un fichier `p941_*` (et un répertoire séparé) est **invisible** au P8.

### DÉCISION P9.4.1 (durabilité)

1. **Migration additive P9.4.1** dans un répertoire séparé `supabase/migrations-p941/` (jamais `pierre_v` dans le nom) : nouvelles tables `clonechat_conversations`, `clonechat_messages`, `clonechat_bug_cases`, `clonechat_bug_occurrences`, `clonechat_budget_ledger`, `clonechat_usage_events` — **RLS**, additive, **aucune table/fonction P8 modifiée**, classée P9.4.1.
2. **Repositories durables** (`src/lib/clonechat/durable/**`) via `pg` (node-postgres) sur une URL fournie (`CLONECHAT_DB_URL`/`DATABASE_URL`). **Interface-based** : impl in-memory conservée pour `npm test` (aucune DB, aucun réseau) ; impl durable sélectionnée quand l'URL est présente.
3. **Preuves via `embedded-postgres`** : appliquer la migration P9.4.1 → seed → **restart de process** → persistance vérifiée ; **2 process** partageant la même DB → budget/bug/conversation partagés ; **réservation atomique** sous concurrence.
4. **NON appliqué à Supabase réel** (« ne déploie rien ») : la mise en production = appliquer la migration P9.4.1 à Supabase + variables d'env. Documenté honnêtement.

## Corrections d'honnêteté à porter (docs P9.4)

`P9_4_CLONECHAT_QA.md` qualifiait « PERSISTENT BUG & SOLUTION MEMORY » et « hard budget gates » — ces mécanismes étaient **in-memory par process**. P9.4.1 corrige ces lignes (sans effacer l'historique : « P9.4 avait une implémentation in-memory ; P9.4.1 l'a rendue durable »).

## Périmètre interdit respecté

`src/lib/pierre/v1/**`, `src/app/api/pierre/v1/**`, `src/app/api/webhooks/**`, migrations `pierre_v*`, scripts P8, preuves P8, règles/juridique/providers P8, **feature flags Production** : **lecture seule uniquement**. Aucune modification.

## Plan de fermeture (sections 1→25)

Knowledge source-registry (grounding réel) → coverage gate → indexation bornée → citations validées serveur → conversations durables → bug/support memory durable + reuse vérifié → budget ledger atomique → tool registry complet (+ UNAVAILABLE honnête) → validations/salariés/documents honnêtes → sanitisation image réelle → 4 visibilités → honnêteté produit → coût minimal → UX historique/threads/sources → tests → E2E A–L → preuves restart/multi-instance → docs + `.p941-proofs/` → gates tsc/build → cleanup ZERO RESIDUE → verdict.
