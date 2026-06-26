# TECH-01 — CloneStore Technologies Real Audit, Employee Runtime Contract Direction & Construction Order

## 1. Résumé exécutif

Le repo contient deux couches de technologies :

**Couche A — 12 définitions plateforme** (`src/lib/clonestore/technologies/contracts.ts` + `registry.ts`) : toutes les 12 technologies sont définies avec types, capabilities et settings. C'est le socle conceptuel complet.

**Couche B — 6 technologies B46 visibles** (`technology-b46-registry.ts`) : uniquement CloneOS, CloneADN, CloneGuard, CloneTrace, CloneVoice, CloneChat ont un moteur de readiness, status, guardrails et snapshot. Ces 6 ont une API REST complète (`/api/clonestore/technologies`).

**Couche C — Implémentations Pierre-only** (`src/lib/pierre/`) : CloneGuard, CloneTrust, ClonePolicy, CloneContinuum, CloneTrace ont de vraies implémentations runtime dans les tests/lib Pierre. Elles ne sont pas globalisées.

**Problème central** : Deux lacunes architecturales majeures bloquent la scalabilité multi-employés.

1. **Pas de Employee Runtime Contract** : Il n'existe pas de contrat commun déclarant ce qu'est un employé IA, ce qu'il sait faire, quelles technologies il utilise et comment il se branche sur le socle global. Pierre est câblé directement — chaque futur employé devra recâbler tout depuis zéro.

2. **Technologies pas globalisées** : Les technologies internes (ClonePolicy, CloneContinuum, CloneTrust, CloneReview, CloneSignals, CloneLearn, CloneBrief) sont soit Pierre-only soit définitions-seulement. Elles ne sont pas configurables au niveau plateforme. CloneADN est trop Pierre-centric (via Empreinte B44). Le dashboard /profile/technologies contient des erreurs (CloneTrust décrit comme "zéro-confiance" — FAUX ; CloneVoice badge "Actif" alors que status=disabled).

**Décision architecture** : On ne construit pas chaque employé IA comme un système séparé. Les technologies doivent être des couches système globales, indépendantes, réutilisables et branchables. Les employés IA se branchent sur ces technologies via un contrat commun — l'Employee Runtime Contract.

**Modèle cible** :
```
CloneStore Platform
→ Global Technologies (CloneOS, CloneADN, CloneGuard, CloneTrace, ...)
→ Employee Runtime Contract (déclaration + plug-in global)
→ Employee IA métier : Pierre (RH), Emma (support), Lucas (finance), ...
```

---

## 2. Audit par technologie

### CloneOS

- **Existe en code ?** Oui. Définition complète dans contracts.ts + registry.ts + technology-b46-registry.ts. Implémentation runtime dans Pierre (hr-mission-control.ts, hr-workflows.ts).
- **Existe en UI ?** Oui — /profile/technologies (section "actif" + B46 card). Décrit comme "Moteur interne / Orchestration".
- **Configurable par client ?** Non. `is_customer_configurable: false` dans la définition.
- **Relié à Pierre ?** Oui — `pierre_required: true`. CloneOS est le noyau d'exécution Pierre.
- **Relié au cockpit global ?** Partiellement — via le snapshot B46, pas via une interface de commandement globale.
- **API ?** Oui — `/api/clonestore/technologies` (lecture/snapshot).
- **Tests ?** Oui — technologies-b46-core.test.ts, technology-registry.test.ts, technologies-routes-b46.test.ts.
- **Portée ?** Pierre-only pour la runtime. Définition globale CloneStore.
- **Manque ?** Interface de commandement global multi-employés. Hors scope V1. À préparer dans TECH-08.

### CloneADN

- **Existe en code ?** Oui — profonde. Définition contracts.ts + registry.ts + B46 registry. Empreinte enterprise: `src/lib/clonestore/empreinte/` (enterprise-schema.ts, enterprise-normalizer.ts, enterprise-completion.ts, enterprise-validation.ts, enterprise-memory-bridge.ts, enterprise-versioning.ts). Pierre empreinte: `src/lib/pierre/empreinte/`. Cockpit `src/app/agents/pierre/setup/page.tsx` = UI de configuration CloneADN.
- **Empreinte globale ou seulement Pierre ?** Majoritairement Pierre. La base enterprise existe mais n'est pas utilisée par d'autres employés.
- **Mémoire entreprise ?** Oui — enterprise-schema encodes identity, tone, people, policy, autonomy, messaging, memory.
- **Configuration client ?** Oui — via /agents/pierre/setup (Empreinte Entreprise). C'est la seule interface de config CloneADN actuellement.
- **Documents / styles / règles ?** Oui — B44 complet avec styles de documents, règles de validation, ton, formats.
- **API ?** Oui — `/api/pierre/empreinte` (get/save).
- **Tests ?** Oui — empreinte-b44-enterprise.test.ts, pierre-empreinte-b44.test.ts.
- **Portée ?** Pierre-only pour la config actuelle. Définition globale CloneStore.
- **Manque ?** Interface globale non couplée à Pierre. Si d'autres employés arrivent, chacun aurait sa propre config au lieu d'une mémoire entreprise partagée. À construire : Global Enterprise Memory Layer (TECH-05).

### CloneGuard

- **Existe en code ?** Oui — complet. Définition B46 + registry + Pierre implémentation (hr-cloneguard.ts, hr-cloneguard-runtime.ts + hr-governance.ts + hr-governance-runtime.ts).
- **Règles de risque ?** Oui — niveaux green/orange/red/black, pipeline CloneGuard → ClonePolicy → CloneTrust.
- **Validation humaine ?** Oui — hr-cloneguard bloque et route vers validation humaine.
- **Permissions/autonomie ?** Oui — via CloneTrust intégré.
- **Global ou seulement Pierre ?** Pierre-only pour la runtime. Config B46 globale.
- **API ?** Oui — via snapshot B46. Pas d'API de gestion des règles globale.
- **Tests ?** Oui — hr-cloneguard.test.ts, hr-cloneguard-runtime.test.ts.
- **Manque ?** Interface de configuration des règles cliente globale (TECH-06). Actuellement les règles sont dans le code Pierre, pas configurables par le client.

### CloneTrace

- **Existe en code ?** Oui — complet. Définition B46 + registry + Pierre (hr-audit-trail.ts, hr-audit-trail-runtime.ts, observability B43).
- **Logs/timeline/audit ?** Oui — audit trail complet dans Pierre avec events, decisions, blocages.
- **Visible client ?** Non — aucune UI d'audit client. La timeline n'est pas exposée dans /profile ni dans le cockpit.
- **Global ou seulement Pierre ?** Pierre-only. Définition globale.
- **API ?** Oui — via snapshot B46. Pas d'API timeline consultable côté client.
- **Tests ?** Oui — hr-audit-trail.test.ts + observability-b43.
- **Manque ?** UI timeline visible pour le client (TECH-07). C'est un manque majeur de crédibilité.

### CloneVoice

- **Existe en code ?** Définition complète dans contracts.ts + B46 registry. Status = "disabled". Runtime = "disabled".
- **UI ?** Affiché dans /profile/technologies avec badge "Actif" — ERREUR. La réalité : désactivé.
- **Vrai pipeline voix ?** Non. Aucun pipeline de reconnaissance vocale ou TTS.
- **Seulement roadmap ?** Oui, effectivement.
- **Que faut-il préparer sans surcoder ?** Corriger le badge UI (montrer "Bientôt" au lieu d'"Actif"). Garder l'infrastructure de status B46. Ne pas implémenter le vrai pipeline voice maintenant.
- **Manque ?** Badge UI correct + positionnement honnête en "bientôt disponible" (TECH-10 light).

### CloneChat

- **Existe en code ?** Définition complète B46. Status = "needs_configuration". Cockpit Pierre (/agents/pierre/use) est une forme de CloneChat Pierre-only.
- **Vraie interface ?** Le cockpit Pierre est l'interface conversationnelle de Pierre. Pas d'interface unifiée multi-employés.
- **Support seulement ou commandement ?** Commandement pour Pierre. Pas de support général.
- **Relié à CloneOS ou non ?** Via Pierre — oui. Au niveau plateforme — non.
- **Manque ?** Clarification du scope (le cockpit Pierre IS CloneChat pour Pierre). Badge "À configurer" cohérent avec le code. Pas de travail urgent.

### ClonePolicy

- **Existe en code ?** Oui — Pierre only. hr-clonepolicy.ts + tests. Dans contracts.ts comme "TechnologySlug" mais PAS dans technology-b46-types.ts (les 6 visibles). Affiché dans /profile/technologies comme "roadmap Q3 2026".
- **Utilisé par Pierre ?** Oui — fait partie du pipeline CloneGuard → ClonePolicy → CloneTrust.
- **Globalisé ?** Non. Pierre-only.
- **Configurable ?** Non par le client. Les règles sont dans le code Pierre.
- **Tests ?** Oui — hr-clonepolicy.test.ts.
- **Manque ?** Interface client de gestion des politiques (TECH-06).

### CloneContinuum

- **Existe en code ?** Oui — Pierre only. hr-continuity.ts + tests. Dans contracts.ts mais PAS dans technology-b46-types.ts. Affiché dans /profile/technologies comme "roadmap Q3 2026".
- **Missions persistantes ?** Oui — hr-continuity gère la reprise.
- **Relances ?** Oui — hr-continuity + CloneSignals partiellement.
- **Planification ?** Partielle.
- **Globalisé ?** Non. Pierre-only.
- **Tests ?** Oui — hr-continuity.test.ts.
- **Manque ?** Globalisation et configuration client. Peut attendre post-launch.

### CloneTrust

- **Existe en code ?** Oui — Pierre only. hr-clonetrust.ts + hr-governance.ts + tests. Dans contracts.ts mais PAS dans technology-b46-types.ts (6 visibles). Affiché dans /profile/technologies comme "roadmap Q4 2026" avec description INCORRECTE ("zéro-confiance" — faux, c'est "autonomie graduelle").
- **Niveaux d'autonomie ?** Oui — pipeline CloneGuard → ClonePolicy → CloneTrust calcule le niveau d'autonomie.
- **Lié à CloneGuard / ClonePolicy ?** Oui — directement dans le pipeline Pierre.
- **Configurable ?** Non par le client.
- **Tests ?** Oui — hr-clonetrust.test.ts, hr-governance.test.ts.
- **Manque ?** Description correcte en UI. Interface de configuration autonomie client. Post-launch.

### CloneReview

- **Existe en code ?** Définition dans contracts.ts + registry.ts uniquement. Aucune implémentation runtime. Roadmap Q4 2026 dans l'UI.
- **Contrôle qualité ?** Non implémenté au niveau plateforme. Pierre génère des documents mais pas de CloneReview explicite dessus.
- **Pré-envoi / pré-document ?** Non.
- **Globalisé ?** Non.
- **Tests ?** Non.
- **Manque ?** Implémentation. Post-launch.

### CloneSignals

- **Existe en code ?** Définition dans contracts.ts + registry.ts uniquement. Observabilité B43 dans Pierre (erreurs, health) mais pas CloneSignals au sens proactif/business. Roadmap Q1 2027 dans l'UI.
- **Déclencheurs temporels ?** Non implémentés.
- **Alertes ?** Observabilité basique Pierre uniquement.
- **Réveils de mission ?** CloneContinuum partiel.
- **Globalisé ?** Non.
- **Tests ?** Non pour CloneSignals. Observabilité B43 oui.
- **Manque ?** Implémentation. Post-launch.

### CloneLearn

- **Existe en code ?** Définition dans contracts.ts + registry.ts uniquement. Aucune implémentation. Roadmap Q1 2027 dans l'UI.
- **Apprentissage depuis validations/corrections ?** Non.
- **Enrichissement CloneADN ?** Non.
- **Globalisé ?** Non.
- **Tests ?** Non.
- **Manque ?** Tout. Post-launch.

### CloneBrief

- **Existe en code ?** Définition dans contracts.ts + registry.ts uniquement. Aucune implémentation UI ni runtime. Affiché dans /profile/technologies comme 7ème roadmap item.
- **UI ?** Non.
- **Peut être branché sur CloneTrace / CloneContinuum ?** Oui — c'est sa dépendance naturelle. CloneBrief = résumé de CloneTrace + état CloneContinuum.
- **Valeur launch ou later ?** Grande valeur perçue avec peu de code. Recommandé pour TECH-09 (light).
- **Manque ?** Implémentation légère. Peut être une page /profile/brief ou un bloc dans le cockpit.

---

## 3. Global vs Pierre-only Analysis

### Ce qui est déjà global CloneStore

- **Types et contrats des 12 technologies** (`contracts.ts`, `registry.ts`) — definitions complètes, portée plateforme.
- **B46 visible layer (6 technologies)** — CloneOS, CloneADN, CloneGuard, CloneTrace, CloneVoice, CloneChat : status, readiness, guardrails, snapshot, API REST globale.
- **Enterprise schema CloneADN** (`src/lib/clonestore/empreinte/`) — le schéma d'empreinte entreprise est global, mais seul Pierre l'instancie pour l'instant.
- **API `/api/clonestore/technologies`** — lecture des statuts, accessible toute la plateforme.

### Ce qui est encore Pierre-only mais devrait devenir global

| Élément | Emplacement actuel | Cible globale | Bloc |
|---|---|---|---|
| CloneGuard runtime (règles risque) | `src/lib/pierre/hr-cloneguard.ts` | `src/lib/clonestore/guard/` | TECH-06 |
| ClonePolicy runtime (règles exécutables) | `src/lib/pierre/hr-clonepolicy.ts` | `src/lib/clonestore/policy/` | TECH-06 |
| CloneTrust runtime (autonomie graduelle) | `src/lib/pierre/hr-clonetrust.ts` | `src/lib/clonestore/trust/` | TECH-06 |
| CloneContinuum runtime (continuité) | `src/lib/pierre/hr-continuity.ts` | `src/lib/clonestore/continuum/` | post-launch |
| CloneTrace audit trail | `src/lib/pierre/hr-audit-trail.ts` | `src/lib/clonestore/trace/` | TECH-07 |
| CloneADN config (empreinte) | `src/lib/pierre/empreinte/` | `src/lib/clonestore/adn/global-enterprise-memory.ts` | TECH-05 |
| CloneOS mission control | `src/lib/pierre/hr-mission-control.ts` | `src/lib/clonestore/cloneos/` | TECH-08 |

### Ce qui doit rester spécifique à Pierre (domain pack)

- `hr-contracts.ts` — génération de contrats RH
- `hr-employee.ts` — gestion employés/collaborateurs RH
- `hr-employee-file.ts` — dossier employé RH
- `hr-workflows.ts` — workflows RH métier
- `hr-autonomy.ts` — autonomie RH Pierre
- `hr-governance.ts` — gouvernance RH Pierre (wrapper du global)
- `hr-audit-trail.ts` — audit RH Pierre (wrapper du global CloneTrace)
- `task-artifacts.ts` — artefacts RH Pierre
- `hr-mission-control.ts` — missions RH Pierre (wrapper du global CloneOS)

**Règle** : chaque employé IA aura un domain pack métier. Ce pack utilise les technologies globales via l'Employee Runtime Contract. Il ne les réimplémente pas.

### Ce qui doit être extrait vers l'Employee Runtime Contract

Un employé IA doit déclarer via le contrat commun :
- Son identité (`employee_id`, `slug`, `display_name`, `domain`, `status`)
- Ses capacités (`capabilities[]`, `mission_types[]`, `task_types[]`, `artifacts[]`, `channels[]`)
- Ses dépendances technologiques (`required_technologies[]`)
- Ses profils de gouvernance (`guard_profile`, `policy_pack`, `trust_profile`)
- Ses profils de mémoire et trace (`adn_usage_profile`, `trace_profile`)
- Sa maturité de lancement (`launch_readiness`, `unavailable_reasons`)

Aujourd'hui Pierre est câblé directement sans ce contrat. Emma, Lucas, Sophie ne peuvent pas être ajoutés sans recréer toute l'architecture Pierre depuis zéro.

### Ce qu'il faut éviter de dupliquer pour les futurs employés

- Ne pas recréer un mini CloneOS par employé — utiliser le global.
- Ne pas recréer un mini CloneGuard par employé — utiliser le profil guard global.
- Ne pas recréer une timeline séparée par employé — écrire dans CloneTrace global.
- Ne pas recréer une mémoire entreprise isolée par employé — lire CloneADN global.
- Ne pas recréer une politique de validation par employé — utiliser ClonePolicy global.

---

## 4. Employee Runtime Contract — Direction cible

### Pourquoi ce contrat est prioritaire (TECH-02)

Sans Employee Runtime Contract formalisé, chaque futur employé IA devra câbler manuellement son accès aux technologies globales, dupliquer les patterns Pierre, et recréer une structure ad hoc. Le contrat est le point d'entrée qui rend les technologies réellement réutilisables.

### Fichiers cibles (TECH-02)

```
src/lib/clonestore/employees/
  employee-runtime-contract.ts   — types + interfaces du contrat
  employee-registry.ts           — registry des employés déclarés
  employee-registry-validator.ts — validation qu'un employé est conforme au contrat
```

### Structure du contrat cible

```typescript
// Employee Runtime Contract — structure cible
export interface EmployeeRuntimeContract {
  // Identité
  employee_id: string;
  slug: string;                   // "pierre", "emma", "lucas"
  display_name: string;
  domain: EmployeeDomain;         // "hr", "support", "finance", "legal", ...
  status: EmployeeStatus;         // "active" | "beta" | "roadmap" | "disabled"

  // Capacités métier
  capabilities: string[];
  mission_types: string[];
  task_types: string[];
  artifacts: string[];
  channels: EmployeeChannel[];

  // Plug-in technologies globales
  required_technologies: TechnologySlug[];
  adn_usage_profile: ADNUsageProfile;
  guard_profile: GuardProfile;
  policy_pack: PolicyPackRef;
  trust_profile: TrustProfile;
  trace_profile: TraceProfile;
  signals_profile?: SignalsProfile;
  review_profile?: ReviewProfile;
  brief_profile?: BriefProfile;

  // Gouvernance
  permissions: EmployeePermissions;
  unavailable_reasons: string[];
  launch_readiness: EmployeeLaunchReadiness;
}
```

### Employee Registry — structure cible

```typescript
// Employee Registry — registry centralisé de tous les employés IA
export interface EmployeeRegistryEntry {
  contract: EmployeeRuntimeContract;
  setup_path: string;   // "/agents/pierre/setup"
  cockpit_path: string; // "/agents/pierre/use"
  api_prefix: string;   // "/api/pierre"
}

export function getEmployeeRegistry(): EmployeeRegistryEntry[] { ... }
export function getEmployeeBySlug(slug: string): EmployeeRegistryEntry | null { ... }
```

### Ce que ça débloque

- Emma (support) peut être ajoutée en déclarant son contrat sans recâbler les technologies.
- Lucas (finance) peut déclarer `required_technologies: ["cloneGuard", "cloneADN", "cloneTrace"]` et obtenir les couches globales automatiquement.
- /profile/agents peut lister tous les employés de l'Employee Registry sans code custom par employé.
- Les tests peuvent valider que chaque employé respecte le contrat sans connaître les détails métier de chacun.

---

## 5. Matrice de maturité

| Technologie | Statut actuel | Portée | Config client | API | Tests | Priorité | Risque sans finir | Prochain bloc |
|---|---|---|---|---|---|---|---|---|
| CloneOS | real | both | no | partial | yes | now (config global) | Faible — fonctionnel Pierre | TECH-08 |
| CloneADN | real | Pierre-only | partial (Empreinte) | partial | yes | now (globalisation) | Moyen — perçu trop Pierre-only | TECH-05 |
| CloneGuard | real | Pierre-only | no | partial | yes | now (config règles) | Moyen — règles pas configurables client | TECH-06 |
| CloneTrace | real | Pierre-only | no | partial | yes | now (UI timeline) | Élevé — crédibilité auditabilité manquante | TECH-07 |
| CloneVoice | UI-only | both (config) | partial | partial | partial | later | Faible si badge corrigé | TECH-10 |
| CloneChat | partial | Pierre-only | no | partial | partial | soon | Faible — cockpit Pierre remplit le rôle | — |
| ClonePolicy | Pierre-only | Pierre-only | no | no | yes (Pierre) | soon | Moyen — règles pas visibles client | TECH-06 |
| CloneContinuum | Pierre-only | Pierre-only | no | no | yes (Pierre) | soon | Faible — fonctionne en arrière-plan | TECH-07 |
| CloneTrust | Pierre-only | Pierre-only | no | no | yes (Pierre) | soon | Faible — fonctionne mais description fausse | TECH-06 |
| CloneReview | roadmap | absent | no | no | no | later | Moyen — qualité docs non vérifiée | post-launch |
| CloneSignals | roadmap | absent | no | no | no | later | Faible — observabilité Pierre partielle | post-launch |
| CloneLearn | roadmap | absent | no | no | no | later | Faible | post-launch |
| CloneBrief | roadmap | absent | no | no | no | soon/launch | Moyen — haute valeur perçue facile à coder | TECH-09 |

---

## 6. Ordre de construction recommandé

### TECH-02 — Employee Runtime Contract & Employee Registry

**Objectif** : Formaliser le contrat commun de tous les employés IA. Créer l'interface `EmployeeRuntimeContract` et le premier `EmployeeRegistry` avec Pierre déclaré. Ce contrat définit comment chaque employé se branche sur les technologies globales.

**Livrable** : `src/lib/clonestore/employees/employee-runtime-contract.ts` + `employee-registry.ts` + `employee-registry-validator.ts`. Pierre est le premier à implémenter ce contrat.

**Pourquoi en premier** : Sans ce contrat, TECH-03 à TECH-10 construisent des technologies globales que personne ne peut consommer via un pattern commun.

### TECH-03 — Global Technology Config Model

**Objectif** : Unifier le modèle de configuration des 12 technologies au niveau plateforme. Aujourd'hui B46 (6 techs) et registry.ts (12 techs) coexistent avec des types différents. Créer un modèle unifié `GlobalTechConfig` avec scope, per-employee override, et settings complets pour les 12.

**Livrable** : `src/lib/clonestore/technologies/global-tech-config.ts` + migration types B46 → global.

### TECH-04 — Profile Technologies Configuration UI

**Objectif** : Corriger et améliorer /profile/technologies pour être honnête et actionnable. Corriger les badges faux (CloneVoice "Actif" → "Bientôt", CloneTrust description fausse). Ajouter la configuration réelle des technologies actives (autonomie, risk_mode). Distinguer clairement : actif / bientôt / roadmap.

**Livrable** : Mise à jour `src/app/profile/technologies/page.tsx` + correction descriptions.

### TECH-05 — CloneADN Global / Enterprise Memory

**Objectif** : Découpler CloneADN de Pierre. Créer une couche de mémoire entreprise globale utilisable par tous les employés futurs. La config Empreinte Pierre reste, mais une couche `GlobalEnterpriseMemory` devient le point d'entrée principal.

**Livrable** : `src/lib/clonestore/adn/global-enterprise-memory.ts` + bridge vers Pierre empreinte.

### TECH-06 — CloneGuard + ClonePolicy Global Rules

**Objectif** : Exposer les règles CloneGuard + ClonePolicy + CloneTrust en interface client configurable. Permettre au client de définir : niveaux d'autonomie par type d'action, règles de validation, valideurs humains, actions interdites. Aujourd'hui ces règles sont dans le code Pierre, pas configurables.

**Livrable** : `src/lib/clonestore/guard/global-guard-config.ts` + UI dans /profile/guard ou dans le setup Pierre.

### TECH-07 — CloneTrace Global Audit Timeline

**Objectif** : Rendre CloneTrace visible pour le client. Créer une page /profile/trace ou /cockpit/trace affichant la timeline des actions IA : missions créées, documents générés, validations, blocages, décisions. Export disponible.

**Livrable** : `src/app/profile/trace/page.tsx` + API `/api/clonestore/trace/timeline`.

### TECH-08 — CloneOS Command Center Alignment

**Objectif** : Aligner le cockpit Pierre (/agents/pierre/use) avec la notion de CloneOS. Ajouter un indicateur d'état opérationnel CloneOS, la file des missions actives, et préparer l'architecture multi-employés (sans implémenter d'autres employés).

**Livrable** : Amélioration cockpit + `src/lib/clonestore/cloneos/command-center-state.ts`.

### TECH-09 — CloneBrief Executive Summaries

**Objectif** : Implémenter CloneBrief comme une page /profile/brief ou un bloc cockpit affichant : missions actives, blocages en attente, validations requises, décisions à prendre. Branché sur CloneTrace + données cockpit. Haute valeur perçue, faible coût code.

**Livrable** : `src/app/profile/brief/page.tsx` ou bloc cockpit Pierre.

### TECH-10 — CloneVoice Readiness Layer

**Objectif** : Préparer l'infrastructure CloneVoice sans implémenter le pipeline voice. Corriger l'UI (badge "Bientôt" honnête). Définir l'interface d'intégration future. Ne pas coder le pipeline voix.

**Livrable** : Correction badge UI + `src/lib/clonestore/voice/voice-readiness.ts`.

### TECH-11 — Technology Readiness Final Gate

**Objectif** : Créer un verdict de maturité technologique complet. `getTechnologyReadinessGate()` retourne le statut de chaque technologie, ce qui est prêt pour launch, ce qui est post-launch, et le score global de crédibilité produit. Porte de validation finale avant de marquer les technologies comme "production ready".

**Livrable** : `src/lib/clonestore/technologies/technology-readiness-gate.ts` + page /profile/tech-readiness.

---

## 7. Launch vs later

### À faire avant lancement public

- **TECH-02** : Employee Runtime Contract & Employee Registry — rend les technologies réellement réutilisables, évite la duplication si un second employé IA est annoncé pendant la période de lancement.
- **TECH-03** : Modèle de config unifié — évite les incohérences entre B46 et registry.
- **TECH-04** : Corriger l'UI /profile/technologies — badges faux et descriptions incorrectes (CloneTrust, CloneVoice) nuisent à la crédibilité.
- **TECH-05** : CloneADN global — rendre la mémoire entreprise indépendante de Pierre pour crédibilité multi-employés.
- **TECH-06** : CloneGuard config client — les entreprises doivent pouvoir configurer leurs règles de validation.

### À faire après lancement ou en parallèle si sprint disponible

- **TECH-07** (CloneTrace UI) : Auditabilité visible — argument de vente fort. Dès que possible après launch.
- **TECH-08** (CloneOS Command Center) : Utile mais pas bloquant V1.
- **TECH-09** (CloneBrief) : Haute valeur mais peut attendre un sprint post-launch.
- **TECH-10** (CloneVoice) : Roadmap. Correction badge avant launch, pipeline après.
- **TECH-11** (Tech Readiness Gate) : Meta-feature interne. Post-launch.

### À faire uniquement après lancement

- CloneReview : Implémentation complète.
- CloneSignals : Déclencheurs proactifs.
- CloneLearn : Auto-apprentissage.
- CloneContinuum globalisé : Planification multi-employés.

---

## 8. Risques si les technologies ne sont pas construites

1. **Technologies perçues comme marketing-only** : Si CloneVoice affiche "Actif" mais n'existe pas, et CloneTrust est mal décrit, les entreprises techniques découvrent rapidement la supercherie.

2. **Pas d'Employee Runtime Contract = duplication garantie** : Sans contrat commun, Emma, Lucas et Sophie nécessiteront chacun de re-câbler manuellement toutes les technologies — coût 5x le coût de TECH-02.

3. **Configuration client trop faible** : Si le client ne peut pas configurer les règles de validation (CloneGuard/ClonePolicy) ni voir l'historique (CloneTrace), la proposition de valeur "IA gouvernée" est creuse.

4. **CloneADN trop Pierre-only** : Si la mémoire entreprise ne se globalise pas, chaque futur employé IA repart de zéro — rupture de l'argument "CloneADN fait travailler tous vos employés IA comme cette entreprise".

5. **CloneTrace non visible** : L'audit trail est un argument majeur pour les décideurs RH et les DPO. Sans UI, c'est invisible.

6. **CloneOS pas assez incarné** : Si l'utilisateur ne comprend pas que CloneOS est le noyau qui orchestre, il voit juste "Pierre fait des choses" sans comprendre l'architecture plateforme.

7. **CloneVoice vendu trop tôt** : Si CloneVoice est présenté comme actif sans pipeline, risque de déception et perte de crédibilité.

8. **CloneBrief absent** : Le briefing du matin/soir est une feature à haute perception d'autonomie IA. Facile à implémenter, très visible.

---

## 9. Décision : prochain bloc exact

**TECH-02 → TECH-03 → TECH-04 → TECH-05 → TECH-06 → TECH-07 → TECH-08 → TECH-09 → TECH-10 → TECH-11**

Le prochain bloc immédiat est **TECH-02 — Employee Runtime Contract & Employee Registry** car il pose le contrat commun sans lequel les technologies globales (TECH-03 à TECH-11) n'ont pas de consommateur défini. Pierre sera le premier employé à implémenter ce contrat rétroactivement — sans modifier son moteur, uniquement en déclarant son contrat via le registry.

Après TECH-02, TECH-03 + TECH-04 corrigent les incohérences visibles (types unifiés, badges UI corrects) pour que le produit soit crédible dès le lancement.

**Ce qu'il ne faut PAS faire maintenant :**
- Ne pas rouvrir Pierre moteur (B38-B48 clos).
- Ne pas implémenter le vrai pipeline voix (CloneVoice).
- Ne pas implémenter CloneLearn, CloneSignals, CloneReview complets.
- Ne pas refaire le site public, /demo/pierre, checkout, webhook.
- Ne pas modifier les flags public launch.
- Ne pas auto-valider des proofs.
- Ne pas créer Emma, Lucas ou Sophie avant que le Employee Runtime Contract soit formalisé.
- Ne pas dupliquer les technologies dans chaque domain pack employé.
