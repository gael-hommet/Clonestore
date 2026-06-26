# TECH-02 — Employee Runtime Contract & Employee Registry

## 1. Pourquoi ce contrat existe

CloneStore doit pouvoir ajouter des employés IA sans recréer un système entier à chaque fois.

Sans Employee Runtime Contract :

- Emma (support) devrait recâbler CloneOS, CloneADN, CloneGuard, CloneTrace depuis zéro.
- Lucas (finance) devrait refaire la même chose.
- Sophie (légal) aussi.
- Chaque employé serait une copie fragile et divergente de Pierre.

Coût réel : ×5 le temps de développement par employé supplémentaire, avec une dette technique
croissante et des incohérences de gouvernance garanties.

Le contrat est la fondation. Il définit comment chaque employé IA se branche sur les technologies
globales CloneStore via un contrat commun, déclaratif et validable.

---

## 2. Pourquoi les technologies ne sont pas des employés

Les technologies sont des **couches système globales** :

| Technologie | Rôle |
|---|---|
| CloneOS | Orchestration des missions et tâches |
| CloneADN | Mémoire vivante de l'entreprise |
| CloneGuard | Gouvernance, risque, validation |
| CloneTrace | Traçabilité et audit trail |
| CloneVoice | Interface vocale |
| CloneChat | Interface conversationnelle |
| ClonePolicy | Règles exécutables (pipeline dans CloneGuard) |
| CloneContinuum | Continuité entre sessions |
| CloneTrust | Autonomie graduelle |
| CloneReview | Contrôle qualité livrables |
| CloneSignals | Déclencheurs et alertes |
| CloneLearn | Apprentissage gouverné |
| CloneBrief | Briefings et résumés |

Les employés IA sont des **postes métiers branchés sur ces technologies** :

| Employé | Domaine | Statut |
|---|---|---|
| Pierre | RH | Actif — V1 launch candidate |
| Emma | Support | Roadmap |
| Lucas | Finance | Roadmap |
| Sophie | Légal | Roadmap |
| Adrien | Ops | Concept |
| Nolan | Sales | Concept |

**Règle absolue** : on ne recrée pas un mini CloneOS, un mini CloneGuard ou une mini timeline
dans chaque employé. Chaque employé IA déclare les technologies qu'il utilise et comment —
il ne les réimplémente pas.

---

## 3. Comment un employé IA se branche aux technologies

Le contrat `EmployeeRuntimeContract` est le plug-in adapter. Il déclare :

```typescript
required_technologies: EmployeeTechnologyRequirement[];
// → Quelles technologies sont requises et pourquoi

guard_profile: EmployeeGuardProfile;
// → Comment CloneGuard est configuré pour cet employé

trust_profile: EmployeeTrustProfile;
// → Niveau d'autonomie de base et maximum

trace_profile: EmployeeTraceProfile;
// → Comment les événements sont écrits dans CloneTrace

adn_usage_profile: EmployeeADNUsageProfile;
// → Comment l'employé lit la mémoire entreprise (CloneADN)

review_profile: EmployeeReviewProfile;
// → Contrôle qualité avant livraison (CloneReview)

signals_profile: EmployeeSignalsProfile;
// → Déclencheurs et alertes (CloneSignals)

brief_profile: EmployeeBriefProfile;
// → Briefings périodiques (CloneBrief)
```

L'employé ne redéfinit pas les technologies. Il déclare ses besoins et profils de configuration.
Les technologies globales lisent ces profils pour savoir comment se comporter avec cet employé.

---

## 4. Ce que Pierre déclare

Pierre est le premier employé à implémenter ce contrat.

**Identité** : `slug: "pierre"`, `domain: "hr"`, `status: "active"`, `launch_stage: "launch_candidate"`

**Technologies requises (hard)** :
- `cloneos` — orchestration missions RH
- `cloneadn` — mémoire entreprise, Empreinte B44
- `cloneguard` — gouvernance, pipeline CloneGuard → ClonePolicy → CloneTrust
- `clonetrace` — audit trail RH complet

**Technologies recommandées (soft)** :
- `clonecontinuum` — continuité des missions RH entre sessions
- `clonetrust` — calibration autonomie (intégré au pipeline CloneGuard)
- `clonereview` — contrôle qualité documents (partial, roadmap)
- `clonebrief` — briefings RH (future, déclaré)

**Capabilities** : employee_file, hr_documents, recruitment_ops, onboarding, absence_followup,
prepayroll_preparation, hr_email_drafts, hr_traceability

**Permissions critiques (toujours false)** :
```
can_make_legal_decision: false        // Pierre n'est pas avocat
can_run_payroll_officially: false     // La paie officielle reste humaine
can_terminate_employee_autonomously: false  // Le licenciement requiert décision humaine
can_sign_contracts: false             // La signature requiert autorisation humaine
```

**Readiness** : product_runtime_ready: true, public_launch_ready: false (external blockers pending)

---

## 5. Ce qui reste dans le domain pack RH (Pierre)

Le domain pack RH n'est PAS le contrat. C'est l'implémentation métier spécifique à Pierre.

Ce qui reste dans `src/lib/pierre/` :

| Fichier | Rôle |
|---|---|
| `hr/contracts.ts` | Génération des contrats RH |
| `hr/employee.ts` | Gestion des collaborateurs |
| `hr/employee-file.ts` | Dossier employé RH |
| `hr/workflows.ts` | Workflows RH métier |
| `hr/autonomy.ts` | Règles d'autonomie RH Pierre |
| `hr/cloneguard.ts` | CloneGuard adapté RH (wrapper du global) |
| `hr/clonepolicy.ts` | ClonePolicy RH (règles du domain pack) |
| `hr/clonetrust.ts` | CloneTrust RH (calibration autonomie) |
| `hr/governance.ts` | Orchestrateur gouvernance RH |
| `hr/audit-trail.ts` | CloneTrace RH (wrapper du global) |
| `hr/mission-control.ts` | CloneOS missions RH (wrapper du global) |
| `tasks/artifacts.ts` | Artefacts RH Pierre |

**Règle** : le domain pack utilise les technologies globales via l'Employee Runtime Contract.
Il ne les réimplémente pas.

---

## 6. Ce que les futurs employés devront déclarer

Quand Emma, Lucas ou Sophie seront construits, ils devront :

1. Créer un fichier `employee-emma-contract.ts` déclarant leur `EmployeeRuntimeContract`
2. Déclarer leurs `required_technologies` (en utilisant les slugs valides)
3. Configurer leurs profils : guard_profile, trust_profile, trace_profile, adn_usage_profile
4. Déclarer leurs capabilities, mission_types, task_types spécifiques au domaine
5. Être enregistrés dans `EMPLOYEE_RUNTIME_REGISTRY`
6. Être validés par `validateEmployeeRuntimeContract`

Ils n'auront PAS à recréer :
- Un moteur d'orchestration (CloneOS global)
- Un système de traçabilité (CloneTrace global)
- Un moteur de gouvernance (CloneGuard global)
- Une mémoire entreprise (CloneADN global)

Ils auront simplement un domain pack métier + un contrat déclaratif.

---

## 7. Pourquoi Emma/Lucas/Sophie ne sont pas encore créés

**TECH-02 crée le contrat. Il ne crée pas les employés.**

Les futurs employés ne sont pas ajoutés au registry pour plusieurs raisons :

1. **Aucun domain pack n'existe** : le pack support, finance, légal ne sont pas implémentés.
2. **Déclarer un employé sans implémentation = dette technique** : un contrat vide ou partiel
   nuirait à la qualité du registry.
3. **L'ordre est important** : contrat d'abord (TECH-02) → technologies globales (TECH-03 à
   TECH-07) → implémentation domain pack → déclaration dans le registry.
4. **Pierre doit d'abord valider le pattern** : Pierre est la preuve de concept du contrat.
   Ses tests garantissent que le pattern est solide avant d'être répliqué.

Emma, Lucas et Sophie sont mentionnés dans les commentaires du registry mais ne sont pas
enregistrés. Ils le seront quand leurs domain packs seront construits.

---

## 8. Fichiers créés dans TECH-02

```
src/lib/clonestore/employees/
  employee-runtime-contract.ts      — types + VALID_EMPLOYEE_TECHNOLOGY_SLUGS
  employee-registry.ts              — PIERRE_EMPLOYEE_RUNTIME_CONTRACT + registry functions
  employee-registry-validator.ts    — validateEmployeeRuntimeContract + getReport
  employee-runtime-readiness.ts     — buildEmployeeRuntimeReadiness + verdict
  index.ts                          — clean exports

  __tests__/
    employee-runtime-contract-tech02.test.ts  — 36 tests statiques et logiques

docs/
  TECH_02_EMPLOYEE_RUNTIME_CONTRACT.md  — ce fichier
```

---

## 9. Prochain bloc recommandé : TECH-03

**TECH-03 — Global Technology Config Model**

Objectif : unifier le modèle de configuration des 12 technologies au niveau plateforme.
Aujourd'hui deux modèles coexistent :
- B46 types (`technology-b46-types.ts`) — 6 technologies visibles
- Registry types (`contracts.ts`) — 12 technologies

TECH-03 crée un `GlobalTechConfig` unifié qui couvre les 12 technologies avec un modèle
cohérent, configurable par le client, et relié au Employee Runtime Contract.

Cet ordre est verrouillé :
```
TECH-02 — Employee Runtime Contract (ce bloc) ✅
TECH-03 — Global Technology Config Model
TECH-04 — Profile Technologies Configuration UI
TECH-05 — CloneADN Global / Enterprise Memory
TECH-06 — CloneGuard + ClonePolicy Global Rules
TECH-07 — CloneTrace Global Audit Timeline
TECH-08 — CloneOS Command Center Alignment
TECH-09 — CloneBrief Executive Summaries
TECH-10 — CloneVoice Readiness Layer
TECH-11 — Technology Readiness Final Gate
```
