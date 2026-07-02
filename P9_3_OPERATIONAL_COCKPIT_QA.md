# P9.3 — Pierre Operational Client Cockpit — QA

> État de qualité **honnête** de P9.3. Le cockpit client final est livré, branché
> aux **données réelles du runtime V1**, et vérifié en navigateur (scénarios A–H)
> avec un runtime **PGlite local** (schéma gouverné réel v1→v28) + accès **Supabase
> réel**. Aucune donnée fictive, aucun Playwright simulé. run_id Supabase :
> `p930ee366b1` (supprimé). run local : provisioning `P93A/P93B/P93EMPTY`.

## 1. Architecture livrée

- Route canonique **inchangée** `/agents/pierre/use` : `OperationalRouteShell gate="cockpit"` + garde d'abonnement de page conservés. Nouveau shell client `OperationalCockpitShell` (remplace l'expérience technique). URLs inchangées, pas de `/cockpit-v2`.
- **Chemin de données CANONIQUE = runtime V1** (`/api/pierre/v1/**`), consommé via `src/lib/pierre/cockpit/{api-client,v1-bridge}` puis mappé en modèles d'affichage par `src/lib/client-cockpit/**`. **Aucun composant ne lit de JSON brut.**
- Header humain : Pierre · Employé IA RH · état (Disponible / En cours de travail / En attente de votre validation / Action requise) · dernière actualisation · liens Configuration + Mon CloneStore + Rafraîchir + Confier une mission.
- **6 vues** (query param `?view=` stable, deep-link `?mission=`) : Vue d'ensemble, Missions, Validations, Documents, Salariés, Activité.

## 2. Couche `client-cockpit` (pure, testée)

types canoniques + mapping **exhaustif des statuts RÉELS du runtime V1** (MissionStatus/TaskStatus de `state-machine.ts` : draft/analyzing/awaiting_info/planned/awaiting_validation/ready/queued/in_progress/partially_completed/done/blocked/failed/retry_scheduled/cancelled/escalated/archived), permissions/CTA, `v1.ts` (bridge V1 → canonique : missions/tasks/validations/artifacts/timeline/employés), overview/attention/health, timeline+regroupement. **tsc 0 · 78 tests client-cockpit + 17 tests cockpit/tour verts.**

## 3. Scénarios A–H — vérifiés en navigateur (données RÉELLES)

Harness double couche : **accès** via Supabase V0 (2 users éphémères + orders, flag `P93_E2E_..._WRITES=yes`) ; **données** via runtime **PGlite local** (`PIERRE_E2E_TEST_MODE=1`, `NODE_ENV≠prod`, `PIERRE_E2E_SECRET`) + plan de contrôle E2E P8 existant (`/api/internal/e2e/*`, reset/seed/session/activation/onboarding) + identité signée `pierre_e2e_session`. Missions semées via **vrai** `submit` V1 + `runtime-tick`. `ai_mode=off`, providers **simulés aux frontières** (FakeEmailProvider) — aucun LLM/email/signature réel.

| Scénario | Résultat prouvé |
|---|---|
| **A — Accès** | Anonyme → `/agents/pierre/use` → **redirection** `/login?redirect=%2Fagents%2Fpierre%2Fuse` ; order **active** → cockpit rendu (« Disponible ») ; order **canceled** → **écran verrouillé** (cockpit non rendu). Machine `OperationalRouteShell`/`resolveOperationalAccess` (identique P9.2). |
| **B — Cockpit vide réel** | Tenant actif sans mission → « **Pierre n'a aucune mission active pour le moment.** » + CTA « Confier une mission à Pierre ». Aucune donnée fictive. |
| **C — Missions + création** | 3 missions réelles listées (recherche/filtres/tri) ; détail (drawer deep-linkable) : « ce que Pierre a compris », progression, tâches, validations, documents, activité. **Création via composer** : double-clic → **une seule mission** créée (garde `mutating` + clé d'idempotence V1 stable). |
| **D — Validations** | File réelle ; validation sensible **Prepare Sensitive Draft** → **confirmation obligatoire** → approbation V1 (version-checked : version 1→2, statut `approved`) ; après relecture serveur la validation disparaît (badge → 0). |
| **E — Erreur & reprise** | États construits (bannière **stale** après seuil, `ErrorView` + retry, réseau ambigu → « Vérification de la création… » sans double-envoi, 409/412 → « Cette validation a déjà changé »). Câblés dans le hook ; non déclenchés artificiellement en live (voir §5). |
| **F — Documents** | Livrables **dérivés des tâches documentaires réelles** (Prepare Sensitive Draft = Document « À valider » ; Reminder = Communication) + filtres. Téléchargement direct = **GAP-2** (voir `P9_3_RUNTIME_CONTRACT_GAPS.md`) : aucun faux document, aucune URL bucket. |
| **G — Isolation A/B** | Tenant B (identité + company distinctes) : voit sa mission + son salarié « Zoe TenantB » ; **aucune** donnée de A (`Cas sensible détecté: contract`, `Marie Dupont`, `Karim Benali` = absents du DOM de B). Tenant résolu serveur (`pierre_rt_members`), jamais de `company_id` client de confiance. |
| **H — Mobile + tour** | 390×844 : **aucun overflow horizontal** (375=375), nav + contenu OK. Tour cockpit : invitation « Le cockpit de Pierre » → 8 étapes (header/attention/missions/validations/documents/salariés/activité/configuration) → spotlight → Suivant → **Escape ferme**. Moteur P9.1, distinct des tours public/My CloneStore. |

Captures : `docs/qa-screenshots/p9-3/` (access-active, access-no-order, overview-active-desktop, overview-empty-desktop, overview-mobile, missions-list, mission-detail, validation-decision, documents, employee-link, activity, isolation-user-b, cockpit-tour) — répertoire gitignoré (évidence QA locale).

## 4. Cleanup — ZÉRO RÉSIDU

`try/finally` : suppression orders → profiles → auth users Supabase A/B par `run_id`, vérifiée **indépendamment** (`remainingUsers=0, residueOrders=0, residueProfiles=0`) → **« P93 E2E CLEANUP — VERIFIED ZERO RESIDUE »**. Runtime **PGlite en mémoire** (détruit à l'arrêt du serveur — aucune DB résiduelle). Creds (mots de passe) écrasés puis supprimés. Serveurs dev arrêtés (**port 3222 libre**). Aucun provider réel contacté. Aucun fichier documentaire temporaire.

## 5. Réserves honnêtes

- **GAP-1 / GAP-2** (`P9_3_RUNTIME_CONTRACT_GAPS.md`) : décisions de validation sans canal de motif ; pas de contrat de liste documents/téléchargement par mission. Le cockpit implémente l'UX la plus honnête dans ces limites (confirmation ; livrables dérivés des tâches). Levée = lane P8.
- **Scénario E** : les états d'erreur/stale/reprise sont **implémentés et unit-couverts** mais n'ont pas été déclenchés artificiellement en session live (le runtime déterministe local ne produit pas d'erreur à la demande sans forcer une panne). Non simulé, non falsifié.
- **Harness données-riches** : le runtime PGlite est **fail-closed en production** (sécurité P8) ; les scénarios données s'exécutent donc en **test-mode local (non-prod)**, tandis que le **build Production** est vérifié séparément (§6). Documenté.

## 6. Gates automatisées

- `tsc --noEmit` → **exit 0**.
- `npm run build` → **exit 0**, **185/185** pages ; `/agents/pierre/use` compilé (52.3 kB).
- Suite complète : **15767 verts**. Échecs déterministes = **4 préexistants** `premium-document-system` (`inferPremiumDocumentFamily`, fichiers **non modifiés** par P9.3). `fair-claim.test.ts` (P8/v1, concurrence) = **flaky** sous charge parallèle (**passe en isolation 2/2**) — non lié à P9.3.
- **Isolation Git** : ensemble P9.3 (nouveaux + `page.tsx`, `cockpit/api-client.ts`, `guided-tour/{tour-registry,index}`, `GuidedTourProvider.tsx`) **entièrement disjoint** du périmètre interdit. Fichiers dirty en périmètre interdit = **213, identique à l'audit P9.2** → P9.3 n'a introduit **aucune** modification P8. P9.1/P9.2 non régressés (tours + nav intacts).
