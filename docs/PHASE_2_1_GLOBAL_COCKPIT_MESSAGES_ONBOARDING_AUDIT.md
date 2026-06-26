# PHASE 2.1 — Global Cockpit, Messages & Onboarding Architecture Audit

> Généré le : 2026-06-02
> Base : TECH-01 → TECH-11 validés. Moteur Pierre B38-B48 intact. Public launch : NO-GO externe.

---

## 1. Résumé exécutif

Le repo CloneStore dispose d'une **base cockpit premium déjà très avancée**. Ce n'est pas un projet vide — c'est un produit partiellement construit avec des décisions UI/UX solides. L'enjeu de PHASE 2 n'est pas de tout reconstruire, mais de **connecter ce qui existe** aux couches globales validées (CloneOS, CloneTrace, CloneBrief, Employee Runtime) et d'**éliminer les données mock**.

**Verdict PHASE 2.1 :**

| Décision | Résultat |
|----------|----------|
| Existe-t-il un cockpit global ? | **OUI** — `/profile/agents/page.tsx` (3773+ lignes) |
| Existe-t-il un centre de messages ? | **OUI** — `/profile/messages/page.tsx` (1214+ lignes) |
| Le cockpit est-il connecté aux libs globales ? | **NON** — local state uniquement, mock data |
| Les messages sont-ils connectés ? | **NON** — mock data |
| Pierre cockpit existe-t-il ? | **OUI** — 17 composants, données réelles |
| Onboarding global existe-t-il ? | **NON** — uniquement `/agents/pierre/setup` (Pierre-specific) |
| Les technologies sont-elles visibles ? | **OUI** — `/profile/technologies` TECH-04 complet |

**Plan PHASE 2 : connecter + enrichir + onboarder. Ne pas reconstruire.**

---

## 2. Audit par zone produit

### 2.1 Mon espace / Global Cockpit

**Fichier :** `src/app/profile/agents/page.tsx` (3773+ lignes)

**Ce qui existe :**
- ✅ Structure multi-panneaux (sidebar + main + détail)
- ✅ Mission kanban (6 colonnes : now / today / scheduled / waiting_validation / blocked / done)
- ✅ Queue de validations (avec statuts pending/approved/refused/modified/blocked)
- ✅ Salon/command center (chat libre + routing keywords CloneOS)
- ✅ Messages (8 catégories : reception, suivis, validation, preparation, briefings, livraisons, alertes, envoyes)
- ✅ Règles (CloneADN-like rule builder avec scope global/employee/technology)
- ✅ Timeline CloneTrace (type `TraceItem` local)
- ✅ Briefings (type `BriefingItem` local)
- ✅ Alertes (type `AlertItem` local)
- ✅ Dashboard technologies (type `TechnologyItem` local)
- ✅ Multi-agent metadata (type `AgentMeta` avec slug/name/role/href/active/status)
- ✅ `CloneOsPlan` type : summary, employees, unavailable, tasks, risk, validationRequired, nextStatus
- ✅ `ROUTING_KEYWORDS` : pierre, clara, recrutement, CV, etc.
- ✅ UI premium Liquid Glass
- ✅ Responsive partiel

**Ce qui manque :**
- ❌ Connection réelle aux libs globales (CloneOS, CloneTrace, CloneBrief, CloneGuard)
- ❌ Données réelles Employee Runtime Contract (hardcodé mock)
- ❌ Connection à GlobalTechnologyConfig (tech items = mock)
- ❌ Connection Supabase pour les missions/validations réelles
- ❌ `CloneOsPlan` non branché sur `buildCloneOSCommandPlan()` TECH-08
- ❌ Trace items non branchés sur `GlobalTraceEvent` TECH-07
- ❌ Briefing items non branchés sur `CloneBriefExecutiveSummary` TECH-09
- ❌ Alertes non branchées sur `CloneVoiceGuardrailCheckResult` ni Guard validation

**Verdict :** Cockpit global complet côté UI. **Besoin : brancher les libs globales.**

---

### 2.2 Mes employés IA

**Dans `/profile/agents/page.tsx` :**
- ✅ Type `AgentMeta` (slug, name, role, description, href, setupHref, useHref, active, status)
- ✅ Références à Pierre (slug=pierre, active=true), Clara, Emma, Noah (active=false)
- ✅ `lib/agent-catalog.ts` : `AGENTS[]` avec Pierre actif, Clara/Emma/others

**Dans `/profile/page.tsx` :**
- ✅ Onglet "Mes employés" avec cards
- ✅ Liste des agents avec `AgentsCard.tsx`

**Ce qui manque :**
- ❌ Non connecté à `EMPLOYEE_RUNTIME_REGISTRY` (TECH-02)
- ❌ `launch_stage` non utilisé pour distinguer active/bientôt/roadmap
- ❌ `required_technologies` non vérifiées en temps réel
- ❌ Readiness score depuis `GlobalTechnologyConfig` non affiché par employé
- ❌ Pas de lien direct depuis cockpit global vers cockpit Pierre
- ❌ Clara/Emma déclarées dans agent-catalog mais elles ne sont PAS dans EMPLOYEE_RUNTIME_REGISTRY

**Verdict :** Partiel. **Besoin : brancher Employee Runtime + corriger la cohérence.**

---

### 2.3 Commande globale CloneStore

**Dans `/profile/agents/page.tsx` :**
- ✅ Salon (CloneOS command center) existe — champ texte libre, envoi
- ✅ `ROUTING_KEYWORDS` pour routing vers pierre/clara
- ✅ `CloneOsPlan` type pour afficher le plan
- ✅ Simulation de réponse CloneOS (mock local)
- ✅ Pattern correct : comprendre → router → plan → validation

**Ce qui manque :**
- ❌ Non connecté à `buildCloneOSCommandPlan()` de TECH-08
- ❌ Non connecté à `buildCloneOSCommandContext()` de TECH-08
- ❌ Non connecté à `evaluateGlobalGuard()` de TECH-06
- ❌ Non connecté à `createTraceEvent()` de TECH-07
- ❌ Mode plan-only (read-only, pas d'exécution réelle) à formaliser
- ❌ Guard result non affiché dans le plan
- ❌ Trace event non créé lors de la commande

**Verdict :** UI prête, logique métier absente. **Besoin : connecter CloneOS TECH-08 en mode read-only.**

---

### 2.4 Messages

**Fichier :** `src/app/profile/messages/page.tsx` (1214 lignes)

**Ce qui existe :**
- ✅ Structure dual-panel (liste + détail)
- ✅ 6 catégories : preparations, suivis, briefings, livraisons, alertes, envoyes
- ✅ Recherche, filtrage, pin/archive/read
- ✅ Types : `MessageCategory`, `MessagePriority`, `MessageStatus`, `MessageSource` (CloneOS/CloneTrace/CloneGuard/CloneChat/Pierre/Clara...)
- ✅ UI premium Liquid Glass

**Ce qui manque :**
- ❌ Mock data — aucun message réel
- ❌ Non connecté CloneTrace (TECH-07)
- ❌ Non connecté CloneBrief (TECH-09)
- ❌ Non connecté Guard validations (TECH-06)
- ❌ Non connecté aux actions Pierre réelles
- ❌ Les 4 onglets cibles (Suivis / Briefings / Livraisons / Alertes) ne sont pas le format actuel (6 catégories)
- ❌ "preparations" et "envoyes" sont des catégories secondaires, pas des onglets principaux

**Verdict :** Structure solide mais mock. **Besoin : simplifier en 4 onglets principaux + connecter données réelles.**

---

### 2.5 Briefings

**Dans `/profile/agents/page.tsx` :**
- ✅ `BriefingItem` type local (id, title, summary, period, blockers, delivered, validations)
- ✅ Section briefings visible dans le cockpit
- ✅ Visuellement connecté au concept CloneBrief

**Dans `/profile/messages/page.tsx` :**
- ✅ Catégorie "briefings" existe

**Ce qui manque :**
- ❌ Non connecté à `generateCloneBrief()` de TECH-09
- ❌ Non connecté à `buildPierreDailyBrief()` de TECH-09
- ❌ Non connecté à `buildTechnologyReadinessReport()` de TECH-11
- ❌ Pas de distinction daily/weekly/mission/risk/validation
- ❌ Blocages/risques non surfacés depuis CloneGuard

**Verdict :** Conceptuellement présent, non connecté. **Besoin : brancher CloneBrief TECH-09.**

---

### 2.6 Livraisons

**Dans `/profile/agents/page.tsx` :**
- ✅ Missions en statut "done" représentent les livraisons
- ✅ Catégorie "livraisons" dans les messages

**Dans Pierre cockpit (`/app/agents/pierre/use/`) :**
- ✅ `PierreDocumentStudio.tsx` — studio de documents RH
- ✅ `PierreArtifactStudio.tsx` — studio d'artefacts
- ✅ Documents Pierre réels (contrats, emails, PDFs)

**Ce qui manque :**
- ❌ Pas de vue globale "Livraisons" consolidant les documents de tous les employés IA
- ❌ Non connecté à `CloneTracePreparedDocumentEvent` de TECH-07
- ❌ Non connecté aux artefacts Pierre réels depuis le cockpit global
- ❌ Statut livré/en attente non piloté par CloneTrace

**Verdict :** Livraisons Pierre existent mais ne remontent pas dans le cockpit global.

---

### 2.7 Alertes

**Dans `/profile/agents/page.tsx` :**
- ✅ `AlertItem` type (id, title, detail, tone, action)
- ✅ Section alertes visible
- ✅ Tons : info / success / warning / critical

**Ce qui manque :**
- ❌ Non connecté aux validations Guard réelles (TECH-06)
- ❌ Non connecté aux blocages CloneOS (TECH-08)
- ❌ Non connecté aux risques critiques CloneBrief (TECH-09)
- ❌ Alertes non filtrées par severity
- ❌ Pas de "action requise" connecté à la validation queue

**Verdict :** UI présente, données mock. **Besoin : brancher Guard + CloneTrace events critiques.**

---

### 2.8 Onboarding global entreprise

**Ce qui existe :**
- ✅ `src/app/agents/pierre/setup/page.tsx` — Empreinte Entreprise (7 sections Pierre-specific)
- ✅ `src/app/profile/page.tsx` onglet "Empreinte" — résumé de l'empreinte

**Ce qui manque :**
- ❌ **Pas d'onboarding global** — tout est Pierre-specific
- ❌ Pas de flow "Bienvenue dans CloneStore" pour un nouveau client
- ❌ Pas de configuration des humains de l'entreprise au niveau global
- ❌ Pas de configuration des règles globales (distinctes des règles Pierre)
- ❌ Pas de configuration des technologies actives/désactivées
- ❌ Pas de configuration des préférences globales
- ❌ Pas de sélection/activation des employés IA
- ❌ Non branché sur `GlobalEnterpriseMemory` (TECH-05)
- ❌ Non branché sur `DEFAULT_GLOBAL_POLICY_RULES` (TECH-06)

**Verdict :** Onboarding global ABSENT. Pierre setup existe mais c'est Pierre-only. **C'est l'un des plus grands manques.**

---

### 2.9 Cockpit Pierre

**Fichiers :** `src/app/agents/pierre/use/` (17 composants)

**Ce qui existe :**
- ✅ `PierreCockpitShell.tsx` — shell complet du cockpit Pierre
- ✅ `PierreWorkBoard.tsx` — tableau de travail Pierre
- ✅ `PierreCommandCenter.tsx` — centre de commande Pierre
- ✅ `PierreTraceTimeline.tsx` — timeline trace Pierre
- ✅ `PierreValidationCenter.tsx` — validations Pierre
- ✅ `PierreDocumentStudio.tsx` + `PierreArtifactStudio.tsx` — documents et artefacts
- ✅ `PierreCloneADNPanel.tsx` — ADN Pierre
- ✅ Données réelles (Supabase, API Pierre)
- ✅ `usePierreCockpit.ts` hook

**Ce qui doit rester intact :**
- Pierre moteur B38-B48 : **INTOUCHÉ**
- Pierre cockpit : **CONSERVER** — ne pas reconstruire
- `PierreCommandCenter` : **NE PAS FUSIONNER** avec cockpit global (Pierre garde son propre espace)

**Ce qui doit être connecté (sans toucher Pierre) :**
- Lien depuis cockpit global → cockpit Pierre via `/agents/pierre/use`
- Pierre actif affiché dans la carte employés du cockpit global
- Missions Pierre remontées dans le kanban global (read-only depuis CloneTrace)

**Verdict :** Pierre cockpit est excellent et doit rester Pierre-specific. Le cockpit global doit y pointer.

---

### 2.10 Technologies UI

- ✅ `/profile/technologies/page.tsx` — TECH-04 complet, premium, 13 technologies
- ✅ Lien depuis `/profile/page.tsx` onglet Technologies
- ❌ Pas de résumé technologies dans `/profile/agents` cockpit (les tech items sont mock)
- ❌ Pas de lien direct depuis cockpit vers `/profile/technologies`

---

### 2.11 Launch readiness / Go-live

- ✅ `/profile/launch-readiness/page.tsx` — exist
- ✅ `/profile/go-live/page.tsx` — exist
- Ces pages doivent rester séparées — admin/founder only
- Ne pas les lier au cockpit client
- Ne pas modifier

---

## 3. Global vs Pierre-only

### Ce qui est déjà global CloneStore

| Composant | Localisation | Portée |
|-----------|-------------|--------|
| `/profile/agents/page.tsx` | Cockpit global | Global — tous agents |
| `/profile/messages/page.tsx` | Messages center | Global |
| `/profile/page.tsx` | Admin center | Global |
| `/profile/technologies/page.tsx` | Technologies | Global (TECH-04) |
| `lib/agent-catalog.ts` | Catalogue agents | Global |
| `lib/clonestore/employees/` | Employee Runtime | Global (TECH-02) |
| `lib/clonestore/technologies/` | Tech config | Global (TECH-03) |
| `lib/clonestore/cloneos/` | CloneOS | Global (TECH-08) |
| `lib/clonestore/trace/` | CloneTrace | Global (TECH-07) |
| `lib/clonestore/brief/` | CloneBrief | Global (TECH-09) |
| `lib/clonestore/guard/` | CloneGuard | Global (TECH-06) |
| `lib/clonestore/adn/` | CloneADN | Global (TECH-05) |
| `lib/clonestore/voice/` | CloneVoice readiness | Global (TECH-10) |
| `lib/clonestore/readiness/` | Tech Readiness Gate | Global (TECH-11) |

### Ce qui est encore Pierre-only

| Composant | Localisation | Doit rester Pierre-only ? |
|-----------|-------------|--------------------------|
| `/app/agents/pierre/use/` | Pierre cockpit | OUI — ne pas toucher |
| `/app/agents/pierre/setup/page.tsx` | Empreinte form | OUI (mais inspirer onboarding global) |
| `src/lib/pierre/**` | Moteur Pierre | OUI — INTOUCHÉ |
| `src/components/pierre/**` | Composants Pierre | OUI |
| `src/app/api/pierre/**` | API Pierre | OUI |

### Ce qui doit être extrait / globalisé (sans toucher Pierre)

| Action | Quoi | Cible |
|--------|------|-------|
| Connecter | Cockpit global → Employee Runtime TECH-02 | Cards employés réelles |
| Connecter | Salon cockpit → CloneOS TECH-08 (plan-only) | Command bar live |
| Connecter | Trace timeline → GlobalTraceEvent TECH-07 | Timeline réelle |
| Connecter | Briefings → CloneBrief TECH-09 | Briefings réels |
| Connecter | Alertes → CloneGuard blocked/validation TECH-06 | Alertes réelles |
| Créer | Onboarding global → GlobalEnterpriseMemory TECH-05 | Flow d'onboarding |
| Exposer | Pierre status dans cockpit global | Card Pierre avec lien |
| Lier | Messages → CloneTrace + CloneBrief events | Messages opérationnels |

---

## 4. Matrice de maturité PHASE 2

| Zone | Statut | Portée | CloneOS | CloneTrace | CloneBrief | Emp. Runtime | UI Premium | Responsive | Priorité | Risque |
|------|--------|--------|---------|------------|------------|--------------|-----------|------------|----------|--------|
| Cockpit global shell | partial | global | no | no | no | no | yes | partial | **now** | Critique |
| Command bar salon | UI-only | global | no | no | no | no | yes | partial | **now** | Critique |
| Last request panel | absent | global | no | no | no | no | no | no | **now** | Fort |
| Mes employés IA | partial | global | no | no | no | no | yes | partial | **now** | Fort |
| Messages 4 onglets | partial | global | no | no | no | no | yes | partial | **now** | Fort |
| Briefings | UI-only | global | no | no | no | no | yes | partial | **now** | Fort |
| Alertes | UI-only | global | no | no | no | no | yes | partial | **now** | Moyen |
| Livraisons | partial | global | no | partial | no | no | yes | partial | **soon** | Moyen |
| Onboarding global | absent | global | no | no | no | no | no | no | **now** | Critique |
| Pierre cockpit | real | Pierre | partial | partial | no | yes | yes | yes | relier | Bas |
| Technologies | real | global | no | no | no | partial | yes | yes | lien | Bas |
| Launch/go-live | real | admin | no | no | no | no | partial | partial | rester | Bas |

---

## 5. Ordre de construction PHASE 2.2 → PHASE 2.9

### PHASE 2.2 — Global Cockpit Shell / Mon espace Premium

**Objectif :** Transformer `/profile/agents/page.tsx` de cockpit mock → cockpit connecté.

Actions :
- Connecter cards employés à `EMPLOYEE_RUNTIME_REGISTRY` (TECH-02)
- Afficher Pierre actif avec `launch_stage=launch_candidate`, autres avec statut roadmap
- Connecter tech items à `DEFAULT_GLOBAL_TECH_CONFIGS` (TECH-03)
- Afficher readiness scores réels par technologie
- Lien depuis card Pierre → `/agents/pierre/use`
- Supprimer les AGENTS mock dupliqués (clara/emma actives dans mock ≠ réalité)

**Périmètre :** `/profile/agents/page.tsx` + `_ui/` components
**Ne pas toucher :** Pierre moteur, GO-LIVE flags, Pierre cockpit
**Résultat :** Cockpit global honnête, données cohérentes avec TECH-02/TECH-03/TECH-11

---

### PHASE 2.3 — CloneOS Global Command Bar

**Objectif :** Connecter le salon (command center) au pipeline CloneOS TECH-08.

Actions :
- Connecter salon input → `classifyCloneOSCommand()` (TECH-08)
- Connecter → `buildCloneOSCommandContext()` (TECH-08)
- Connecter → `buildCloneOSCommandPlan()` (TECH-08)
- Mode plan-only : afficher le plan sans exécuter
- Afficher : compréhension, routage, employé sélectionné, Guard result, actions prévues
- Trace event créé (préparation, pas exécution)
- Guard evaluation affichée (bloqué/requis validation/autorisé)

**Périmètre :** Salon dans `/profile/agents/page.tsx`
**Contrainte :** Pas d'exécution réelle, pas d'écriture Supabase, plan-only
**Résultat :** Command bar qui montre vraiment CloneOS en action

---

### PHASE 2.4 — Last Request Panel / CloneOS Result Timeline

**Objectif :** Bloc "À propos de votre dernière commande" avec le résultat complet.

Actions :
- Stocker (localStorage ou state) le dernier `CloneOSCommandCenterResult`
- Panel dédié : compréhension → routage → plan → Guard → Trace events
- Timeline des événements CloneTrace liés à cette commande
- Bloc "validations en attente" avec actions humaines
- Bloc "blocages" si Guard a refusé

**Périmètre :** Nouveau panel dans `/profile/agents/page.tsx`
**Ne pas toucher :** Ni Pierre moteur, ni Supabase write
**Résultat :** Le client voit exactement ce que CloneStore a compris et prévu

---

### PHASE 2.5 — Messages Center 4 Onglets

**Objectif :** Simplifier et connecter les messages.

Actions :
- Fusionner/simplifier `/profile/messages/page.tsx` en 4 onglets : Suivis / Briefings / Livraisons / Alertes
- Suivis : brancher sur CloneTrace events récents (TECH-07) — statuts missions
- Briefings : brancher sur CloneBrief summaries (TECH-09) — quotidien/hebdo
- Livraisons : brancher sur documents préparés par Pierre (trace events `document_prepared`)
- Alertes : brancher sur Guard validations requises + blocages (TECH-06)
- Garder l'UI Liquid Glass premium existante
- Mock data → données réelles depuis les libs

**Périmètre :** `/profile/messages/page.tsx`
**Résultat :** Messages opérationnels connectés, 4 onglets clairs

---

### PHASE 2.6 — Global Onboarding Enterprise Foundation

**Objectif :** Créer le flow d'onboarding global pour un nouveau client CloneStore.

Actions :
- Nouvelle page `/profile/onboarding/page.tsx` ou flow dans `/profile/page.tsx`
- Étape 1 : Identité entreprise (nom, secteur, taille) → `GlobalEnterpriseMemory.identity`
- Étape 2 : Humains clés (équipe, contacts, circuit validation) → `GlobalEnterpriseMemory.people`
- Étape 3 : Communication (ton, préférences, règles) → `GlobalEnterpriseMemory.communication`
- Étape 4 : Employés IA (sélectionner/activer Pierre, voir roadmap des autres)
- Étape 5 : Technologies (confirmer les technologies actives selon le plan)
- Étape 6 : Préférences (notifications, langue, timezone)
- Save vers `GlobalEnterpriseMemory` via API (lecture seule si pas de Supabase live)

**Périmètre :** Nouveau flow, inspire de `pierre/setup/page.tsx` mais global
**Contrainte :** Pas de migration DB, lecture/écriture localStorage en attendant RLS prod
**Résultat :** Onboarding clair "CloneStore est votre OS d'employés IA"

---

### PHASE 2.7 — Pierre Cockpit Integration Into Global Space

**Objectif :** Rendre Pierre accessible depuis le cockpit global sans le reconstruire.

Actions :
- Card Pierre dans cockpit global avec : statut (actif), dernière mission, readiness score
- Bouton "Ouvrir le cockpit Pierre" → `/agents/pierre/use`
- Bouton "Configuration Pierre" → `/agents/pierre/setup`
- Remonter les 3 dernières missions Pierre dans le kanban global (read-only, depuis CloneTrace)
- Remonter les validations Pierre en attente dans la queue globale
- Pierre reste pierre-only côté moteur — juste lecture depuis CloneTrace

**Périmètre :** Cards et liens dans `/profile/agents/page.tsx`
**Contrainte :** Pierre engine INTOUCHÉ, lecture CloneTrace uniquement
**Résultat :** Pierre visible dans l'espace global sans dupliquer son cockpit

---

### PHASE 2.8 — Responsive Premium Polish

**Objectif :** Cockpit parfait sur mobile/tablette/desktop.

Actions :
- Audit responsive de `/profile/agents/page.tsx` (3773 lignes)
- Responsive de `/profile/messages/page.tsx`
- Responsive du nouvel onboarding
- Test sur breakpoints mobile (375px), tablette (768px), desktop (1440px)
- Animations sobres (déjà présentes dans Liquid Glass)
- Hiérarchie forte et lisibilité maximale

**Périmètre :** Pages cockpit + messages + onboarding
**Résultat :** Expérience premium sur tous les devices

---

### PHASE 2.9 — Phase 2 Final QA Gate

**Objectif :** Validation finale PHASE 2 avant préparation lancement.

Actions :
- Audit UX : est-ce que le cockpit montre CloneStore comme OS d'employés IA ?
- Audit données : tout ce qui s'affiche provient de sources réelles ?
- Audit sécurité : pas de données sensibles exposées
- Tests PHASE 2 : nouveaux tests pour chaque bloc (2.2 → 2.8)
- Tests régression : TECH-05 → TECH-11 toujours verts
- `npx tsc --noEmit` : 0 erreur
- `npm run build` : clean
- Public launch toujours NO-GO externe

**Résultat :** PHASE 2 validée côté repo, prête pour PHASE 3 (marketing / support / docs commerciales)

---

## 6. Ce qu'il ne faut PAS faire maintenant

| À éviter | Raison |
|----------|--------|
| Refaire Pierre moteur | Intact, fonctionnel, stabilisé |
| Créer Emma/Lucas/Sophie actifs | Hors périmètre PHASE 2 |
| Temps réel Supabase subscriptions | Après RLS production |
| Notifications push/email | Après société + Stripe live |
| CloneVoice actif | Prérequis non validés |
| Analytics avancés | Post-lancement |
| Marketplace agents | Post-lancement |
| Workflow Pierre multi-agent profond | Post-lancement |
| Refaire homepage complète | Non prioritaire PHASE 2 |
| Modifier /demo/pierre | Intact |
| Modifier checkout/Stripe | Après Stripe live |
| Déclarer le lancement client prêt | Jamais — blockers externes non levés |

---

## 7. Risques si PHASE 2 non faite avant lancement

| Risque | Impact |
|--------|--------|
| Produit perçu comme "juste Pierre" | Critique — CloneStore n'est pas lu comme un OS |
| Cockpit trop vide après paiement | Critique — churn immédiat |
| Client perdu après achat | Critique — support explosion |
| Messages pas opérationnels | Fort — perte de confiance |
| Onboarding absent | Fort — client ne sait pas par où commencer |
| CloneTrace/CloneBrief invisibles | Fort — TECH-07/09 invisibles pour le client |
| Technologies vues comme marketing | Moyen — TECH-11 "readiness" sans visibilité client |
| Aucun "effet OS" | Critique — positionnement produit raté |

---

## 8. Séparation Launch vs Later

### À faire AVANT lancement public (PHASE 2.2 → 2.9)

- ✅ Mon espace global premium (cockpit connecté)
- ✅ Commande globale CloneOS en mode plan
- ✅ Bloc "dernière commande" compréhensible
- ✅ Messages 4 onglets (Suivis / Briefings / Livraisons / Alertes)
- ✅ Briefings CloneBrief visibles
- ✅ Alertes validations/blocages CloneGuard
- ✅ Onboarding global minimal mais propre
- ✅ Accès Pierre propre depuis cockpit global
- ✅ Responsive impeccable
- ✅ Technologies accessibles depuis cockpit
- ✅ 0 donnée mock visible par le client

### À faire APRÈS lancement public

- ❌ Multi-agent Emma/Lucas/Sophie opérationnels
- ❌ Workflows multi-agents profonds
- ❌ Temps réel complet (Supabase realtime)
- ❌ Notifications push/email
- ❌ CloneVoice actif
- ❌ Analytics avancés
- ❌ Marketplace agents
- ❌ CloneLearn, CloneSignals, CloneReview
- ❌ Stockage avancé messages
- ❌ Mobile app native

---

## 9. Décision : prochain bloc exact

**PHASE 2.2 — Global Cockpit Shell / Mon espace Premium**

Priorité maximale. C'est le premier écran qu'un client payant voit après son achat.

Objectif PHASE 2.2 :
1. Connecter les cards employés à `EMPLOYEE_RUNTIME_REGISTRY`
2. Afficher Pierre actif, autres en roadmap/bientôt (cohérence TECH-02)
3. Connecter les tech items à `DEFAULT_GLOBAL_TECH_CONFIGS` avec readiness scores réels
4. Ajouter un lien direct vers cockpit Pierre
5. Supprimer les agents fictifs actifs (Clara/Emma actives dans mock ≠ Employee Registry)
6. Premium, lisible, honnête

**Ne pas toucher :** Pierre moteur, GO-LIVE flags, TECH-01 → TECH-11.

---

## 10. Fichiers à créer / modifier dans PHASE 2.2 → 2.9

### PHASE 2.2 (touches minimales)
- Modifier : `src/app/profile/agents/page.tsx` — connecter Employee Runtime + tech data
- Pas de nouveau fichier — connexion uniquement

### PHASE 2.3
- Modifier : `src/app/profile/agents/page.tsx` — salon branché CloneOS
- Modifier ou créer : `src/app/api/clonestore/command/route.ts` — API plan-only

### PHASE 2.4
- Modifier : `src/app/profile/agents/page.tsx` — panel "dernière commande"

### PHASE 2.5
- Modifier : `src/app/profile/messages/page.tsx` — 4 onglets + vraies données

### PHASE 2.6
- Créer : `src/app/profile/onboarding/page.tsx`
- Créer : `src/app/api/clonestore/onboarding/route.ts`

### PHASE 2.7
- Modifier : `src/app/profile/agents/page.tsx` — card Pierre avec lien cockpit

### PHASE 2.8
- Responsive polish : pages cockpit + messages + onboarding

### PHASE 2.9
- Tests + QA gate

---

## 11. Stack technologique PHASE 2

```
UI :          React + Next.js App Router — inchangé
Design :      Liquid Glass + crème/ivoire/graphite — inchangé
State :       React useState + localStorage (en attendant Supabase live)
Données :     Libs globales TECH-02 → TECH-11 (pure functions, no DB)
Auth :        Supabase auth — inchangé
DB :          Supabase read-only pour orders/profiles — pas de nouvelles tables
API :         Next.js Route Handlers — plan-only, pas d'exécution
Tests :       Vitest — pattern statique comme TECH-11
```

---

```
TECH-01 → TECH-11 ✅ (intact)
PHASE 2.1 — Audit ✅ (ce document)
PHASE 2.2 — Global Cockpit Shell (prochain)
PHASE 2.3 — CloneOS Command Bar
PHASE 2.4 — Last Request Panel
PHASE 2.5 — Messages 4 Onglets
PHASE 2.6 — Global Onboarding
PHASE 2.7 — Pierre Integration
PHASE 2.8 — Responsive Polish
PHASE 2.9 — Final QA Gate
```
