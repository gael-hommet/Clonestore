# Pierre HR Engine — Fondation Moteur Métier RH

Date : 2026-05-09

---

## 1. Pourquoi ce contrat métier existe

Pierre n'est pas un assistant RH. Pierre est un **poste RH opérationnel automatisé** — son rôle est d'absorber de la charge RH quotidienne réelle, avec traçabilité, validation humaine calibrée et conformité aux règles de l'entreprise.

Pour ça, Pierre a besoin d'une **fondation métier explicite** :
- Quels domaines RH couvre-t-il ?
- Quel niveau de risque porte chaque action ?
- À quel niveau d'autonomie peut-il agir seul ?
- Quand est-ce qu'il doit bloquer et attendre un humain ?

Sans cette fondation, le moteur d'exécution (queue → executor → artefact) manque de contexte métier. Il produit des livrables sans savoir s'il aurait dû les bloquer.

`src/lib/pierre/hr/contracts.ts` est cette fondation. Elle ne simule rien. Elle encode les règles réelles.

---

## 2. Ce que ce fichier couvre

### Domaines RH (23)

Les domaines opérationnels que Pierre peut traiter, de la gestion du recrutement (`recruitment_ops`, `hiring`) aux cas sensibles (`sensitive_case`, `employee_relations`, `compliance_workflow`), en passant par la pré-paie (`payroll_prep`), l'onboarding, les absences, les contrats, et la coordination multi-sites.

### Niveaux de risque RH (axe couleur)

| Couleur | Signification |
|---|---|
| `green` | Risque faible — exécutable automatiquement |
| `orange` | Risque modéré — validation humaine recommandée avant diffusion |
| `red` | Risque élevé — validation humaine obligatoire avant tout envoi ou signature |
| `black` | Risque absolu — décision humaine exclusive, non-délégable |

Note : ce vocabulaire (`PierreHrRiskLevel`) coexiste avec deux autres axes déjà en place :
- `PierreRiskLevel` dans `types.ts` = `"low"|"medium"|"high"` (axe DB Supabase)
- `PierreMissionRiskLevel` dans `mission/risk.ts` = `"normal"|"sensitive"|"critical"` (axe interpréteur)

La fonction `normalizePierreHrRiskLevel()` fait le pont entre ces trois vocabulaires.

### Niveaux d'autonomie (5)

De `draft_only` (Pierre produit uniquement, jamais d'exécution automatique) à `enterprise_rules` (autonomie conditionnelle avec règles d'entreprise configurées).

### Classes d'action (4)

| Classe | Description |
|---|---|
| `auto_executable` | Pierre exécute seul |
| `validation_recommended` | Pierre produit, l'humain relit |
| `validation_required` | Pierre prépare, l'humain valide explicitement |
| `blocked_without_human` | Pierre ne peut pas agir — décision humaine exclusive |

### Matrice action/validation

La matrice `PIERRE_ACTION_VALIDATION_MATRIX` encode les règles suivantes :

**Auto-exécutable** : relance simple, rappel d'échéance, demande d'info manquante, création de tâche, synthèse interne faible risque, rapport standard.

**Validation recommandée** : email salarié courant, email candidat courant, document RH courant, compte rendu, trame d'entretien, synthèse manager, préparation onboarding, préparation pré-paie simple.

**Validation obligatoire** : contrat, avenant, document contractuel, refus candidat formel, rémunération, employee relations, absence sensible, sujet médical, conflit préliminaire, courrier disciplinaire préparatoire, offboarding sensible.

**Blocage humain obligatoire** : décider une sanction, décider un licenciement, prendre une décision salariale finale, interpréter définitivement le droit, décision potentiellement discriminatoire, modifier une politique RH, envoyer un document juridique sensible sans validation, trancher un conflit humain.

### Fonctions pures

- `normalizePierreHrDomain(value: unknown)` — normalise vers un domaine valide, retourne `"unknown"` sinon
- `normalizePierreHrRiskLevel(value: unknown)` — normalise vers une couleur de risque, avec mapping rétrocompat
- `classifyPierreHrActionRequirement(input)` — retourne l'exigence de validation complète pour une action donnée, avec escalade automatique si `override_risk = "black"`

L'index est préconstruit (`Map<PierreHrTaskKind, ActionRule>`) pour lookup O(1) — pas de reparcours linéaire à chaque appel.

---

## 3. Ce que ce fichier ne couvre pas encore

- **Niveaux d'autonomie configurables par entreprise** — `PierreAutonomyLevel` est défini mais pas encore wired dans la mémoire entreprise
- **Mapping `PierreHrTaskKind` ↔ `PierreTaskType`** — les kinds HR ne sont pas encore mappés aux types de tâche DB (`doc.generate`, `email.draft`, etc.)
- **Persistance du domaine RH** dans `pierre_missions` ou `pierre_tasks` — `hr_domain` vit pour l'instant dans `payload_json`, pas de colonne dédiée

---

## 4. Bloc 1 — Branchement moteur mission (2026-05-10)

### Ce qui a été branché

**`mission/risk.ts`**
- Ajout de `hr_risk_level: PierreHrRiskLevel` à `PierreRiskResult`
- Nouvelle fonction `toHrRiskLevel(risk, blocked)` : `blocked → "black"`, `critical → "red"`, `sensitive → "orange"`, `normal → "green"`
- `assessMissionRisk()` retourne désormais `hr_risk_level` en plus de `risk_level`

**`mission/interpret.ts`**
- `PierreMissionInterpretation` enrichi avec `hr_domain: PierreHrDomain` et `hr_risk_level: PierreHrRiskLevel`
- Nouvelle fonction `mapClassificationToHrDomain()` — mapping exhaustif des 16 classifications vers les 23 domaines RH
- Nouvelle fonction `missionRiskToHrRisk()` — pont entre les deux vocabulaires de risque
- Nouvelle fonction `buildHrPayload()` — appelle `classifyPierreHrActionRequirement()` et retourne les 6 champs HR à injecter dans les payloads
- Les 7 types de tâches générées enrichissent leur `payload` avec : `hr_task_kind`, `hr_domain`, `hr_risk_level`, `hr_action_class`, `hr_approval_policy`, `human_note`

**`mission/build-tasks.ts`**
- `PierreBuildTasksInput` enrichi avec `hr_domain?: PierreHrDomain` et `hr_risk_level?: PierreHrRiskLevel`
- Nouvelle fonction `computeHrEnrichment()` — calcule l'enrichissement HR complet par tâche, escalade `approval_required` si nécessaire, retourne `blocked: true` si l'action est de classe noire
- Les 7 types de tâches utilisent `computeHrEnrichment()` pour : escalader `approval_required`, passer en `status: "blocked"` si l'action HR l'exige, enrichir le payload

**`app/api/pierre/use/submit/route.ts`** (pipeline autonome)
- Import de `classifyPierreHrActionRequirement` depuis `hr/contracts`
- Nouvelles fonctions `routeClassificationToHrDomain()`, `routeTaskKind()`, `routeHrPayload()`
- Les 6 types de tâches du pipeline autonome enrichissent leur `payload` avec les mêmes 6 champs HR

### Règles de sécurité garanties

| Règle | Garantie |
|---|---|
| Override ne peut qu'escalader le risque | Respecté via `getHighestPierreHrRiskLevel()` dans contracts.ts |
| Les actions noires restent bloquées | `computeHrEnrichment()` retourne `blocked: true` si `action_class === "blocked_without_human"` |
| Pas de migration DB | Les métadonnées HR vivent dans `payload_json` (jsonb existant) |
| Types existants non cassés | Tous les champs HR ajoutés sont additifs ou optionnels |

### Champs HR persistés dans `pierre_tasks.payload`

```json
{
  "source": "mission_engine",
  "hr_task_kind": "refus_candidat_formel",
  "hr_domain": "recruitment_ops",
  "hr_risk_level": "orange",
  "hr_action_class": "validation_required",
  "hr_approval_policy": "required",
  "human_note": "Validation humaine obligatoire : Pierre prépare, mais l'humain doit valider explicitement..."
}
```

### Ce qui reste à faire (Bloc 2+)

- **Autonomie entreprise** : lire `PierreAutonomyLevel` depuis la mémoire entreprise pour moduler `auto_executable`

---

## 5. Bloc 2 — Runtime enforcement (2026-05-10)

### Ce qui a changé

Jusqu'au Bloc 1, la matrice HR était **informative** : les champs `hr_action_class`, `hr_approval_policy`, `hr_risk_level` étaient injectés dans `payload_json` lors de la construction des tâches, mais rien ne les vérifiait au moment de l'exécution. Un executor pouvait produire un livrable pour une action `blocked_without_human` si les champs étaient absents ou mal initialisés.

Le Bloc 2 corrige cela : **la matrice HR est maintenant appliquée au runtime**, avant que tout executor ne s'exécute.

### Garde HR dans `executors.ts`

Nouvelle fonction `checkHrGate(task)` appelée dans `executePierreTask()` **après** la validation du statut et du type, **avant** le switch sur `task.type` :

```typescript
function checkHrGate(task: PierreExecutorTask): PierreExecutorFailure | null {
  const hrActionClass = asString(payload?.hr_action_class);
  const hrApprovalPolicy = asString(payload?.hr_approval_policy);

  const isHardBlocked =
    hrActionClass === "blocked_without_human" ||
    hrApprovalPolicy === "human_only";

  if (!isHardBlocked) return null;

  return buildFailure({
    status: "blocked",
    error_code: "HR_BLOCKED_ACTION",
    event: "executor_hr_blocked",
    // ...
  });
}
```

**Déclencheurs** : `hr_action_class === "blocked_without_human"` OU `hr_approval_policy === "human_only"`. L'un ou l'autre suffit — défense en profondeur.

**Résultat** : `ok: false`, `status: "blocked"`, `error_code: "HR_BLOCKED_ACTION"`, log structuré avec les 5 champs HR.

Le log `payload` retourne : `task_id`, `hr_action_class`, `hr_approval_policy`, `hr_risk_level`, `hr_task_kind` — traçabilité complète pour l'audit.

### Persistance dans `process-task.ts`

Aucune modification nécessaire. `process-task.ts` gère déjà le cas `blocked` correctement :
- Outcome `blocked` → log → DB status `"blocked"` → `blocked_reason` persisté
- Ne remet jamais en `"completed"` — traduit `PierreExecutorSuccess` vers DB `"done"`
- Gate `awaiting_approval` déjà présente avant l'appel à l'executor

### Tests unitaires (`src/lib/pierre/__tests__/hr-contracts.test.ts`)

29 tests couvrant :

| Groupe | Tests |
|---|---|
| `normalizePierreHrDomain` | domaines valides, casse/espaces, inconnu → `"unknown"` |
| `normalizePierreHrRiskLevel` | 4 couleurs natives, ponts low/medium/high, normal/sensitive/critical, blocked/forbidden/human_only, garbage → `"green"` |
| `classifyPierreHrActionRequirement` — vert | `relance`, `demande_info` → auto_executable/none/green |
| `classifyPierreHrActionRequirement` — orange | `email_salarie`, `onboarding_prep` → validation_recommended/recommended/orange |
| `classifyPierreHrActionRequirement` — rouge | `contrat`, `remuneration` → validation_required/required/red |
| `classifyPierreHrActionRequirement` — noir | `decision_licenciement`, `decision_sanction`, `interpretation_droit` → blocked/human_only/black/blocked:true |
| `classifyPierreHrActionRequirement` — inconnu | → validation_required par prudence |
| `override_risk` | black sur vert → risk_level black mais action_class validation_required (pas bloqué) ; green sur noir → reste noir ; red escalade ; orange no-op |
| `executePierreTask` — HR gate | bloque `blocked_without_human`, bloque `human_only` sans action_class, bloque action noire quel que soit `type`, laisse passer vert/auto_executable, laisse passer sans payload HR, log.payload contient les 5 champs HR |

Tous les tests passent. Runner : `npm test` (`vitest run src/lib/pierre/__tests__/hr-contracts.test.ts`).

### Garanties désormais en place

| Garantie | Mécanisme |
|---|---|
| Les actions `blocked_without_human` ne s'exécutent jamais | `checkHrGate()` retourne avant le switch |
| `hr_approval_policy: "human_only"` bloque même sans `action_class` | Double condition dans `isHardBlocked` |
| Les actions vertes/orange/rouge produisent toujours leurs livrables | La garde ne touche que les cas noirs |
| Le log d'un blocage contient les 5 champs HR | `payload` structuré dans `buildFailure()` |
| `process-task.ts` persiste correctement | Aucune modification nécessaire — déjà robuste |
| Aucune régression sur les types publics | `"HR_BLOCKED_ACTION"` ajouté à l'union existante |

### Ce qui reste à faire (Bloc 3+)

- **Autonomie entreprise** : lire `PierreAutonomyLevel` depuis la mémoire entreprise pour moduler `auto_executable` (certaines actions vertes pourraient nécessiter validation selon la config)
- **Tests des broken legacy** : `tasks.test.ts`, `interpret.test.ts`, `risk.test.ts`, `schedule.test.ts` — ces fichiers testent des APIs qui n'existent plus et sont exclus du `npm test` script. À remettre à jour dans un Bloc dédié.

---

## 6. Comment ce fichier reste branché (post-Bloc 1)

---

## 6. Pourquoi cette brique respecte la vision Pierre

Pierre est un **poste RH opérationnel**, pas un assistant conversationnel.

Un assistant génère ce qu'on lui demande. Un poste opérationnel **sait ce qu'il peut faire seul, ce qu'il doit préparer pour validation, et ce qu'il ne peut pas décider**.

La matrice `PIERRE_ACTION_VALIDATION_MATRIX` incarne exactement cette distinction :
- Certaines actions sont **déléguées** à Pierre (vert) — c'est son rôle de les exécuter sans attendre.
- D'autres sont **soumises** à l'humain (orange, rouge) — Pierre produit le livrable, l'humain garde la décision.
- D'autres enfin sont **bloquées** (noir) — Pierre ne peut pas s'y substituer, quelle que soit la configuration.

Cette gradation n'est pas une limitation technique. C'est la **définition du rôle de Pierre** dans une organisation : autonomie calibrée, traçabilité complète, humain toujours en position de décision finale sur les sujets à enjeux.

Un assistant ne connaît pas ses limites. Pierre, si.
