# P9.3 — Pierre Operational Client Cockpit — Architecture

> Cockpit opérationnel client de Pierre (`/agents/pierre/use`). Ce document fixe
> l'architecture réelle constatée, les sources de données, les endpoints réutilisés,
> la frontière P8/P9 et My CloneStore/cockpit, la dette legacy et la stratégie
> d'évolution **sans backend parallèle**. Produit après audit exhaustif (Section 0).

Règle cardinale : **consommer les contrats réels existants, ne jamais modifier le
runtime P8 (`src/lib/pierre/v1/**`, `src/app/api/pierre/v1/**`), ne jamais inventer
de backend, ne jamais afficher de donnée fictive.**

---

## 1. Architecture actuelle constatée

- Route canonique : `/agents/pierre/use` → `layout.tsx` = `OperationalRouteShell gate="cockpit"` (verrou serveur `resolveOperationalAccess()` ; seul `employee_active` déverrouille) → `page.tsx` → `PierreCockpitShell`.
- Hook central `usePierreCockpit.ts` : charge paresseusement par « workspace », rafraîchit la mission active, poll 12 s si une tâche tourne, localStorage TTL 60 s.
- **Chemin de données CANONIQUE = runtime V1** (`/api/pierre/v1/**`, tables `pierre_rt_*`), avec repli **legacy** `/api/pierre/use/**` (tables `pierre_*`) pour les tenants non migrés.
- **Couche modèle client déjà existante et sûre** : `src/lib/pierre/cockpit/{types,normalizers,api-client,v1-bridge}.ts` — pure, sans import serveur. C'est notre socle réutilisable (hors `v1`, donc modifiable).
- UI actuelle : onglets « workspace » techniques (Mission, Validations, Documents, Emails, PDF, Employés, CloneADN, Trace, Valeur, Scénarios, Paramètres). Lit comme un **dashboard technique / back-office** (branding interne CloneADN/CloneGuard/Scénarios/Valeur exposé, JSON de preview, IDs internes). Aucun `data-tour-id`.

## 2. Frontières

### P8 (interdit de modifier — lecture/consommation seules)
`src/lib/pierre/v1/**`, `src/app/api/pierre/v1/**`, `src/app/api/webhooks/**`, `supabase/**`, providers, workers, queues, migrations, secrets, flags Production. Le cockpit consomme les **réponses HTTP** de ces routes ; il n'importe jamais leur code serveur.

### My CloneStore (P9.2) vs Cockpit (P9.3)
- **My CloneStore** (`/profile`) : compte, facturation, entreprise, empreinte, onboarding, liste des employés IA possédés. **Inchangé.**
- **Cockpit** (`/agents/pierre/use`) : missions, validations humaines, documents/livrables, salariés concernés, activité/timeline. Le cockpit affiche un **résumé + lien** vers l'empreinte/config, jamais une reproduction.
- **Employee 360** (`/agents/pierre/employees`) reste la route canonique salariés — le cockpit **relie** (recherche + fiche + résumé dans le détail mission), ne duplique pas.
- **Setup Pierre** (`/agents/pierre/setup`) : ton, autonomie, identité d'envoi, règles comportementales. Distinct de l'empreinte entreprise (`/profile/onboarding`).

## 3. Sources de données réelles + endpoints réutilisés

| Besoin produit | Source réelle | Endpoint | Composant/couche existante | Décision |
|---|---|---|---|---|
| Vue d'ensemble (missions/tasks/validations/deliverables/timeline) | runtime V1 (snapshot) | `GET /api/pierre/cockpit/snapshot` ; `GET /api/pierre/use/mission-control` (legacy compat) | `pierre/cockpit/normalizers` | **reuse endpoint + nouvelle vue** |
| Liste missions | V1 | `GET /api/pierre/v1/missions` (repli `/api/pierre/use/dashboard`) | `api-client`, `normalizeMissionResponse` | **reuse** |
| Détail mission | V1 | `GET /api/pierre/v1/missions/{id}` (repli `/api/pierre/use/mission/{id}`) | `normalizeMissionResponse` + tasks/docs | **reuse + nouvelle vue détail** |
| Création mission | V1 | `POST /api/pierre/v1/missions` (repli `POST /api/pierre/use/submit`) | `submitPierreMission` (api-client) | **reuse chemin existant, jamais de nouvelle API** |
| Tâches d'une mission | V1 | `GET /api/pierre/v1/missions/{id}/tasks` | `normalizeTaskList` | **reuse** |
| Validations (file) | V1 | `GET /api/pierre/v1/missions/{id}/validations` ; décisions `POST /api/pierre/v1/validations/{id}/{approve\|reject\|request-changes}` | `api-client` (approve/reject/requestChanges) | **reuse** |
| Documents/livrables | V1 (+ preview legacy) | mission payload documents ; `POST /api/pierre/use/document/preview` ; téléchargement **lien signé** `/agents/pierre/use/secure/[token]` | `normalizeDocumentList` | **reuse ; jamais d'URL bucket brute** |
| Salariés (référence + fiche) | V1 | `GET /api/pierre/v1/employees*` (page 360) ; résumé mission via mission payload | `normalizeEmployeeFileIndex` | **reuse + lien 360** |
| Timeline / activité | V1 | `GET /api/pierre/v1/missions/{id}/timeline` ; `GET /api/pierre/use/audit-trail` | `extractCockpitCards` | **reuse + regroupement lisible** |
| Worker (avance file gouvernée) | V1 | `POST /api/pierre/v1/worker/tick` | api-client | **reuse (QA + rafraîchissement)** |
| Accès/état | V0 (orders) | `resolveOperationalAccess()` via `OperationalRouteShell` | — | **inchangé** |

## 4. Contrats de statuts canoniques (constatés)

- **Mission.status** : `active | awaiting_info | awaiting_approval | draft | blocked | scheduled | done | cancelled`
- **Mission.understanding_status** : `understood | partially_understood | missing_info | out_of_scope`
- **Task.status** : `draft | ready | scheduled | awaiting_approval | blocked | queued | completed | failed | cancelled`
- **Validation/approval** : `pending → approved | rejected | request_changes` ; décisions V1 `approve|reject|request-changes` (rôles `owner|admin` uniquement — `validation.decide`)
- **Risk (DB)** : `low | medium | high` ; **Risk (couleur HR)** : `green | orange | red | black`
- **Document** : `family` (contract/amendment/offer/…/generic_hr) ; `channel` (document/pdf/email/html/internal_note) ; `quality` (excellent/good/needs_review/blocked)
- **Audit event_type** : ~30 (mission_created, task_started, document_generated, email_prepared/sent, governance_blocked, human_action_required, …) ; severity (info/notice/warning/action_required/blocked/critical)
- **Employee.status** : `active | inactive | onboarding | offboarding | unknown`

## 5. Isolation tenant (constatée — critique)

Chaque endpoint résout le tenant **côté serveur** (JWT/session → `user_id` ; V1 → `pierre_rt_members.company_id`, défaut si membership unique, sinon header `x-pierre-company`). **Le client ne fournit JAMAIS de `company_id`.** Documents = **liens signés opaques** (HMAC + expiry + liaison tenant + destinataire), jamais d'URL bucket. Le cockpit P9.3 respecte strictement : aucune autorité client, aucun `company_id` de confiance.

## 6. Dette legacy

- Deux chemins mission : **V1** (`pierre_rt_*`, canonique) et **legacy** (`pierre_*`, repli). Le cockpit consomme V1 d'abord, legacy en repli — décision conservée (pas de rupture des tenants non migrés).
- Deux surfaces salariés : `/api/pierre/use/employees` (JSONB `pierre_company_memory`) et `/api/pierre/v1/employees` (runtime). La page 360 utilise **V1** ; le cockpit relie 360.

## 7. Stratégie d'évolution (sans backend parallèle)

1. **Nouvelle couche présentation pure** `src/lib/client-cockpit/**` : modèles d'affichage canoniques P9.3 (Overview, AttentionItem, MissionSummary/Detail, Task, Validation, Artifact, EmployeeReference, TimelineEvent, HealthState) dérivés des contrats réels (§4) via mappers purs + tests exhaustifs de statut. **Aucun import serveur, aucune logique métier P8 dupliquée** (normalise/trie/filtre/groupe/choisit les CTA selon permissions reçues).
2. **Rebuild du shell cockpit** en 6 vues humaines (Vue d'ensemble, Missions, Validations, Documents, Salariés, Activité) réutilisant `api-client`/`normalizers` + composants réutilisables (CommandCenter, ValidationCenter, ArtifactStudio, UnderstandingCard, StatusBadges, EmptyStates, TaskCard, MobileActionBar). Panneaux techniques (Trace/Valeur/Scénarios/CloneADN/DocumentStudio) **masqués** de l'expérience client (repli support éventuel, sans secret).
3. **URLs inchangées** : une route `/agents/pierre/use` avec navigation interne (onglets/vues), pas de `/cockpit-v2`.
4. **Création mission** : réutiliser `submitPierreMission` (V1, repli legacy) — jamais de nouvelle API.
5. **Tour** : moteur P9.1, registre `pierre-cockpit-tour` distinct.

## 8. Harness QA réel (Section 16/17)

- **Accès page** : 2 utilisateurs QA Supabase éphémères (V0 auth + `orders`) via flag `P93_E2E_I_UNDERSTAND_EPHEMERAL_SUPABASE_WRITES=yes` (modèle P9.2), pour franchir `OperationalRouteShell`.
- **Données réelles cockpit** : runtime **local PGlite** (`PIERRE_E2E_TEST_MODE=1`, `NODE_ENV≠production`, `PIERRE_E2E_SECRET`) → `getTestRuntimeDb()` applique le vrai schéma gouverné v1→v28 ; identité E2E signée `pierre_e2e_session` (user_id+email seuls, rôle/tenant résolus en DB) ; tenants préfixés `p93-e2e-<run_id>` ; missions/validations/documents semés via le runtime réel (`submit` + `worker/tick`, `ai_mode=off`, adaptateurs providers simulés aux frontières). Reset déterministe `resetTestRuntimeDb()`.
- **Contrainte honnête** : le runtime local est **fail-closed en production** (sécurité P8) ; les scénarios données-riches s'exécutent donc en test-mode local (non-prod), tandis que le **build Production** (`npm run build`) reste vérifié séparément (Section 19). Documenté, non simulé.

## 9. Critères de sortie

Cockpit branché aux données réelles ; aucune donnée fictive ; création mission réelle (ou gap bloquant prouvé) ; missions/validations/documents/Employee 360/timeline réels ; états produit complets ; isolation A/B ; Playwright A–H ; cleanup zéro résidu ; tsc + tests P9.3 + build verts ; P9.1/P9.2 non régressés ; P8 intouché.
