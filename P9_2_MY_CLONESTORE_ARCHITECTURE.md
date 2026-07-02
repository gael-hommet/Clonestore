# P9.2 — My CloneStore & Client Onboarding — Architecture

> Espace client authentifié de CloneStore. Ce document fixe les frontières, les
> routes, les **sources de données réelles**, la stratégie de persistance (avec
> ses limites honnêtes), la navigation et la migration depuis les écrans
> existants. Il est produit **avant toute refonte**, à partir d'une reconnaissance
> complète de l'existant (P9.2 — Étapes 0 et 1).

Règle cardinale : **réutiliser les services réels, ne jamais inventer un backend
parallèle, ne jamais présenter de données fictives, ne jamais toucher P8.**

---

## 1. Matrice de réutilisation (Étape 1)

| Besoin P9.2 | Existant réutilisable | Gap réel | Action |
|---|---|---|---|
| **Session / utilisateur** | `supabaseServer().auth.getUser()` (serveur), `getSessionClient()` (client), `useRequireAuth()`, `useAuthGate()` | — | **reuse** |
| **Redirection login sûre** | `buildLoginRedirect`, `resolvePostLoginRedirect`, `sanitizeAuthRedirect`, `isSafeRelativeRedirect` (`src/lib/auth/`) | — | **reuse** |
| **État d'accès / entitlement** | `resolveOperationalAccess("pierre"\|"general")` → `OperationalAccessState`; `hasPierreAccess`, `getOrderStatus` (`src/lib/billing`, `src/lib/access`, `src/lib/pierre/access.ts`) | pas d'agrégat « accès cockpit incluant l'onboarding » | **reuse + adapt** (fonction pure P9.2 qui compose accès + onboarding) |
| **Employés possédés** | table `orders` (session), `/agents/orders/me`, `public-catalog.ts` (`PIERRE_PUBLIC`, `PUBLIC_EMPLOYEES`) | pas d'agrégat multi-employés (seul Pierre est actif aujourd'hui) | **reuse** (map `orders` → catalogue) |
| **Entreprise (identité)** | `GlobalOnboardingDraft.company` (localStorage) ; `EnterpriseFootprint.company` ; (P8: `pierre_rt_companies`, hors périmètre) | pas de store serveur session-based **activé** (flags OFF, migration requise) | **reuse localStorage + best-effort serveur ; GAP documenté** |
| **Quick Start** | `QuickStartContract` (P9.1), `GlobalOnboardingDraft` (localStorage, mature), `deriveOverallCompletion` | pas de machine « <5 min » ni next-action | **reuse contrats + adapt** (machine pure P9.2) |
| **Empreinte guidée** | `GuidedFootprintContract`, `FootprintSectionState` (P9.1) ; `GlobalOnboardingDraft` sections + `EnterpriseFootprint` + mappers ; localStorage load/save | pas d'UI section-par-section reprenable dans My CloneStore | **reuse modèle + adapt UI** |
| **Progression / complétude** | `deriveOverallCompletion` (P9.1), `EnterpriseFootprint.readiness_score`, `completion_score` | — | **reuse** |
| **Autosave / reprise** | `saveGlobalOnboardingDraftToLocalStorage` / `load...`, `persistGlobalOnboardingWithFallback` (localStorage-first + serveur best-effort flag-gated) | pas de machine d'état autosave UI | **reuse persistance + adapt** (machine pure autosave) |
| **Empreinte continue** | `ContinuousFootprintEntryContract` (P9.1) | aucune source réelle de propositions aujourd'hui | **reuse contrat ; état vide réel** (aucune donnée fictive) |
| **Employés / lien cockpit** | route canonique `/agents/pierre/use` + `OperationalRouteShell` (gate cockpit) | — | **reuse (lien uniquement, pas de refonte)** |
| **Shell connecté** | `AppShell` (déjà « Mon CloneStore »), `OperationalRouteShell`, `/profile/layout.tsx` | nav hardcodée (pas dérivée du registry) | **reuse + convergence douce vers `route-registry`** |
| **Navigation / labels** | `route-registry.ts` (P9.1), `connected-routes.ts` | labels dupliqués shell vs registry | **reuse registry comme source de labels (migration progressive)** |
| **UI / primitives** | `profile-primitives.tsx` (ProfileSection/StatCard/ActionLink/QuickLink/MetaRow/ErrorBanner/EmptyState), tokens `--cs-*`, `LiquidGlass`, `cn` | pas de stepper partagé | **reuse ; extraire un stepper léger P9.2 si besoin** |
| **Guided onboarding authentifié** | moteur P9.1 `src/lib/guided-tour/**` + `useGuidedTour` | pas de registre de tour authentifié | **reuse moteur + nouveau registre** |

---

## 2. Frontière My CloneStore ↔ Cockpit ↔ CloneChat

### My CloneStore (compte client)
Possède : compte, identité client, **entreprise/empreinte**, **onboarding (Quick Start + guidé + continu)**, **employés IA achetés** (liste + statut), accès/facturation/sécurité/paramètres (raccourcis réels), **raccourcis vers les cockpits**.

### Cockpit opérationnel (hors P9.2 — P9.3)
Possède : missions, tâches, validations, alertes métier, salariés, documents RH, historique, actions de Pierre, temps réel. My CloneStore en affiche **un résumé** + un **lien** (`/agents/pierre/use`) — jamais une reproduction.

### CloneChat
Reste **verrouillé** (`isCloneChatEnabled` off). Aucun déblocage, aucune reconstruction en P9.2.

### CloneVoice / CloneStory / Production / interne
Hors périmètre, jamais exposés.

---

## 3. Routes P9.2

| Route | Rôle | Accès | Statut |
|---|---|---|---|
| `/profile` | **Home My CloneStore** (refonte) | authentifié | actif (refonte P9.2) |
| `/profile/onboarding` | **Onboarding client officiel** : Quick Start → Empreinte guidée → Empreinte continue | authentifié | actif (refonte P9.2) |
| `/profile/agents` | Mes employés (réels, depuis `orders`) | authentifié | conservé / raffiné |
| `/profile/messages`, `/profile/technologies`, `/profile/launch-readiness`, `/profile/go-live` | conservés (hors périmètre refonte) | authentifié | inchangés |
| `/agents/pierre/use` (+ setup/employees) | **Cockpit opérationnel** (lien uniquement) | authentifié gated | **inchangé (P9.3)** |

Aucune route supprimée. `/agents/pierre/setup` (config Pierre) reste ; il est **distinct** de l'onboarding entreprise (voir §6 duplication).

---

## 4. Sources de données réelles (V0 / session)

P9.2 se branche exclusivement sur le **chemin V0 session** (Supabase + `orders`),
celui qu'utilise déjà l'espace connecté — **jamais** le runtime P8 (`pierre_rt_*`,
`src/lib/pierre/v1/**`, `SqlExecutor`), interdit et nécessitant un `company_id`
hors session.

| Donnée | Source réelle | Résolution |
|---|---|---|
| Utilisateur | Supabase auth session | serveur (`auth.getUser()`) — jamais un `company_id` client |
| État d'accès | `resolveOperationalAccess("general")` | serveur |
| Employés possédés | `orders` (status ∈ active/trialing) → `public-catalog` | session |
| Entreprise (identité) | onboarding draft / footprint (localStorage) + best-effort serveur | client + best-effort |
| Complétude | `deriveOverallCompletion`, `readiness_score` | pur |

**Isolation** : l'entreprise/identité est toujours dérivée de la **session** côté
serveur ; aucun `company_id` de query/body/route/localStorage n'est jamais fait
confiance (voir §7).

---

## 5. Stratégie de persistance (et sa limite honnête)

**Réalité constatée** : la persistance **serveur** de l'onboarding global et de
l'empreinte entreprise existe **en conception** mais est **désactivée par
feature-flag** et **nécessite une migration** (`clonestore_global_onboarding_drafts`,
`clonestore_enterprise_footprints`) — donc **hors périmètre P9.2** (migrations et
`supabase/**` interdits).

**Décision P9.2** (respecte « ne pas inventer de backend parallèle », « documenter
le gap ») :
1. Persistance **client-authoritative** via les services localStorage **existants
   et matures** (`GlobalOnboardingDraft` + `EnterpriseFootprint`) → garantit
   **aucune perte** sur refresh / navigation / abandon, et **reprise exacte**.
2. **Best-effort serveur** via l'helper existant `persistGlobalOnboardingWithFallback`
   (localStorage d'abord, écriture serveur seulement si le flag est activé) → dès
   que l'ops activera le flag + la table (hors P9.2), la persistance serveur
   fonctionne **sans changement P9.2**.
3. Un éventuel **adaptateur borné** (`src/lib/client-onboarding/**`,
   `src/app/api/clonestore/client-onboarding/**`) : exige une session, résout
   l'utilisateur **côté serveur**, délègue aux services existants, **aucun SQL
   direct, aucun schéma, aucune migration** ; en l'absence de table active il
   renvoie l'état localStorage-authoritative et un `server_available:false`.

> **GAP DOCUMENTÉ (hors P9.2)** : la persistance serveur durable cross-device de
> l'onboarding/empreinte nécessite l'activation d'un flag + une migration (lane
> ops/P8). P9.2 livre l'expérience complète sur persistance locale + sync
> best-effort ; aucune donnée fictive, aucune fausse promesse serveur.

---

## 6. Duplication onboarding — décision

Deux écrans se recouvrent :
- `/profile/onboarding` — **wizard entreprise global** (company_identity, team_humans,
  documents, rules_validations, technologies, first_pierre_mission) sur
  `GlobalOnboardingDraft`.
- `/agents/pierre/setup` — **config comportementale de Pierre** (ton, autonomie,
  identité email…) sur `/api/pierre/onboarding`.

**Décision** : `/profile/onboarding` devient l'**onboarding client officiel**
(Quick Start → Empreinte guidée → Empreinte continue), source de l'empreinte
entreprise. `/agents/pierre/setup` **reste** (config Pierre spécifique, P9.3
territoire cockpit) et n'est **pas** dupliqué ; un lien canonique le référence
depuis My CloneStore. Aucune suppression, aucune casse d'URL.

---

## 7. Sécurité & isolation (Étape 10)

- Identité résolue **côté serveur** depuis la session/membership ; **jamais** un
  `company_id` fourni par query/body/route/localStorage.
- Routes P9.2 authentifiées → non authentifié = redirection `/login?redirect=`
  (via `buildLoginRedirect`, retour sanitizé par `sanitizeAuthRedirect` — pas
  d'open redirect).
- Aucun accès aux espaces internes/Production/CloneStory.
- Adaptateur borné : session obligatoire, tenant résolu serveur, erreurs typées,
  aucune fuite d'une autre entreprise.
- Tests : absence cross-tenant, refus sans session, refus si membership absent,
  redirection sûre, `company_id` hostile ignoré.

---

## 8. Logique d'accès au cockpit (Étape 8 — pure)

Fonction pure `resolveCockpitAccess(input)` composant les données réelles :
`authenticated`, `operationalState` (de `resolveOperationalAccess`), `ownsEmployee`,
`companyIdentityComplete`, `onboardingSufficient`, `routeAvailable` →

`ready | onboarding_required | entitlement_pending | entitlement_inactive |
employee_not_owned | account_incomplete | unavailable`

Chaque décision → message clair + CTA correct (route canonique), sans fuite
technique, sans boucle de redirection. Le lien « ready » pointe vers
`/agents/pierre/use` (route existante, non refondue).

---

## 9. Navigation connectée (Étape 3)

Source de vérité des **labels** = `route-registry.ts`. Convergence **progressive**
et **sûre** : le `AppShell` existant est conservé (aucune casse) ; ses labels/
titres sont dérivés du registry là où c'est sans risque. Aucune route interne/
dev/Production affichée. Header : « Mon CloneStore » (déjà en place). Navigation
desktop / tablette / mobile / clavier / lecteur d'écran.

---

## 10. Guided tour authentifié (Étape 9)

Réutilise le moteur P9.1 (`src/lib/guided-tour/**`). **Nouveau registre**
`authenticated-discovery-tour` distinct du tour public : home My CloneStore →
progression onboarding → empreinte → employés possédés → lien cockpit →
paramètres. Proposé uniquement à un client authentifié pertinent, pas pendant le
Quick Start initial ; reprise / snooze / skip / versionnement ; cibles
`data-tour-id` stables ; aucune régression du tour public.

---

## 11. Périmètres interdits (échec P9.2 si modifiés)

```
src/lib/pierre/v1/**        src/app/api/webhooks/**     scripts/p87-*
supabase/**                 .p87-*                      src/app/internal/**
src/app/founder/**          src/app/founding-partners/**
```

Le working tree contient de nombreuses modifications parallèles (lane P8). Elles
ne sont **jamais** restaurées, stagées, modifiées ni attribuées à P9.2.

---

## 12. Périmètre de code P9.2 (nouveaux fichiers)

```
src/lib/my-clonestore/**            # view-model home + cockpit-access (pur) + next-action (pur)
src/lib/client-onboarding/**        # Quick Start machine, autosave, footprint orchestration (pur, réutilise P9.1 + services existants)
src/app/api/clonestore/client-onboarding/**   # adaptateur borné (session, délègue, no SQL) — si nécessaire
src/components/my-clonestore/**     # UI (home, quick-start, empreinte guidée/continue)
src/lib/guided-tour/registry/authenticated-discovery-tour.ts   # tour authentifié
```

Fichiers existants modifiés (chirurgical, P9.2) : `src/app/profile/page.tsx`
(home), `src/app/profile/onboarding/page.tsx` (onboarding officiel), et — si
convergence nav sûre — `src/components/app/AppShell.tsx` (labels depuis registry).
Chaque modification sera prouvée « P9.2 » à l'audit final.

---

## 13. Implémentation livrée (final — plan vs réalité)

Écarts assumés par rapport au plan de conception ci-dessus (le plan précède le
code ; voici ce qui a **réellement** été construit) :

**Cœurs purs (node-testables)**
```
src/lib/my-clonestore/{types,cockpit-access,next-action,order-mapping,index}.ts
src/lib/client-onboarding/{quick-start,autosave,guided-footprint,continuous-footprint,storage,index}.ts
src/lib/nav/app-shell-nav.ts            # nav connectée dérivée de route-registry
```

**UI** — les blocs onboarding vivent **au plus près du wizard** (colocation), pas
sous `src/components/my-clonestore/` :
```
src/app/profile/onboarding/_components/{QuickStartBlock,GuidedFootprintOverview,ContinuousFootprintSurface}.tsx
```
- **QuickStartBlock** est **contrôlé** par l'état du wizard (`value`/`onChange`),
  pas via un draft séparé — c'est ce qui garantit « aucun second draft » et la
  reprise exacte après hydratation asynchrone (ref d'alignement `alignedRef`).

**Tour authentifié** : registre nommé `my-clonestore-tour.ts` (id `my-clonestore`,
6 étapes) — le nom `authenticated-discovery-tour` du plan a été remplacé.

**Adaptateur API borné** (`src/app/api/clonestore/client-onboarding/**`) : **non
créé** — inutile ce tour. La persistance reste localStorage-authoritative + sync
best-effort via l'helper existant (`persistGlobalOnboardingWithFallback`), fidèle
au GAP documenté (§5). Aucun `src/app/api/**` ajouté (périmètre interdit respecté).

**Frontière d'auth** : le verrou général a été **retiré** de `src/app/profile/layout.tsx`
(shell seul). Les tests source du verrou général (`cockpit-gate-and-intro-button.test.ts`)
ont été mis à jour pour asserter la **nouvelle** architecture ET la préservation
des verrous opérationnels (cockpit Pierre + messagerie) — aucune garantie de
sécurité affaiblie.

**CloneStory** : `src/app/profile/page.tsx` **réinjecte** `CloneStoryCockpitCard`
(CS-FINAL 1) dans la home reconstruite ; le test d'injection a été ajusté à la
home sans onglets. Aucune logique CloneStory (composant/API/pont/migration)
modifiée.

**E2E authentifié A–E** : réellement exécuté puis nettoyé (voir
`P9_2_CLIENT_ONBOARDING_QA.md` §3) — script `scripts/p92-authenticated-e2e.mjs`.
