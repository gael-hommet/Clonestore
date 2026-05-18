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

### Ce qui reste à faire (Bloc 3)

- **Autonomie entreprise** : lire `PierreAutonomyLevel` depuis la mémoire entreprise pour moduler `auto_executable` — **fait dans le Bloc 3**
- **Tests des broken legacy** : `tasks.test.ts`, `interpret.test.ts`, `risk.test.ts`, `schedule.test.ts` — ces fichiers testent des APIs qui n'existent plus et sont exclus du `npm test` script. À remettre à jour dans un Bloc dédié.

---

## 6. Bloc 3 — Autonomie contrôlée (2026-05-10)

### Ce qui a changé

Les Blocs 1 et 2 garantissaient que les actions noires ne s'exécutent jamais. Mais jusqu'ici, toutes les actions non-noires (vert, orange, rouge) suivaient la même politique indépendamment de la configuration de l'entreprise. Une action verte (`auto_executable`) s'exécutait automatiquement pour toutes les entreprises, quelle que soit leur maturité RH ou leur tolérance au risque.

Le Bloc 3 introduit le niveau d'autonomie comme variable de contrôle : **Pierre s'adapte à la politique de l'entreprise**, et non l'inverse.

### `src/lib/pierre/hr/autonomy.ts` — couche pure de décision

Nouvelle couche sans dépendances DB/UI. Expose deux fonctions :

- `resolvePierreAutonomyLevel(value: unknown): PierreAutonomyLevel` — normalise n'importe quelle valeur inconnue vers un niveau valide, fallback `"validation_smart"`
- `decidePierreHrExecutionPolicy(input): PierreAutonomyDecision` — combine `hr_action_class`, `hr_approval_policy` et `autonomy_level` pour produire une décision d'exécution complète

**Type `PierreAutonomyDecision`** :
```typescript
{
  autonomy_level: PierreAutonomyLevel;
  can_execute: boolean;       // l'executor peut-il s'exécuter automatiquement ?
  approval_required: boolean; // l'action doit-elle être relue par un humain ?
  blocked: boolean;           // action non-délégable à Pierre ?
  final_status_hint: "queued" | "awaiting_approval" | "blocked"; // statut DB suggéré
  reason: string;
  human_note: string;
}
```

### Matrice autonomie × action

| Niveau | Vert (`auto_executable`) | Orange (`validation_recommended`) | Rouge (`validation_required`) | Noir |
|---|---|---|---|---|
| `draft_only` | awaiting_approval | awaiting_approval | awaiting_approval | blocked |
| `low_risk_execution` | **queued** (auto) | awaiting_approval | awaiting_approval | blocked |
| `validation_smart` | **queued** (auto) | awaiting_approval | awaiting_approval | blocked |
| `advanced_operations` | **queued** (auto) | **queued** (tracked) | awaiting_approval | blocked |
| `enterprise_rules` | **queued** (auto) | **queued** (tracked) | awaiting_approval | blocked |

**Cas `makeTracked` (advanced_operations + orange)** : `can_execute: true, approval_required: true, final_status_hint: "queued"`. L'executor produit le livrable, mais `approval_required: true` signale au processus aval qu'une relecture humaine est attendue avant diffusion.

### Branchement dans `build-tasks.ts`

- `PierreBuildTasksInput` enrichi avec `autonomy_level?: PierreAutonomyLevel`
- `computeHrEnrichment()` appelle `decidePierreHrExecutionPolicy()` — la décision autonomie est combinée avec la classification HR : `finalBlocked = req.blocked || autonomyDecision.blocked`
- Nouvelle fonction `autonomyAwareStatus()` remplace l'ancien `commonStatus` : respecte la priorité `blocked > awaiting_info > final_status_hint > scheduled/queued`
- Payload enrichi avec : `autonomy_level`, `can_execute`, `autonomy_decision: {can_execute, approval_required, blocked}`, `autonomy_reason`

### Branchement dans `use/submit/route.ts`

- Nouvelle fonction `readAutonomyLevel(supabase, userId)` — lit `memory_json.hr_preferences.autonomy_level` → `memory_json.autonomy_level` → `preferences.autonomy_level`, fallback `"validation_smart"` sur toute erreur
- Le handler `POST` appelle `readAutonomyLevel` après l'auth, avant `interpretMission`
- `routeHrPayload()` enrichit chaque tâche avec `autonomy_level`, `can_execute`, `autonomy_decision`, `autonomy_reason`
- `routeTaskStatus()` et `routeTaskApproval()` extraient les flags d'autonomie depuis le payload pour piloter le statut DB et `approval_required`
- La réponse `meta` inclut `autonomyLevel` pour observabilité

### Renforcement de `checkHrGate` dans `executors.ts`

Trois niveaux de protection, dans l'ordre :

1. **Gate 1 — HR hard-block** (inchangée) : `hr_action_class === "blocked_without_human"` ou `hr_approval_policy === "human_only"` → `"HR_BLOCKED_ACTION"`, `status: "blocked"`. Invariant, quel que soit le niveau d'autonomie.

2. **Gate 2 — Autonomy decision block** : `payload.autonomy_decision.blocked === true` → `"AUTONOMY_BLOCKED"`, `status: "blocked"`. Décision explicite du moteur d'autonomie.

3. **Gate 3 — can_execute sur tâches d'envoi** : `payload.can_execute === false` ET type dans `{email.send, send_email}` → `"AUTONOMY_BLOCKED"`, event `executor_autonomy_send_blocked`. **Les tâches de production de draft (doc.generate, email.draft, pdf.generate, etc.) passent toujours** — produire un draft est safe, envoyer sans autorisation ne l'est pas.

`"AUTONOMY_BLOCKED"` ajouté à l'union `error_code` de `PierreExecutorFailure`.

### Tests : `src/lib/pierre/__tests__/hr-autonomy.test.ts`

46 nouveaux tests (75 au total avec `hr-contracts.test.ts`) :

| Groupe | Tests |
|---|---|
| `resolvePierreAutonomyLevel` | niveaux valides, casse/espaces, inconnu → `"validation_smart"`, non-strings |
| `decidePierreHrExecutionPolicy` — noir | 5 niveaux × 2 cas noirs = 10 tests, tous bloqués |
| `draft_only` | vert/orange/rouge → tous awaiting_approval |
| `low_risk_execution` | vert → queued, orange/rouge → awaiting_approval |
| `validation_smart` | vert → queued, orange/rouge/inconnu → awaiting_approval |
| `advanced_operations` | vert → queued, orange → tracked (can_execute:true, approval:true), rouge → awaiting |
| `enterprise_rules` | même comportement que advanced_operations + noir reste noir |
| Invariants cross-niveaux | résultat complet, approval:false quand blocked:true, can_execute:false quand blocked:true |
| Gate 2 — autonomy_decision.blocked | bloque doc.generate, email.send ; log contient autonomy_level, hr_risk_level, hr_task_kind |
| Gate 3 — can_execute + send | bloque email.send et send_email ; laisse passer doc.generate, email.draft, pdf.generate |
| Ordre des gates | Gate 1 prend priorité sur Gate 2 ; tâche verte complète passe toutes les gates ; backward compat sans payload HR |

### Garanties désormais en place

| Garantie | Mécanisme |
|---|---|
| Les actions noires restent bloquées quel que soit le niveau d'autonomie | Gate 1 invariante, `decidePierreHrExecutionPolicy` vérifie avant le switch |
| Pierre ne s'exécute pas au-delà du niveau d'autonomie configuré | `can_execute: false` → statut `awaiting_approval` empêche l'exécution via le gate de statut existant |
| Les envois dangereux sont bloqués même quand can_execute manque d'être promu | Gate 3 : envoyer sans `can_execute: true` est refusé |
| La production de drafts ne bloque jamais | Gate 3 ne s'applique qu'aux types `email.send` et `send_email` |
| Fallback prudent sur toute erreur DB | `readAutonomyLevel` retourne `"validation_smart"` sur exception |
| `process-task.ts` n'a pas besoin de modification | Les statuts `awaiting_approval`/`blocked` sont déjà gérés correctement |
| Aucune migration DB | Autonomy fields vivent dans `payload_json` (jsonb existant) ; `autonomy_level` dans `memory_json.hr_preferences` |
| Aucun type public cassé | `"AUTONOMY_BLOCKED"` est additionnel à l'union existante |

### Ce qui reste à faire (Bloc 4+)

- **Profile employé 360** : enrichir les payloads avec des données employé (contrat actuel, ancienneté, absences récentes) pour contextualiser automatiquement les actions RH
- **Tests legacy** : `tasks.test.ts`, `interpret.test.ts`, `risk.test.ts`, `schedule.test.ts` — remettre à jour dans un Bloc dédié
- **Règles entreprise configurables** : `enterprise_rules` délègue actuellement à `advanced_operations` — placeholder pour des overrides configurables par entreprise

---

## 7. Bloc 4 — Employee Profile 360 Foundation (2026-05-11)

### Principe

Aucune migration Supabase. Les profils salariés sont stockés dans `pierre_company_memory.memory_json.employees[]` — un tableau jsonb existant, max 200 entrées. Les liens salarié ↔ missions/tâches/documents sont retrouvés via des requêtes jsonb `@>` (Postgres containment) sans index supplémentaire.

### Fichiers créés / modifiés

**`src/lib/pierre/hr/employee.ts`** — couche pure sans dépendance DB/UI

Types :
- `PierreContractType` — union des 7 types de contrat : `"cdi" | "cdd" | "alternance" | "stage" | "independant" | "interim" | "autre"`
- `PierreEmployeeStatus` — `"active" | "inactive" | "onboarding" | "offboarding" | "unknown"`
- `PierreEmployeeProfile` — profil complet (id, full_name, email, job_title, department, contract_type, date_entree, date_sortie, status, tags)
- `PierreEmployeeContext` — projection légère pour injection dans les payloads de tâche (sans données sensibles)

Fonctions pures :
- `sanitizePierreEmployeeProfile(raw)` — valide et nettoie un profil entrant ; retourne null si `id` ou `full_name` manquants
- `sanitizePierreEmployeeList(raw)` — max 200 profils, ignore les invalides silencieusement
- `findPierreEmployeeById(employees, id)` — lookup insensible à la casse
- `findPierreEmployeeByName(employees, name)` — match exact d'abord, partiel ensuite
- `buildPierreEmployeeContext(profile)` — projection légère (exclut `job_title`)
- `resolveEmployeeContext(employees, {employee_id?, employee_name?})` — résolution id-first, puis name
- `enrichPayloadWithEmployeeContext(payload, context)` — spread immutable, ajoute `employee_context`

**`src/lib/pierre/memory.ts`** — ajout de `employees: []` dans `buildPierreDefaultMemoryShape()`

**`src/app/api/pierre/use/submit/route.ts`** — wiring employé dans le pipeline

- `SubmitBody` enrichi avec `source`, `autonomy_level`, `employee_id`, `employee_name`
- Nouvelle fonction `readEmployeeList(supabase, userId)` — lit `memory_json.employees` depuis `pierre_company_memory`
- `POST` handler : appelle `resolveEmployeeContext` → `buildPierreEmployeeContext` → `enrichPayloadWithEmployeeContext` sur chaque tâche
- `brain_output_json` et `context_snapshot_json` incluent `employee_context` si présent

**`src/app/api/pierre/use/employee/[employeeId]/route.ts`** — nouvelle route GET

Retourne un dossier salarié 360 calculé à la volée :

```json
{
  "ok": true,
  "employee": { "id": "...", "full_name": "...", "status": "active", ... },
  "missions": [ ... ],
  "tasks": [ ... ],
  "documents": [ ... ],
  "summary": {
    "total_missions": 3,
    "total_tasks": 12,
    "tasks_by_status": { "ready": 8, "awaiting_approval": 4 },
    "tasks_pending_approval": 4,
    "last_mission_at": "2026-05-10T...",
    ...
  },
  "meta": { "employeeId": "...", "userId": "...", "fetchedAt": "...", "counts": { ... } }
}
```

Détail des requêtes :
- `resolveEmployeeProfile()` : lit `pierre_company_memory.memory_json.employees[]`, trouve par id
- `fetchEmployeeTasks()` : deux requêtes `@>` — `payload_json @> {employee_id}` ET `payload_json @> {employee_context: {employee_id}}` — dédupliquées par id
- `fetchMissionsForTasks()` : `.in("id", missionIds)` sur `pierre_missions`
- `fetchDocumentsForMissions()` : `.in("mission_id", missionIds)` sur `pierre_documents`

Auth : Bearer + cookie, vérification `orders` (accès Pierre actif), 401/403/404 structurés.

### Tests : `src/lib/pierre/__tests__/hr-employee.test.ts`

48 nouveaux tests (123 au total avec les 3 fichiers) :

| Groupe | Tests |
|---|---|
| `sanitizePierreEmployeeProfile` — valide | profil complet, profil minimal, tous les contract_type, tous les status, trim, limite tags 20, ignore tags non-string |
| `sanitizePierreEmployeeProfile` — invalide | null, undefined, non-object, id manquant, full_name manquant, id vide, full_name vide, status inconnu → "unknown", contract_type inconnu → null, champs optionnels → null |
| `sanitizePierreEmployeeList` | non-array → [], array vide, filtre invalides silencieusement, limite 200 |
| `findPierreEmployeeById` | trouvé exact, insensible à la casse, trim whitespace, non trouvé, id vide, liste vide |
| `findPierreEmployeeByName` | match exact insensible casse, priorité exact sur partiel, fallback partiel, match inverse, non trouvé, nom vide, liste vide |
| `buildPierreEmployeeContext` | mapping complet, absence de job_title, champs null quand absents |
| `resolveEmployeeContext` | id prioritaire sur name, fallback name, fallback name quand id introuvable, null si aucun résultat, null si inputs null, null sur liste vide |
| `enrichPayloadWithEmployeeContext` | injecte employee_context, ne modifie pas le payload original, payload inchangé si context null, écrase employee_context existant |

### Garanties désormais en place

| Garantie | Mécanisme |
|---|---|
| Aucune migration Supabase | Profils dans `memory_json.employees[]` (jsonb existant) |
| Links salarié ↔ tâches sans colonne dédiée | Requêtes jsonb `@>` Postgres |
| Les payloads de tâche ne contiennent pas de données sensibles | `buildPierreEmployeeContext` exclut `job_title` et autres champs non-légers |
| Le pipeline submit est résilient aux employés non trouvés | `resolveEmployeeContext` retourne null → aucun enrichissement, aucune erreur |
| Isolation correcte des profils par tenant | Toutes les requêtes filtrent sur `user_id` |
| Type safety complète | `tsc --noEmit` sans erreur ; 123/123 tests verts ; `npm run build` OK |

---

## 8. Bloc 5 — Employee registry API + terminal workflow (2026-05-11)

### Contexte

Le Bloc 4 a posé la fondation : types purs, stockage dans `memory_json`. L'audit de Bloc 5 a révélé que `memory_json` **n'existe pas** dans le schéma réel Supabase (`types.ts` source de vérité). La colonne jsonb réelle confirmée est `reusable_rh_context_json`. Tous les accès aux profils salariés ont été corrigés pour cibler cette colonne.

### Correction du stockage (breaking fix silencieux)

Avant : `pierre_company_memory.memory_json.employees[]` (colonne inexistante → reads silencieux → employees toujours `[]`).

Après : `pierre_company_memory.reusable_rh_context_json.employees[]` (colonne jsonb réelle confirmée dans `types.ts`).

Trois fichiers corrigés :
- `submit/route.ts` — `readEmployeeList()` cible maintenant `reusable_rh_context_json` + filtre `agent_slug = "pierre"`
- `employee/[employeeId]/route.ts` — `resolveEmployeeProfile()` idem
- Les deux nouvelles routes utilisent directement `reusable_rh_context_json` dès la création

### Fonctions pures ajoutées à `src/lib/pierre/hr/employee.ts`

```typescript
upsertPierreEmployeeProfile(employees, profile)
  → { employees: PierreEmployeeProfile[]; mode: "created" | "updated" }

updatePierreEmployeeProfile(employees, id, patch)
  → { employees: PierreEmployeeProfile[]; employee: PierreEmployeeProfile | null }

deletePierreEmployeeProfile(employees, id)
  → { employees: PierreEmployeeProfile[]; deleted: boolean }
```

Toutes immutables, case-insensitive sur `id`, sans dépendance DB/UI.

### Routes créées

**`GET /api/pierre/use/employees`**
```json
{ "ok": true, "employees": [...], "count": 2, "meta": { "userId": "...", "fetchedAt": "..." } }
```

**`POST /api/pierre/use/employees`**
```json
body: { "employee": { "full_name": "Alice Dupont", "contract_type": "cdi", ... } }
→ { "ok": true, "employee": {...}, "employees": [...], "count": 2, "mode": "created" }
```
- `id` auto-généré via `crypto.randomUUID()` si absent
- Upsert par `id` : remplace si existant, ajoute si nouveau
- Limite 200 employés

**`GET /api/pierre/use/employees/[employeeId]`**
```json
→ { "ok": true, "employee": {...} }  // 404 si introuvable
```

**`PATCH /api/pierre/use/employees/[employeeId]`**
```json
body: { "status": "offboarding", "department": "Finance" }
→ { "ok": true, "employee": { merged profile } }
```
Merge partiel — ne modifie que les champs fournis.

**`DELETE /api/pierre/use/employees/[employeeId]`**
```json
→ { "ok": true, "deleted": true, "employee_id": "..." }
// Ne supprime pas les missions/tasks/documents historiques
```

### Mécanique de stockage

```
pierre_company_memory
  WHERE user_id = ? AND agent_slug = "pierre"
  COLUMN reusable_rh_context_json = {
    "employees": [ {...}, {...} ],
    // autres clés préservées par merge
  }
```

- **Lecture** : `.select("reusable_rh_context_json").eq("user_id", …).eq("agent_slug", "pierre")`
- **Écriture** : spread `{ ...currentContext, employees: nextEmployees }` → update de `reusable_rh_context_json` uniquement
- **Création** si aucune ligne : `.insert({ user_id, agent_slug: "pierre", reusable_rh_context_json: { employees: [emp] } })`
- Les colonnes flat (`company_name`, `preferred_tone`, etc.) ne sont **jamais touchées**

### Tests

48 tests initiaux + 29 tests nouveaux = **171 tests au total** (3 fichiers).

Nouvelles couvertures dans `hr-employee.test.ts` :

| Groupe | Tests |
|---|---|
| `upsertPierreEmployeeProfile` — create | append, immutabilité, limite 200 |
| `upsertPierreEmployeeProfile` — update | remplace par id, case-insensitive, préserve autres |
| `updatePierreEmployeeProfile` | merge partiel, préserve champs, null si introuvable, null si invalide, immutabilité, case-insensitive |
| `deletePierreEmployeeProfile` | supprime, false si introuvable, case-insensitive, immutabilité, dernier élément, liste vide |

### Comment tester depuis le terminal

```powershell
# 1. Démarrer le serveur de dev
npm run dev

# 2. Définir le JWT (depuis les DevTools navigateur → Application → Cookies)
$env:PIERRE_TEST_JWT = "eyJ..."

# 3. Lancer le workflow complet
.\scripts\pierre-employee360-terminal-test.ps1
```

Le script exécute dans l'ordre : créer salarié → lister → soumettre mission rattachée → vue 360 → patch + GET unitaire.

### Limites actuelles

- **200 salariés max** par entreprise (contrainte applicative, pas DB)
- Pas de recherche full-text côté API (find by name fait côté client sur la liste retournée)
- Le lien entre salarié et tâches repose sur `payload_json @>` (containment) — performant jusqu'à ~10k tâches/user, pas indexé
- `agent_slug = "pierre"` requis pour lire la mémoire RH — les lignes créées via `company-memory/route.ts` sans agent_slug ne contiennent pas les salariés (orthogonal, pas de collision)

### Prochaine étape recommandée

- **Bloc 6** : Cockpit UI minimal — liste salariés, formulaire création, lien vers vue 360
- Ou : endpoint de recherche salarié par nom (`GET /api/pierre/use/employees?q=alice`) pour faciliter le submit sans id connu

---

## 9. Comment ce fichier reste branché (post-Bloc 1)

---

## 11. Bloc 6 — Employee 360 Backend Premium V1 (2026-05-12)

### Nouvelles fonctions dans `hr/employee.ts`

**`detectEmployeeReferenceFromText(input, employees)`**
Détecte un salarié connu à partir d'un texte libre. Deux niveaux de matching :
1. `full_name` apparaît verbatim dans le texte (insensible à la casse, vérification de frontières de mot pour éviter les faux positifs type "Ali" dans "Alice").
2. Tous les tokens du nom (≥ 2 caractères) apparaissent dans le texte avec frontières de mot.

Utilisée dans `submit/route.ts` comme fallback quand `employee_id` / `employee_name` ne resolvent pas.

**`buildEmployee360Summary(employee, missions, tasks, documents, logs?)`**
Fonction pure construisant un résumé 360° complet. Retourne :
- `total_missions`, `total_tasks`, `total_documents`, `total_logs`
- `tasks_by_status` (agrégat)
- `pending_approval_count`, `blocked_count`, `scheduled_count`
- `last_mission_at`, `last_task_at`, `last_document_at`, `last_activity_at`

**`enrichPayloadWithEmployeeContext(payload, context)`** — mise à jour
Ajoute désormais aussi les champs plats `employee_id` et `employee_name` en plus du bloc `employee_context`. Permet les requêtes `@> { employee_id: ... }` simples.

**`Employee360Summary`** — nouveau type exporté.

### Améliorations `submit/route.ts`

- Import de `detectEmployeeReferenceFromText` et `buildPierreEmployeeContext`
- Si `employee_id` est fourni mais non résolu : `employee_resolution_warning` injecté dans `brain_output_json` et `context_snapshot_json`
- Fallback texte : si résolution par id/nom échoue, `detectEmployeeReferenceFromText` tente de retrouver le salarié dans le texte libre de la mission

### Améliorations `employee/[employeeId]/route.ts`

Nouveau champ **`timeline`** — tableau chronologique fusionné (missions + tâches + documents + logs), chaque item : `{ type, id, title, status, created_at, source_table }`.

Nouveau champ **`logs`** — jusqu'à 100 logs liés à l'employé via :
1. `pierre_task_logs.meta_json @> { employee_id }` (compatibilité future)
2. `pierre_task_logs.mission_id in [missionIds]` (missions liées à l'employé)

Résumé étendu — utilise désormais `buildEmployee360Summary` (fonction pure partagée). Ajoute : `pending_approval_count`, `blocked_count`, `scheduled_count`, `last_activity_at`.

Meta `counts` étendu : `missions`, `tasks`, `documents`, `logs`, `timeline_items`.

### Tests

173 tests (141 → +32). Nouvelles suites :
- `detectEmployeeReferenceFromText` — null/empty, exact match, partial token match, edge cases (14 tests)
- `buildEmployee360Summary` — counts, status grouping, approval/blocked/scheduled, dates, employee fields (18 tests)
- `enrichPayloadWithEmployeeContext` — 4 nouveaux tests vérifiant les champs plats `employee_id` / `employee_name`

### Script terminal E2E

`scripts/pierre-employee360-terminal-test.ps1` — réécrit en 10 étapes :
1. Création salarié
2. Liste salariés
3. Submit mission avec `employee_id` + vérification champs plats dans payload
4. Vue 360 — vérification `timeline`, `logs`, nouveaux champs summary
5. PATCH salarié
6. GET salarié unitaire (vérification patch)
7. Submit mission via détection texte (sans `employee_id`)
8. Vue 360 — détail timeline/logs
9. DELETE salarié
10. Vérification 404 après suppression

`exit 1` automatique si un step critique échoue. Aucun secret en dur.

---

## 12. Bloc 7 — Employee 360 Operational History (2026-05-13)

### Objectif

Transformer le dossier salarié 360 en vraie brique opérationnelle RH : lien renforcé salarié↔mission↔tâches↔documents↔logs, vue 360 enrichie avec insights calculés côté serveur, traçabilité de la résolution d'employé dans les missions, endpoint dédié pour l'historique salarié.

### Nouvelles fonctions dans `hr/employee.ts`

**`normalizeEmployeeActivityDate(value)`** — valide et retourne une date ISO string, null sinon.

**`buildEmployeeTimeline({ missions, tasks, documents, logs })`**
Remplace la fonction locale `buildTimeline` dans `employee/[employeeId]/route.ts`. Retourne un `EmployeeTimelineItem[]` trié desc par `created_at`. Chaque item inclut désormais `mission_id` et `task_id` pour faciliter la navigation côté client.

**`buildEmployeeInsights(summary, timeline, now?)`**
Calcule sans IA les indicateurs opérationnels d'un salarié :
- `has_pending_approvals`, `has_blocked_items`, `has_scheduled_followups`, `needs_attention`
- `latest_activity_label` : label relatif humain ("Aujourd'hui", "Hier", "Il y a N jours", etc.)
- `recommended_next_action` : action prioritaire suggérée basée sur l'état réel des tâches

**Nouveau type `EmployeeTimelineItem`** — type exporté incluant `mission_id?` et `task_id?`.

**Nouveau type `EmployeeInsights`** — type exporté.

**`Employee360Summary` — champs ajoutés** :
- `completed_or_done_count: number` — tâches au statut `"done"` ou `"completed"`
- `last_log_at: string | null` — date du dernier log lié à l'employé

### Améliorations `submit/route.ts`

**`employee_resolution_source`** — nouveau champ injecté dans `brain_output_json` et `context_snapshot_json`. Valeurs possibles : `"explicit_id"` | `"explicit_name"` | `"text_detection"` | `"none"`.

Logique de résolution réécrite pour distinguer précisément les trois chemins :
1. `body.employee_id` fourni → `findPierreEmployeeById` → source = `"explicit_id"`
2. `body.employee_name` fourni → `findPierreEmployeeByName` → source = `"explicit_name"`
3. Fallback texte → `detectEmployeeReferenceFromText` → source = `"text_detection"`

**Champs plats dans les JSON blobs** — `brain_output_json` et `context_snapshot_json` reçoivent désormais `employee_id`, `employee_name`, `employee_context` (quand résolu) + `employee_resolution_source` (toujours).

**Warning étendu** — si `employee_name` est fourni mais non résolu, un warning est aussi ajouté (en plus du warning sur `employee_id`).

Correction commentaire erroné dans `readEmployeeList` : `memory_json.employees[]` → `reusable_rh_context_json.employees[]`.

### Améliorations `employee/[employeeId]/route.ts`

- `buildTimeline` locale supprimée → remplacée par `buildEmployeeTimeline` importée de `hr/employee.ts`
- Timeline items enrichis avec `mission_id` et `task_id`
- Nouveau champ `insights` dans la réponse (calculé via `buildEmployeeInsights`)
- Summary enrichi avec `completed_or_done_count` et `last_log_at`

### Nouvelle route `GET /api/pierre/use/employee/[employeeId]/history`

Endpoint dédié à l'historique opérationnel d'un salarié.

```
GET /api/pierre/use/employee/:employeeId/history?limit=50
```

- `?limit` configurable, défaut 50, max 200
- Retourne `{ ok, employee, events, grouped, meta }`
  - `events` : tableau chronologique flat (limite appliquée)
  - `grouped` : `{ missions, tasks, documents, logs }` — sous-ensembles de `events` par type
  - `meta.total_events` : nombre total d'événements avant troncature

### Tests

210 tests (173 → +37). Nouvelles suites dans `hr-employee.test.ts` :

| Groupe | Tests |
|---|---|
| `buildEmployee360Summary` Bloc 7 — nouveaux champs | `completed_or_done_count`, `last_log_at` (6 tests) |
| `normalizeEmployeeActivityDate` | valid, trimmed, null cases (5 tests) |
| `buildEmployeeTimeline` — basic structure | types, source_table, mission_id, task_id, filtering (6 tests) |
| `buildEmployeeTimeline` — sorting | ordre desc, null dates, title fallbacks (4 tests) |
| `buildEmployeeInsights` — flags | has_pending, has_blocked, has_scheduled, needs_attention (7 tests) |
| `buildEmployeeInsights` — recommended_next_action | 5 cas (5 tests) |
| `buildEmployeeInsights` — latest_activity_label | today, hier, N jours, null (4 tests) |

### Script terminal E2E

`scripts/pierre-employee360-history-test.ps1` — 12 étapes :
1. Création salarié (bloc7-e2e)
2. Submit mission avec `employee_id` → vérification `employee_resolution_source = "explicit_id"`, champ plat `employee_id` dans `brain_output_json`
3. Submit mission via détection texte → vérification `employee_resolution_source = "text_detection"`
4. Submit mission avec `employee_name` → vérification `employee_resolution_source = "explicit_name"`
5. Vue 360 — vérification `insights`, `completed_or_done_count`, `last_log_at`, `mission_id`/`task_id` dans timeline
6. History endpoint (limit par défaut)
7. History endpoint avec `?limit=5`
8. PATCH salarié
9. Vue 360 post-patch — vérification insights mis à jour
10. History 404 pour salarié inconnu
11. DELETE salarié
12. Vérification 404 après suppression

### Invariants respectés

- Aucune migration Supabase nécessaire — tout repose sur `reusable_rh_context_json.employees[]`
- `user_id + agent_slug = "pierre"` systématique sur toutes les requêtes
- Fonctions pures sans DB dans `hr/employee.ts` — testables unitairement sans mock
- `buildEmployeeTimeline` remplace exactement la fonction locale — pas de régression dans les tests E2E existants

---

## 13. Bloc 8 — Real Execution + Artifacts RH V1 (2026-05-13)

### Objectif

Faire passer Pierre de "il comprend et structure" à "il exécute réellement des tâches RH autorisées et produit des artefacts exploitables". Toute exécution produit : `result_json` + logs + artefact persisté.

### Nouveaux fichiers

**`src/lib/pierre/tasks/artifacts.ts`** — couche pure sans DB ni async

Types exportés :
- `PierreArtifactKind` : `"document" | "email_draft" | "email_send" | "followup" | "missing_info" | "pdf_ready" | "internal_note"`
- `PierreArtifactStatus` : `"generated" | "draft" | "sent" | "blocked" | "pending"`
- `PierreTaskExecutionInput` — input d'un artifact builder : `{ task, employee?, mission?, company_memory?, now? }`
- `PierreArtifact` — artefact produit : `{ kind, status, title, content_text, content_html, doc_type, to_json, cc_json, bcc_json, subject, scheduled_for, missing_fields, tags, domain }`
- `PierreArtifactQuality` — score qualité : `{ score (0-100), has_content, has_title, has_recipient, has_employee_context, is_complete, warnings[] }`
- `PierreTaskExecutionResult` — résultat complet : `{ ok, artifact_kind, artifact_status, artifact, quality, meta }`

Fonctions exportées :
- `inferPierreArtifactKind(taskType, payload_json?)` — mappe le type de tâche vers un artifact kind. Fallback par inspection du payload si type non reconnu.
- `buildPierreDocumentArtifact(input)` — détection de domaine RH (onboarding/recrutement/absence/paie/disciplinaire/relance/général), contenu template par domaine, extrait le contenu existant de `payload_json` si présent.
- `buildPierreEmailDraftArtifact(input)` — collecte destinataires (`to`, `recipient_email`, `employee.email`), déduplique, fallback template FR/EN.
- `buildPierreFollowupArtifact(input)` — capture `scheduled_for`, titre incluant le nom salarié.
- `buildPierreMissingInfoArtifact(input)` — extrait `missing_info` + `missing_fields` + `champs_manquants`, déduplique.
- `buildPierrePdfReadyArtifact(input)` — identique au document mais `doc_type: "pdf_export"`.
- `scorePierreArtifactQuality(artifact, input)` — score pondéré : 45 pts contenu, 20 pts titre, 20 pts destinataire (email), 15 pts contexte salarié. `is_complete` si score ≥ 75.
- `buildPierreTaskExecutionResult(input)` — dispatcher central qui appelle le bon builder selon `inferPierreArtifactKind()`.

**`src/lib/pierre/tasks/execute-task.ts`** — exécuteur DB-connecté

Fonction principale :
```typescript
executePierreTaskWithPersistence(params: {
  supabaseAdmin: SupabaseClient;
  taskId: string;
  userId: string;
}): Promise<PierreExecutionPersistenceResult>
```

Pipeline d'exécution :
1. Charge la tâche depuis `pierre_tasks` (`user_id + agent_slug = "pierre"`)
2. Refuse si statut terminal : `done | cancelled | error | awaiting_approval`
3. Charge la mémoire entreprise (`pierre_company_memory`) pour tone/langue
4. Résout le contexte salarié depuis `payload_json.employee_context` ou `payload_json.employee_id`
5. Passe le statut à `"running"` dans `pierre_tasks`
6. Log `event_type: "task_execution_started"` (nouveau schéma)
7. Appelle `executePierreTask()` depuis `executors.ts` (pure — HR gate + routage)
8. Appelle `buildPierreTaskExecutionResult()` pour l'artefact riche + qualité
9. Persiste l'artefact selon le kind :
   - `document | pdf_ready | followup | missing_info` → `pierre_documents` (colonnes réelles : `user_id, agent_slug, mission_id, task_id, doc_type, title, text_content, html_content, source_kind: "task_execution", tags_json`)
   - `email_draft | email_send` → `pierre_outbound_emails` (colonnes réelles : `user_id, agent_slug, mission_id, task_id, to_json, cc_json, bcc_json, subject, text_snapshot, html_snapshot, sender_profile_json, status`)
10. Met à jour `pierre_tasks.status` (done/blocked/error/awaiting_approval) et `result_json`
11. Log `event_type: "task_execution_completed" | "task_execution_failed"` (nouveau schéma)

Type résultat :
```typescript
PierreExecutionPersistenceResult = {
  ok: boolean;
  task_id: string;
  mission_id: string | null;
  outcome: "completed" | "blocked" | "failed" | "awaiting_info" | "awaiting_approval";
  artifact: { kind, status, document_id, email_id } | null;
  execution_result: PierreTaskExecutionResult;
  error?: string;
  error_code?: string;
}
```

### Route refactorisée

**`POST /api/pierre/use/task/[taskId]/run`**

Avant : `processPierreTask` (queue lib, logs vieux schéma `level/event/message/payload`).

Après : `executePierreTaskWithPersistence` + `hasPierreAccess` de `@/lib/pierre/access`.

Réponse enrichie :
```json
{
  "ok": true,
  "task_id": "...",
  "mission_id": "...",
  "outcome": "completed",
  "artifact": {
    "kind": "document",
    "status": "generated",
    "document_id": "...",
    "email_id": null
  },
  "execution_result": {
    "ok": true,
    "artifact_kind": "document",
    "artifact_status": "generated",
    "artifact": { "title": "...", "content_text": "...", ... },
    "quality": { "score": 80, "is_complete": true, ... },
    "meta": { "task_id": "...", "domain": "onboarding", ... }
  },
  "meta": { "taskId": "...", "userId": "...", "fetchedAt": "..." }
}
```

### Schéma de logs utilisé

Nouveau schéma exclusivement (`event_type`, `message`, `meta_json`, `user_id`, `agent_slug`). Les routes existantes (`cancel`, `reschedule`, `approve`, `process-task`) conservent le vieux schéma (`level`, `event`, `message`, `payload`) — coexistence préservée.

### Tests

**`src/lib/pierre/__tests__/task-artifacts.test.ts`** — 78 nouveaux tests (288 au total).

| Groupe | Tests |
|---|---|
| `inferPierreArtifactKind` | tous les types nommés, null, fallback payload (20 tests) |
| `buildPierreDocumentArtifact` | kind/status, payload existant, titre, domaine, contexte salarié, tags, html (12 tests) |
| `buildPierreEmailDraftArtifact` | kind send/draft, subject, recipients, déduplique, body existant (8 tests) |
| `buildPierreFollowupArtifact` | kind, status, scheduled_for, titre salarié, doc_type, tags (6 tests) |
| `buildPierreMissingInfoArtifact` | kind, status, extraction missing_fields, déduplication, doc_type (5 tests) |
| `buildPierrePdfReadyArtifact` | kind, status, doc_type, payload existant, tags (5 tests) |
| `scorePierreArtifactQuality` | score 0, has_content, has_title, has_employee_context, warning destinataire, score 100, is_complete (7 tests) |
| `buildPierreTaskExecutionResult` | dispatch par type, ok flag, meta, domain, quality (15 tests) |

`package.json` mis à jour : `task-artifacts.test.ts` ajouté au script `npm test`.

### Script terminal E2E

`scripts/pierre-real-execution-test.ps1` — 12 étapes :
1. Submit mission doc.generate
2. Fetch mission → récupère les task_ids
3. `POST /run` sur la première tâche
4. Vérifie la forme de la réponse (artifact + execution_result + quality)
5. Vérifie le statut de la tâche en DB (GET /task/{id})
6. Vérifie la présence de logs
7. Vérifie la persistance de l'artefact (document ou email)
8. Submit mission email.draft + run
9. Re-run d'une tâche terminée → erreur gracieuse attendue
10. Compatibilité Bloc 5 : `POST /api/pierre/doc/generate`
11. Compatibilité Bloc 7 : `GET /api/pierre/use/employee/{id}`
12. Rapport final PASS/FAIL

### Invariants respectés

| Invariant | Mécanisme |
|---|---|
| Blocs 5/6/7 non cassés | Aucune modification des routes `doc/generate`, `email/draft`, `email/send`, `employees`, `employee/[id]/history` |
| Logs vieux schéma préservés | `cancel/reschedule/approve/process-task` inchangés |
| Colonnes DB réelles uniquement | `pierre_documents` : pas de `status`/`metadata` non confirmés ; `pierre_outbound_emails` : `to_json/cc_json/bcc_json/text_snapshot/html_snapshot` |
| Multi-tenant | `user_id + agent_slug = "pierre"` systématique |
| Validation humaine non bypassée | HR gate de `executors.ts` appliquée avant tout executor ; `awaiting_approval` bloqué dans `execute-task.ts` |
| Aucune email réel envoyé | `pierre_outbound_emails.status` = `"draft"` ou `"queued"` — pas de dispatch SMTP |
| Fonctions pures testables | `artifacts.ts` : zéro DB, zéro async, 78 tests unitaires |

---

## 10. Pourquoi cette brique respecte la vision Pierre

Pierre est un **poste RH opérationnel**, pas un assistant conversationnel.

Un assistant génère ce qu'on lui demande. Un poste opérationnel **sait ce qu'il peut faire seul, ce qu'il doit préparer pour validation, et ce qu'il ne peut pas décider**.

La matrice `PIERRE_ACTION_VALIDATION_MATRIX` incarne exactement cette distinction :
- Certaines actions sont **déléguées** à Pierre (vert) — c'est son rôle de les exécuter sans attendre.
- D'autres sont **soumises** à l'humain (orange, rouge) — Pierre produit le livrable, l'humain garde la décision.
- D'autres enfin sont **bloquées** (noir) — Pierre ne peut pas s'y substituer, quelle que soit la configuration.

Cette gradation n'est pas une limitation technique. C'est la **définition du rôle de Pierre** dans une organisation : autonomie calibrée, traçabilité complète, humain toujours en position de décision finale sur les sujets à enjeux.

Un assistant ne connaît pas ses limites. Pierre, si.

---

## 14. Bloc 9 — HR Workflow Engine V1 (2026-05-14)

### Objectif

Jusqu'au Bloc 8, Pierre savait **exécuter** une tâche. Mais il ne savait pas encore **quelles tâches créer** à partir d'une demande libre. L'interprétation initiale de `submit/route.ts` était rudimentaire : classification par mots-clés, tâches génériques, sans domaine RH ni risque calibrés.

Le Bloc 9 remplace entièrement cette interprétation par un **moteur de workflow RH pur** : 11 domaines, analyse de risque couleur, tâches structurées par domaine, validation humaine garantie là où elle est requise.

---

### `src/lib/pierre/hr/workflows.ts` — moteur pur sans DB ni async

Module de ~1 000 lignes. Aucune dépendance DB, Next, ou Supabase. Entièrement testable unitairement.

#### Types exportés

| Type | Description |
|---|---|
| `PierreHrWorkflowDomain` | 11 domaines : `hiring`, `onboarding`, `absence`, `contract`, `payroll_prep`, `employee_file`, `training`, `interview`, `offboarding`, `sensitive_case`, `general_hr` |
| `PierreHrWorkflowRiskLevel` | `"green" \| "orange" \| "red" \| "black"` |
| `PierreHrWorkflowPriority` | `"low" \| "normal" \| "high" \| "urgent"` |
| `PierreHrWorkflowMissingInfo` | `{ field, question, required }` |
| `PierreHrWorkflowValidationPolicy` | `{ approval_required, approval_reason, blocked, can_execute_low_risk_tasks }` |
| `PierreHrWorkflowNextAction` | `{ type: "provide_info" \| "validate" \| "execute" \| "escalate", description }` |
| `PierreHrWorkflowTaskDraft` | `{ type, title, description, status, approval_required, execute_at, payload_json }` — `execute_at`, jamais `scheduled_for` |
| `PierreHrWorkflowAnalysis` | Analyse complète produite par le moteur |
| `PierreHrWorkflowPlan` | Plan complet prêt à être persisté en DB |

#### Fonctions exportées

- `extractPierreHrWorkflowSignals(input)` — retourne les signaux détectés dans le texte
- `detectPierreHrWorkflowDomain(input, context?)` — priorité : sensitive_case > offboarding > contract > hiring > payroll_prep > absence > onboarding > employee_file > training > interview > general_hr
- `detectPierreHrWorkflowRisk(input, domain, context?)` — baseline par domaine, escalade par signaux, jamais de réduction
- `detectPierreHrWorkflowPriority(input, domain, risk?)` — urgent si black ou signal d'urgence, high si red ou payroll/offboarding, low sinon
- `buildPierreHrMissingInfo(domain, input, employeeContext?)` — infos manquantes par domaine, supprime `employee_name` si "aucun salarié spécifique"
- `buildPierreHrWorkflowTasks(analysis)` — 11 builders de tâches par domaine, enrichissement employee_context, reminder.create bloqué si infos requises manquantes
- `mapPierreWorkflowTaskToDbTask(task)` — mappe vers le format DB réel : `execute_at` (pas `scheduled_for`)
- `buildPierreHrWorkflowPlan(input, options?)` — plan complet prêt à persister
- `explainPierreWorkflowPlan(plan)` — explication textuelle structurée

#### Règles de statut des tâches par domaine

| Domaine | Statut principal |
|---|---|
| `sensitive_case` | Toutes `awaiting_approval` |
| `contract` | doc.generate + email.draft → `awaiting_approval` |
| `payroll_prep` | doc.generate (synthèse) → `awaiting_approval` |
| `offboarding` avec risque red/black | `awaiting_approval` |
| Autres domaines | `ready` |
| Reminder si infos requises manquantes | `blocked` |

#### Blocked actions par domaine

- `sensitive_case` : 5 actions bloquées (envoi direct, décision finale, notification externe, modification pièces, conclusions disciplinaires)
- Risque `black` : 2 actions bloquées (décision irréversible, communication externe)
- `contract` : 2 actions bloquées (signature sans validation, envoi direct)
- `payroll_prep` : 1 action bloquée (transmission directe sans validation)

---

### `src/app/api/pierre/use/submit/route.ts` — intégration du moteur

Réécriture complète. ~500 lignes (vs 1 304 avant). Toute la logique d'interprétation précédente supprimée.

**Ce qui est supprimé :**
- Fonctions : `detectLanguage`, `detectTone`, `detectClassification`, `detectIntent`, `detectRisk`, `needsApproval`, `detectScheduling`, `detectMissingInfo`, `buildMissionSummary`
- Fonctions : `routeClassificationToHrDomain`, `routeTaskKind`, `routeHrPayload`, `routeTaskStatus`, `routeTaskApproval`, `buildTasks`, `interpretMission`
- Types internes : `MissionRiskLevel`, `TaskLifecycleStatus`, `MissionTaskDraft`, `MissionInterpretationBase`, `MissionInterpretation`

**Ce qui est conservé :**
- Auth complète (Bearer + cookie Supabase)
- `hasPierreAccess` (orders table)
- `readEmployeeList`, `readAutonomyLevel`
- Employee resolution pipeline (explicit_id → explicit_name → text_detection)
- `insertMission`, `insertTasks`, `insertLogs` (mis à jour)
- `normalizeBody`, `mapDbError`, `createAdminClient`

**Mise à jour de `mapToDbRiskLevel` :**
```
green  → "low"
orange → "medium"
red    → "high"
black  → "high"
```

**`insertMission` — champs `brain_output_json` enrichis :**
```json
{
  "workflow_domain": "onboarding",
  "workflow_priority": "normal",
  "workflow_risk_level": "green",
  "workflow_explanation": "...",
  "approval_required": false,
  "validation_policy": { ... },
  "blocked_actions": [],
  "recommended_next_action": { "type": "execute", "description": "..." },
  "can_execute_low_risk_tasks": true,
  "task_count": 4,
  "task_types": ["doc.generate", "email.draft", "reminder.create", "followup.schedule"]
}
```

**`insertTasks` — colonnes DB réelles :**
```typescript
{
  mission_id, user_id, agent_slug: "pierre",
  type: dbTask.type,       // canonical (doc.generate, email.draft, etc.)
  title, description,
  status,                  // "ready" | "awaiting_approval" | "blocked"
  approval_required,
  execute_at,              // JAMAIS scheduled_for
  payload_json             // enrichi avec employee_context si présent
}
```

**`insertLogs` — nouveaux event types :**

| event_type | Condition |
|---|---|
| `mission_created` | Toujours |
| `workflow_analyzed` | Toujours |
| `human_validation_required` | Si `plan.approval_required = true` |
| `missing_info_detected` | Si `plan.missing_info.length > 0` |
| `sensitive_case_detected` | Si `plan.domain = "sensitive_case"` |
| `task_created` | Par tâche créée |

**Réponse — champs ajoutés / conservés :**

```json
{
  "ok": true,
  "mission": { ... },
  "interpretation": {          // champ compat front-end conservé
    "intent": "onboarding",
    "summary": "[Intégration salarié / risque green] ...",
    "risk_level": "green",
    "approval_required": false,
    "missing_info": [],
    "missing_info_questions": []
  },
  "workflow_plan": { ... },    // nouveau — plan complet du moteur
  "tasks": [ ... ],
  "logs": [ ... ],
  "threadEntries": [ ... ],
  "meta": { ... }
}
```

---

### Tests

**`src/lib/pierre/__tests__/hr-workflows.test.ts`** — 92 tests (380 au total).

| Groupe | Tests |
|---|---|
| `extractPierreHrWorkflowSignals` | signaux hiring/absence/sensitive, déduplication, aucun signal (5 tests) |
| `detectPierreHrWorkflowDomain` | 11 domaines depuis inputs naturels, priorité sensitive_case > offboarding, override contexte valide/invalide (13 tests) |
| `detectPierreHrWorkflowRisk` | baseline par domaine, escalade black/red/orange, jamais réduit, override contexte (8 tests) |
| `detectPierreHrWorkflowPriority` | urgent (black, signal), high (red, payroll), normal, low, sensitive_case toujours urgent (7 tests) |
| `buildPierreHrMissingInfo` | 11 domaines, employee_context supprime employee_name, "aucun salarié spécifique", filtre email (14 tests) |
| `buildPierreHrWorkflowTasks` | types canoniques uniquement, sensitive_case awaiting_approval, contract/payroll awaiting_approval, reminder.create bloqué si required, employee enrichment (10 tests) |
| `mapPierreWorkflowTaskToDbTask` | execute_at présent, pas scheduled_for, statut préservé, ISO préservé (6 tests) |
| `buildPierreHrWorkflowPlan` | 11 inputs typiques, sensitive_case approval/blocked_actions/validation_policy, types canoniques, missing_info, next_action, execute_at/no scheduled_for, autonomy_level/employee_context options (27 tests) |
| `explainPierreWorkflowPlan` | non vide, mentionne tâches, blocked actions, missing info (4 tests) |

`package.json` mis à jour : `hr-workflows.test.ts` ajouté au script `npm test`.

---

### Script terminal E2E

**`scripts/pierre-workflow-engine-test.ps1`** — 15 étapes.

| Étape | Domaine testé | Vérifications |
|---|---|---|
| 1 | `general_hr` | `workflow_plan` présent, log `workflow_analyzed` |
| 2 | `onboarding` | domaine détecté |
| 3 | `hiring` | domaine détecté, ≥ 2 tâches |
| 4 | `absence` | domaine détecté, log `missing_info_detected` si infos manquantes |
| 5 | `payroll_prep` | `approval_required=true`, log `human_validation_required` |
| 6 | `sensitive_case` | `approval_required=true`, `blocked_actions ≥ 3`, `validation_policy.blocked=true`, log `sensitive_case_detected`, toutes tâches `awaiting_approval` |
| 7 | `contract` | `approval_required=true`, `blocked_actions` présents |
| 8 | `offboarding` | domaine détecté |
| 9 | `interview` | domaine détecté |
| 10 | Exécution réelle | Run d'une tâche `ready` depuis mission 1, vérification `ok=true` et `outcome` |
| 11 | Compat front | Champ `interpretation` présent, `summary` non vide |
| 12 | Schema logs | `event_type` présent sur tous les logs, pas de colonnes legacy |
| 13 | Colonnes DB | Aucune tâche avec `scheduled_for` (colonne invalide) |
| 14 | `training` | domaine détecté |
| 15 | `employee_file` | domaine détecté |

Compatible PowerShell 5 (no `??`, `?.`, `&&`). Aucun secret en dur.

---

### Invariants respectés

| Invariant | Mécanisme |
|---|---|
| Validation humaine jamais bypassée | `sensitive_case` → toutes tâches `awaiting_approval` ; `contract`/`payroll_prep` → tâche principale `awaiting_approval` |
| Aucune colonne DB inventée | `execute_at` (réel) — jamais `scheduled_for` ; `event_type`/`meta_json` — jamais `level`/`event`/`payload` |
| Types de tâches canoniques uniquement | Le moteur ne produit que : `doc.generate`, `email.draft`, `followup.schedule`, `reminder.create` |
| Multi-tenant | `user_id + agent_slug = "pierre"` systématique |
| Blocs 5–8 non cassés | Aucune modification des routes `employees`, `employee/[id]`, `task/[id]/run`, `doc/generate`, `email/draft` |
| Fonctions pures testables | `workflows.ts` : zéro DB, zéro async, 92 tests unitaires |
| Aucun email réel envoyé | Les tâches `email.draft` créent un brouillon en DB — aucun dispatch SMTP |

---

## 15. Bloc 10 — Pierre Continuity Engine V1 (2026-05-14)

### Objectif

Pierre n'est pas un chatbot — c'est un poste RH opérationnel. Une mission créée doit continuer à avancer même quand l'utilisateur ne revient pas. Le Bloc 10 ajoute le moteur de continuité : classification d'état, tableau de bord, plan d'action, et exécution automatique des tâches sûres.

### Fichier central : `src/lib/pierre/hr/continuity.ts`

Couche pure (zéro DB, zéro async). Prend des lignes DB brutes (`Record<string, unknown>`) et retourne des vues typées.

**Types exportés**

| Type | Rôle |
|---|---|
| `PierreMissionContinuityState` | État global d'une mission : `active \| stalled \| blocked \| awaiting_approval \| awaiting_info \| completed \| error \| cancelled` |
| `PierreTaskContinuityState` | État d'une tâche : `runnable \| awaiting_approval \| blocked \| scheduled \| done \| error \| not_ready` |
| `PierreTaskContinuitySlot` | Vue complète d'une tâche avec `is_safe_to_run`, `blocked_reason`, `execute_at` |
| `PierreContinuityNextAction` | Prochaine action recommandée avec `type`, `label`, `task_ids` |
| `PierreMissionContinuityInsight` | Insight complet d'une mission : compteurs, progress_pct, health_score, is_stalled |
| `PierreContinuePlan` | Plan d'action : `safe_to_run[]`, `requires_human[]`, `blocked[]`, `summary` |
| `PierreContinuityDashboard` | Vue agrégée multi-missions |

**Fonctions exportées (12)**

| Fonction | Description |
|---|---|
| `classifyTaskContinuityState(task, now?)` | Classe une tâche DB en état continuity |
| `isTaskSafeToRun(task, now?)` | Vrai si exécution automatique possible (status ready\|retry, pas approval, pas email.send, execute_at passé) |
| `buildTaskContinuitySlot(task, now?)` | Construit un `PierreTaskContinuitySlot` complet |
| `computeMissionProgress(slots)` | Progression en % (0–100) selon tâches terminées |
| `detectStalledMission(mission, slots, now?)` | Détecte si une mission est bloquée sans activité depuis > 3 jours |
| `classifyMissionContinuityState(mission, slots, now?)` | État global de mission (priorité : cancelled > completed > error > blocked > awaiting_approval > awaiting_info > stalled > active) |
| `buildContinuityRecommendedNextAction(slots)` | Prochaine action (priorité : run_tasks > approve_tasks > investigate_errors > provide_info > mission_complete > no_action) |
| `scoreMissionContinuityHealth(insight)` | Score 0–100 (–15 par erreur, –10 par blocked, –5 par approbation, –20 si stalled) |
| `buildMissionContinuityInsight(mission, tasks, options?)` | Insight complet d'une mission |
| `buildContinuePlan(mission, tasks, options?)` | Plan d'action ordonné |
| `selectNextRunnableTasks(tasks, options?)` | Sélectionne les N prochaines tâches sûres (tri priority desc, created_at asc) |
| `buildContinuityDashboard(userId, missions, tasksByMissionId, options?)` | Dashboard multi-missions agrégé |

**Règles de sécurité `isTaskSafeToRun`**

- `status` doit être `ready` ou `retry`
- `approval_required` doit être `false`
- `type` ne doit PAS être `email.send` ou `send_email` (envoi manuel requis)
- `execute_at` doit être `null` ou dans le passé

### Nouvelles routes API

| Route | Méthode | Description |
|---|---|---|
| `/api/pierre/use/continuity` | GET | Dashboard continuité multi-missions (50 missions max, tasks groupées) |
| `/api/pierre/use/mission/[missionId]/continue` | POST | Plan de continuation pour une mission spécifique |
| `/api/pierre/use/continuity/run-next` | POST | Lance les prochaines tâches sûres (max 5 par défaut, 10 max absolu) |

**`/continuity` GET** : charge toutes les missions non-annulées + leurs tâches en 2 requêtes (missions puis tasks IN missionIds), groupe par mission_id, appelle `buildContinuityDashboard()`.

**`/mission/[missionId]/continue` POST** : charge mission + tasks, retourne `{ insight, plan }`. Pas d'exécution automatique — consultation uniquement.

**`/continuity/run-next` POST** : charge les tâches `ready|retry` (filtre DB), applique `selectNextRunnableTasks()`, appelle `executePierreTaskWithPersistence({ supabaseAdmin, taskId, userId })` pour chaque. Corps optionnel : `{ mission_id?, max? }`.

### Modification : `mission/[missionId]/route.ts`

Ajout de `continuity: { mission_insight, continue_plan }` à la réponse GET sans modifier la structure existante (`tasks`, `logs`, `documents`, `outbound_emails`, `pdfs`, `meta` inchangés).

### Tests : `src/lib/pierre/__tests__/hr-continuity.test.ts`

107 tests unitaires couvrant les 12 fonctions exportées :

| Suite | Tests |
|---|---|
| `classifyTaskContinuityState` | 15 — tous statuts DB, approval_required, execute_at futur/passé |
| `isTaskSafeToRun` | 11 — combinaisons status/type/approval/execute_at |
| `buildTaskContinuitySlot` | 8 — blocked_reason, email.send, titre manquant |
| `computeMissionProgress` | 5 — 0%, 50%, 100%, arrondi |
| `detectStalledMission` | 7 — runnable, cancelled, vieux, récent, awaiting_approval ancien |
| `classifyMissionContinuityState` | 11 — tous les états possibles |
| `buildContinuityRecommendedNextAction` | 7 — priorité des 6 types d'action |
| `scoreMissionContinuityHealth` | 7 — progress=100, total=0, erreurs, stalled, bornes 0/100 |
| `buildMissionContinuityInsight` | 8 — compteurs, safe_task_ids, missing_info, health_score |
| `buildContinuePlan` | 8 — run/approve/provide_info/investigate, email.send, summary |
| `selectNextRunnableTasks` | 6 — filtrage, tri priority, limite max, execute_at futur |
| `buildContinuityDashboard` | 6 — structure, compteurs, aggregation, recommended_next_action |

Total tests : 472 (380 Blocs 1–9 + 92 Bloc 9 + 107 nouveau — vitest run).

### Script E2E : `scripts/pierre-continuity-engine-test.ps1`

14 étapes compatibles PowerShell 5 :

| Étape | Test |
|---|---|
| 1 | GET /continuity sans token → 401 |
| 2 | GET /continuity avec auth → dashboard valide |
| 3 | Structure dashboard : champs obligatoires, types corrects |
| 4 | POST /submit → mission onboarding créée |
| 5 | GET /mission/{id} → champ `continuity` présent sans casser l'ancien shape |
| 6 | Validation structure `mission_insight` (mission_id, state, progress_pct, health_score) |
| 7 | POST /mission/{id}/continue → insight + plan + summary |
| 8 | POST /continuity/run-next (mission_id) → ran + errors + meta |
| 9 | POST /continuity/run-next (global) → ok=true |
| 10 | POST /continuity/run-next sans token → 401 |
| 11 | Dashboard mis à jour après exécutions |
| 12 | Invariant : email.send jamais exécuté automatiquement |
| 13 | POST /mission/fake-id/continue → 404 |
| 14 | Logs utilisent `event_type` (nouveau schéma, pas `level`) |

### Invariants respectés

| Invariant | Mécanisme |
|---|---|
| `email.send` jamais auto-exécuté | `isTaskSafeToRun` : `SEND_TASK_TYPES = {email.send, send_email}` → retourne false |
| `approval_required=true` jamais auto-exécuté | `isTaskSafeToRun` vérifie `approval_required` |
| `execute_at` futur respecté | `isTaskSafeToRun` bloque si `execute_at > now` |
| Aucune migration DB | Toutes les colonnes nécessaires existent (`execute_at`, `status`, `approval_required`) |
| Blocs 5–9 non cassés | Aucune modification de `approve/cancel/reschedule/run/process-task` |
| Schéma log respecté | Routes continuity n'émettent pas de logs (execute-task.ts le fait avec `event_type+meta_json`) |
| Max exécutions limitées | `run-next` : 5 par défaut, 10 max absolu — pas de boucles infinies |

---

## Bloc 10.5 — Pierre Continuity Engine Hardening Premium

Date : 2026-05-14

### Objectif

Transformer la couche de continuité basique (Bloc 10) en un véritable moteur de pilotage RH opérationnel. Le moteur produit désormais des vues sectionnées, des digests narratifs en français, des résumés de logs/documents, des tâches de suivi automatiques et une traçabilité complète des exécutions run-next.

### Nouveaux types (continuity.ts)

| Type | Description |
|---|---|
| `PierreTaskTimeState` | `due_now \| overdue \| scheduled_future \| no_schedule` — état temporel d'une tâche par rapport à `execute_at` |
| `PierreContinuitySectionKey` | 8 clés opérationnelles : `due_now, overdue, scheduled, awaiting_approval, blocked, failed, completed_recently, safe_to_run` |
| `PierreContinuitySection` | `{ key, label, task_ids[], count }` — une section opérationnelle |
| `PierreContinuityDigest` | `{ text: string; tone: "action" \| "waiting" \| "blocked" \| "complete" \| "neutral" }` — digest narratif français |
| `PierreContinuityLogSummary` | `{ total, last_event_type, last_message, last_at }` — résumé compact des logs |
| `PierreContinuityDocumentSummary` | `{ total, last_title, last_type, last_at }` — résumé compact des documents |

### Nouvelles fonctions (continuity.ts)

| Fonction | Signature | Description |
|---|---|---|
| `classifyTaskTimeState` | `(task, now?) → PierreTaskTimeState` | Classifie l'état temporel d'une tâche |
| `isTaskCompletedRecently` | `(task, now?, windowMs?) → boolean` | Détecte si une tâche est terminée dans la fenêtre (défaut 24h) |
| `buildMissionSections` | `(slots, now?) → PierreContinuitySection[]` | Groupe les slots en 8 sections opérationnelles |
| `summarizeMissionLogs` | `(logs) → PierreContinuityLogSummary` | Résume une liste de logs (schéma `event_type+message`) |
| `summarizeMissionDocuments` | `(documents) → PierreContinuityDocumentSummary` | Résume une liste de documents |
| `buildMissionContinuityDigest` | `(insight, sections) → PierreContinuityDigest` | Génère le digest narratif français |
| `buildDashboardSections` | `(missions, tasksByMissionId, now?) → PierreContinuitySection[]` | Sections agrégées multi-missions |
| `buildFollowupTaskDraftsForContinue` | `(missionId, plan) → Record<string, unknown>[]` | Génère des tâches de suivi (`reminder.create`, `followup.schedule`) |

### Enrichissements types existants

- `PierreTaskContinuitySlot` : champ `updated_at?: string | null` (optionnel, pour `completed_recently`)
- `PierreMissionContinuityInsight` : champs optionnels `sections?, digest?, log_summary?, document_summary?`
- `PierreContinuityDashboardMissionEntry` : champs optionnels `digest?, log_summary?, document_summary?`
- `PierreContinuityDashboard` : champ optionnel `sections?`

### Enrichissements routes

#### GET /api/pierre/use/continuity

Nouveaux fetch parallèles : `pierre_task_logs` (200 derniers) + `pierre_documents` (100 derniers).

Réponse enrichie :
```json
{
  "ok": true,
  "dashboard": { "...existing...", "sections": [...8 sections...] },
  "sections": [...8 sections globales...],
  "digest": "N tâches exécutables. M tâches en retard...",
  "meta": { "...existing...", "logs_loaded": N, "documents_loaded": M }
}
```

#### POST /api/pierre/use/mission/[id]/continue

Nouveaux fetch : `pierre_task_logs` + `pierre_documents` pour la mission.

Log émis : `mission_continue_plan_generated` (try/catch non-bloquant).

Option `create_followups: true` dans le body : crée des tâches `reminder.create` / `followup.schedule` via `buildFollowupTaskDraftsForContinue`, émet log `continuity_followups_created`.

Réponse enrichie :
```json
{
  "ok": true,
  "insight": { "...enriched...", "sections": [...], "digest": {...}, "log_summary": {...}, "document_summary": {...} },
  "plan": { "...existing..." },
  "followups_created": 0,
  "meta": { "...existing...", "logs_count": N, "documents_count": M }
}
```

#### POST /api/pierre/use/continuity/run-next

`skipped` n'est plus `[]` — chaque entrée a `{ task_id, reason }` avec raison explicite :
- `"Envoi d'email — déclenchement manuel requis"`
- `"Approbation humaine requise"`
- `"Planifiée pour une date future — exécution différée"`
- `"Limite de tâches atteinte pour cette exécution"`

Logs émis si `mission_id` fourni : `continuity_run_next_started` + `continuity_run_next_completed` (try/catch non-bloquants).

`meta` enrichi : `skipped_count`.

#### GET /api/pierre/use/mission/[id]

`continuity` enrichi :
```json
{
  "mission_insight": { "...enriched with sections, digest, log_summary, document_summary..." },
  "continue_plan": { "..." },
  "sections": [...8 sections...],
  "digest": { "text": "...", "tone": "action" },
  "log_summary": { "total": N, "last_event_type": "...", "last_message": "...", "last_at": "..." },
  "document_summary": { "total": M, "last_title": "...", "last_type": "...", "last_at": "..." }
}
```

### Tests

| Fichier | Tests avant | Tests après | Delta |
|---|---|---|---|
| `hr-continuity.test.ts` | 99 | 170 | +71 |
| Autres fichiers | 380 | 380 | 0 |
| **Total** | **479** | **550** | **+71** |

Fonctions testées (Bloc 10.5) : `classifyTaskTimeState`, `isTaskCompletedRecently`, `buildMissionSections`, `summarizeMissionLogs`, `summarizeMissionDocuments`, `buildMissionContinuityDigest`, `buildDashboardSections`, `buildFollowupTaskDraftsForContinue`, enrichissements `buildMissionContinuityInsight`.

### Script E2E Hardening

`scripts/pierre-continuity-hardening-test.ps1` — 16 étapes PS5 :

| Étape | Test |
|---|---|
| 1 | GET /continuity sans token → 401 |
| 2 | GET /continuity → sections + digest présents (v10.5) |
| 3 | sections a exactement 8 entrées avec les bonnes clés |
| 4 | POST /submit → mission onboarding créée |
| 5 | GET /mission/{id} → continuity.sections + continuity.digest présents |
| 6 | mission_insight.sections (8 entrées) + digest.text + digest.tone |
| 7 | continuity.log_summary + document_summary présents |
| 8 | POST /continue → insight.sections + digest + followups_created |
| 9 | POST /continue avec create_followups=true → followups_created >= 0 |
| 10 | POST /run-next → skipped enrichi avec task_id + reason |
| 11 | POST /run-next global → ok=true + skipped présent |
| 12 | Invariant : email.send jamais exécuté automatiquement |
| 13 | POST /mission/fake-id/continue → 404 |
| 14 | POST /run-next sans token → 401 |
| 15 | GET /continuity → meta.logs_loaded + documents_loaded présents |
| 16 | Logs utilisent event_type (nouveau schéma, pas level) |

### Invariants Bloc 10.5

| Invariant | Mécanisme |
|---|---|
| `email.send` et `send_email` jamais dans followups auto | `buildFollowupTaskDraftsForContinue` n'émet que `reminder.create` et `followup.schedule` |
| `approval_required=false` sur tous les followups | Hard-codé dans les drafts |
| Logs non-bloquants | Tous les `tryInsertLog` sont wrappés en try/catch |
| Sections toujours 8 entrées | `buildMissionSections` et `buildDashboardSections` retournent toutes les 8 clés |
| Digest a toujours `text` et `tone` | `buildMissionContinuityDigest` retourne les deux champs |
| Skipped enrichi avec reason | `classifySkipReason` classe chaque candidat non-sélectionné |
| Blocs 5–10 non cassés | Aucune modification de `approve/cancel/reschedule/run/process-task/continuity v1` |
| Backward compat réponse API | Champ `interpretation` conservé avec les mêmes clés ; `tasks` toujours présent en top-level |

---

## Bloc 11 — Employee File 360 / Dossier Salarié Opérationnel

Date : 2026-05-17

### Objectif

Construire un **dossier salarié 360 opérationnel** enrichissant chaque mission, tâche et artifact avec le contexte du salarié concerné. Ce n'est pas une vue UI — c'est une couche de données qui permet à Pierre de raisonner sur l'état du dossier d'un salarié à chaque étape de traitement.

### Fichier principal

**`src/lib/pierre/hr/employee-file.ts`** — module pur (pas de Supabase, pas de Next, pas d'async).

Exporte :
- **Types** : `PierreEmployeeFile360`, `PierreEmployeeFileSnapshot`, `PierreEmployeeFileIndex`, `PierreEmployeeFileProfile`, `PierreEmployeeIdentity`, et 10+ autres types
- **Fonctions de profil** : `normalizeEmployeeFileProfile`, `resolveEmployeeIdentity`
- **Matching** : `doesRowBelongToEmployee` — match fort (employee_id, email) + match moyen (nom complet, anti faux-positifs)
- **Filtrage** : `filterEmployeeMissions`, `filterEmployeeTasks`, `filterEmployeeDocuments`, `filterEmployeeLogs`
- **Analyse** : `classifyEmployeeFileRisk` (14 signaux, niveaux black/red/orange), `detectEmployeeMissingInfo`
- **Construction** : `buildEmployeeTimeline`, `buildEmployeeFileSections`, `scoreEmployeeFileHealth`, `buildEmployeeNextActions`, `buildEmployeeFileDigest`
- **Orchestration** : `buildEmployeeFile360`, `buildEmployeeFileSnapshot`, `buildEmployeeFileIndex`

#### Invariant : ID déterministe

`normalizeEmployeeFileProfile` génère un `employee_id` de fallback basé sur `simpleHash(nom + email)` — pas de `Date.now()`. Même entrée → même ID à travers les invocations.

#### Signaux de risque (RISK_SIGNAL_DEFS)

| Niveau | Exemples de codes |
|--------|------------------|
| black | `harcelement`, `discrimination`, `agression`, `prudhommes`, `faute_grave` |
| red | `licenciement`, `rupture_conventionnelle`, `inaptitude`, `tache_bloquee`, `tache_error` |
| orange | `offboarding_en_cours`, `onboarding_incomplet`, `info_manquante` |

### Nouvelles routes

| Route | Description |
|-------|-------------|
| `GET /api/pierre/use/employee/[employeeId]/file` | Dossier 360 complet d'un salarié |
| `GET /api/pierre/use/employees/files` | Index global de tous les dossiers |

### Routes enrichies

| Route | Ajout Bloc 11 |
|-------|---------------|
| `GET /api/pierre/use/employee/[employeeId]` | `file_snapshot`, `file_digest`, `file_health`, `file_risk_level`, `file_endpoint` |
| `GET /api/pierre/use/mission/[missionId]` | `employee_file: { available, employee_id, employee_name, snapshot }` |
| `POST /api/pierre/use/submit` | Snapshot injecté dans `brain_output_json` + `context_snapshot_json` de la mission, et dans `payload_json` de chaque tâche |

### Enrichissement artifacts / execute-task

- **`artifacts.ts`** : `collectEmployeeFileTags(payload)` injecte `employee_file`, `employee:<id>`, `risk:<level>` dans les tags des artifacts document, email et followup quand `payload_json.employee_file_snapshot` est présent
- **`execute-task.ts`** : `resultJson` inclut `employee_id`, `employee_name`, `employee_file_health_score`, `employee_file_risk_level` issus du snapshot stocké dans `payload_json`

### Tests

**`src/lib/pierre/__tests__/hr-employee-file.test.ts`** — 120+ tests couvrant :
- normalizeEmployeeFileProfile (valid, deterministic ID, robustness)
- resolveEmployeeIdentity
- doesRowBelongToEmployee (direct, nested, email, name, anti false-positive)
- filterEmployee* (missions/tasks/documents/logs)
- classifyEmployeeFileRisk (black/red/orange/green, deduplication)
- detectEmployeeMissingInfo (email, role, department, start_date)
- buildEmployeeTimeline (sort desc, event types, null dates)
- buildEmployeeFileSections (9 sections, counts)
- scoreEmployeeFileHealth (penalties black/red/missing, score bounds)
- buildEmployeeNextActions (no_action, urgent, blocked, approval)
- buildEmployeeFileDigest (tones: complete/sensitive/blocked/waiting/action)
- buildEmployeeFile360 (full object, filtering, status, sections)
- buildEmployeeFileSnapshot (compact, open_tasks_count, pending_approval_count)
- buildEmployeeFileIndex (files, totals, attention_required/sensitive/incomplete)

---

## Bloc 13.1 — Mission Control Alignment & Completion

**Date** : 2026-05-17  
**Statut** : Production-ready (scale non load-testé)

### Objectif

Aligner le nom produit sur **Mission Control** (nom canonique), créer les routes canoniques `/api/pierre/use/mission-control/*`, enrichir toutes les routes existantes avec un bloc `mission_control`, préparer l'architecture cible 100 000+ entreprises.

### Routes canoniques ajoutées

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/pierre/use/mission-control` | GET | Dashboard Mission Control complet |
| `/api/pierre/use/mission-control/run-plan` | GET | Plan d'exécution sûre (dry_run par défaut) |
| `/api/pierre/use/mission-control/run-safe` | POST | Exécution sûre avec double vérification de sécurité |
| `/api/pierre/use/mission-control/briefing` | POST | Briefing Mission Control (instant/daily/weekly) |

Les routes `/dashboard/*` restent actives comme **alias de compatibilité** et redirigent vers les canoniques via `meta.canonical_route` et `meta.compatibility_route`.

### Nouveaux types (mission-control.ts)

| Type | Description |
|------|-------------|
| `PierreMissionControlScaleProfile` | Profil de capacité : cible 100 000+ clients, non load-testé |
| `PierreMissionControlDataWindow` | Fenêtres de données : missions:300, tasks:500, docs:300, logs:500, safe_limit:10 |
| `PierreMissionControlBriefing` | Briefing complet avec decisions_required, safe_actions, sensitive_cases, scale_profile |

### Nouvelles fonctions (mission-control.ts)

| Fonction | Description |
|----------|-------------|
| `buildMissionControlScaleProfile()` | Retourne le profil scale avec `validation_status: "not_load_tested"` |
| `buildMissionControlDataWindow(overrides?)` | Fenêtres de données par défaut, surchargeables |
| `buildMissionControlBriefing({dashboard, period, now})` | Construit un briefing MC depuis un dashboard complet |
| `buildMissionControlPreview(dashboard)` | Vue résumée : status, headline, digest, top_actions (5), counts |

### Routes enrichies (Bloc 13.1)

| Route | Enrichissement |
|-------|---------------|
| `GET /dashboard` | `meta.canonical_route`, `meta.compatibility_route`, cap maxSafeActions 10 |
| `GET /dashboard/run-plan` | `meta.canonical_route`, `meta.hard_max_tasks: 10` |
| `POST /dashboard/execute-safe` | `meta.canonical_route`, `meta.safety_gate`, `meta.hard_max_tasks` |
| `GET /messages` | `mission_control: { status, top_actions, counts }` |
| `GET /messages/[category]` | `mission_control: { status, top_actions, counts, category_relevance }` |
| `POST /messages/briefing` | `mission_control_briefing`, `mission_control_preview` |
| `GET /mission/[missionId]` | `mission_control: { card, actions, next_action, is_blocked, requires_human, is_sensitive }` |
| `GET /employee/[employeeId]/file` | `mission_control: { card, actions, next_action, requires_human, is_sensitive }` |
| `GET /continuity` | `mission_control: { summary, preview, scale_profile }` (compatible avec l'existant `mission_control_summary`) |

### Architecture Scale

```
target_active_clients: 100 000
validated_active_clients: null
validation_status: "not_load_tested"
```

**Architecture pensée pour 100 000+ entreprises actives.** Capacité non garantie sans load tests. Un Bloc Scale dédié est requis avant toute promesse technique ferme sur la montée en charge.

Fenêtres de données (DataWindow) :
- `missions_limit: 300`
- `tasks_limit: 500`
- `documents_limit: 300`
- `logs_limit: 500`
- `employees_limit: 500`
- `safe_execution_hard_limit: 10`

### Sécurité run-safe

Double vérification à l'exécution dans `/mission-control/run-safe` :
1. `buildMissionControlRunPlan` filtre les actions non sûres
2. `BLOCKED_TASK_TYPES.has(taskType)` — blocage absolu `email.send`, `send_email`
3. `isMissionControlSafeToRun` — re-vérification au moment de l'exécution

### Indexes SQL (Bloc 13.1)

Fichier : `supabase/sql/pierre_mission_control_indexes_v1.sql`

Indexes ajoutés :
- `pierre_tasks` : status+approval, priority desc, execute_at, error/blocked, approval pending
- `pierre_missions` : risk_level, understanding_status, active missions
- `pierre_task_logs` : event_type + created_at, mission grouping

---

## Bloc 14 — CloneGuard Runtime Governance

### Vue d'ensemble

CloneGuard est le moteur de gouvernance runtime de Pierre. Il évalue chaque action RH avant toute exécution automatique et catégorise le risque en 5 décisions : `allow`, `allow_with_warning`, `require_approval`, `block`, `refuse`.

**Contrainte absolue** : aucune action sensible ne peut franchir la porte d'exécution automatique sans validation humaine.

### Module pur (src/lib/pierre/hr/cloneguard.ts)

Module 100% pur — zero Supabase, zero Next.js, zero effets de bord, zero async.

**Types exportés** :
- `PierreCloneGuardContext` — contexte d'une action : task_type, task_title, task_description, payload_json, approval_required, domain, risk_level_hint, text_corpus, now
- `PierreCloneGuardEvaluation` — résultat complet : decision, risk_level, signals, matched_rules, allowed_to_auto_execute, requires_human, explanation, human_note, evaluated_at
- `PierreCloneGuardPreview` — résumé léger : decision, risk_level, signal_count, top_signal, allowed_to_auto_execute, summary
- `PierreCloneGuardAuditEvent` — événement d'audit : event_type + message + meta_json (jamais level/event/payload)

**Fonctions exportées** :

| Fonction | Rôle |
|---|---|
| `evaluatePierreCloneGuard(ctx)` | Évaluation complète — 24 règles |
| `isCloneGuardAutoExecutable(ctx)` | Fast path — retourne false immédiatement pour types bloqués |
| `applyCloneGuardToTask(task, eval)` | Enrichit une tâche sans la muter |
| `buildCloneGuardAuditEvent(eval, ctx?)` | Construit l'événement d'audit |
| `buildCloneGuardPreview(eval)` | Construit le preview léger |
| `summarizeCloneGuardEvaluation(eval)` | Résumé textuel lisible |
| `collectCloneGuardText(ctx)` | Collecte + normalise (NFD + diacritics) tous les textes |
| `detectCloneGuardSignals(ctx, text?)` | Détecte les signaux de risque |

### Hiérarchie des décisions

```
allow(0) < allow_with_warning(1) < require_approval(2) < block(3) < refuse(4)
```

La fonction `worstDecision` garantit l'escalade : plusieurs règles qui matchent n'améliorent jamais la décision.

### 24 règles de politique (getPierreCloneGuardPolicyRules)

**REFUSE (noir — non négociable)** :
1. `harcelement_refuse` — harcèlement dans le texte
2. `discrimination_refuse` — discrimination dans le texte
3. `violence_refuse` — violence/agression dans le texte
4. `prudhommes_refuse` — prud'hommes/contentieux dans le texte
5. `faute_grave_refuse` — faute grave/lourde dans le texte
6. `dismissal_action_refuse` — type `decision_licenciement` / `decision_discriminatoire` / juridique sensible
7. `disciplinary_decision_refuse` — type `decision_sanction` / `resolution_conflit_humain`

**BLOCK (exécution manuelle possible)** :
8. `email_send_block` — type `email.send` ou `send_email` — jamais auto-exécuté
9. `approval_required_block` — `approval_required=true`
10. `judiciaire_block` — "judiciaire" dans le texte

**REQUIRE_APPROVAL (rouge)** :
11. `contract_action_require` — type `contrat`, `avenant`, `document_contractuel`
12. `disciplinary_prep_require` — type `courrier_disciplinaire_prep`, `conflit_prelim`
13. `absence_action_require` — type `absence_sensible`, `sujet_medical`, `offboarding_sensible`
14. `payroll_action_require` — type `prepaie_prep`, `remuneration`
15. `licenciement_text_require` — "licenci" dans le texte (hors dismissal_action)
16. `rupture_conventionnelle_require` — "rupture_conv" dans le texte
17. `offboarding_text_require` — "offboarding" dans le texte (hors dismissal_action)
18. `risk_hint_red_require` — risk_level_hint red ou black

**ALLOW_WITH_WARNING (orange)** :
19. `email_draft_warn` — type `email.draft`
20. `doc_generate_warn` — type `doc.generate`
21. `validation_recommended_warn` — types recommandant relecture
22. `sensitive_domain_warn` — domain `sensitive_case`
23. `disciplinaire_text_warn` — "disciplin" dans texte (hors décision/prep identifié)
24. `risk_hint_orange_warn` — risk_level_hint orange

### allowed_to_auto_execute

`false` si **l'une** des conditions suivantes est vraie :
- `decision !== "allow"`
- `task_type` est `email.send` ou `send_email`
- `approval_required === true`
- `risk_level` ≥ red

### Normalisation de texte

`collectCloneGuardText` applique NFD decomposition + suppression des diacritiques avant la détection de signaux. Ainsi "harcèlement" match le pattern `/harcel/`.

### Signaux textuels (TEXT_SIGNAL_DEFS)

| Pattern | Signal | Niveau |
|---|---|---|
| `harcel` | Harcèlement signalé | black |
| `discrimin` | Discrimination signalée | black |
| `agress\|violen` | Violence / Agression | black |
| `prudhomm\|prud.?homm` | Prud'hommes | black |
| `faute.?grave\|faute.?lourde` | Faute grave | black |
| `licenci` | Licenciement | red |
| `rupture.?conv` | Rupture conventionnelle | red |
| `disciplin` | Disciplinaire | red |
| `judiciaire` | Judiciaire | red |
| `offboarding` | Offboarding sensible | red |
| `critiqu` | Situation critique | red |

### Routes API (Bloc 14)

| Route | Méthode | Rôle |
|---|---|---|
| `/api/pierre/use/cloneguard/evaluate` | POST | Évaluation complète + audit log |
| `/api/pierre/use/cloneguard/preview` | POST | Preview léger — pas d'audit |

Les deux routes partagent `buildContextFromBody` qui mappe `{ action_kind, domain, input, mission, task, employee_file }` vers `PierreCloneGuardContext`.

### Intégration dans les routes existantes

CloneGuard est intégré dans :
- **`/api/pierre/use/submit`** — évaluation sur le plan généré (domain, risk_level, approval_required)
- **`execute-task.ts`** — porte d'exécution : refuse + block stoppent la tâche avec audit
- **`/mission-control/run-safe`** — pre-flight `isCloneGuardAutoExecutable` sur chaque action
- **`/mission-control/run-plan`** — annotation CloneGuard sur chaque action (`cgAnnotatedActions`)
- **`/mission-control`** — `cloneguard.safe_actions_evaluated / blocked_in_safe`
- **`/mission-control/briefing`** — `cloneguard.blocked_in_safe`
- **`/continuity/run-next`** — porte CloneGuard dans la boucle + log `cloneguard_continuity_blocked`
- **`/mission/[missionId]/continue`** — enrichissement de `safe_to_run` + log `cloneguard_continue_evaluated`
- **`/mission/[missionId]`** — champ `cloneguard` dans la réponse mission
- **`/employee/[employeeId]/file`** — `cloneguard_summary` sur les actions employé

### Schéma d'audit (nouveau schéma Bloc 14)

Tous les événements CloneGuard utilisent **exclusivement** :
```
event_type: "cloneguard_evaluation" | "cloneguard_execution_blocked" | "cloneguard_signal_detected"
           | "cloneguard_manual_evaluation" | "cloneguard_continuity_blocked"
           | "cloneguard_continue_evaluated"
message: string (explication humaine)
meta_json: { decision, risk_level, signal_count, signals, matched_rules, allowed_to_auto_execute, task_type?, domain? }
```

**Jamais** `level`, `event`, ni `payload` dans les logs CloneGuard.

### Indexes SQL (Bloc 14)

Fichier : `supabase/sql/pierre_cloneguard_indexes_v1.sql`

9 indexes (IF NOT EXISTS — idempotent) :
- `pierre_tasks` : approval_status, type_status, execute_at (partial), ready_retry (partial), payload_json GIN
- `pierre_missions` : approval_risk, active_risk (partial), context_snapshot_json GIN
- `pierre_task_logs` : event_type+created, cloneguard_events (partial sur les 6 event_types CloneGuard), meta_json GIN

### Tests (Bloc 14)

| Fichier | Tests | Couverture |
|---|---|---|
| `src/lib/pierre/__tests__/hr-cloneguard.test.ts` | 145 | 16 describe groups — toutes les fonctions exportées |
| `src/lib/pierre/__tests__/hr-cloneguard-runtime.test.ts` | 81 | Pipeline runtime — context → evaluation → preview → audit |

**Script E2E** : `scripts/pierre-cloneguard-runtime-test.ps1` — 47 steps, PS5 compatible.

### Contraintes absolues

1. Jamais `scheduled_for` — la colonne DB est `execute_at`
2. Jamais `level/event/payload` dans pierre_task_logs — schéma : `event_type + message + meta_json`
3. Jamais auto-exécuter : `email.send`, `send_email`, `approval_required=true`, CloneGuard red/black sans validation humaine, actions légales/disciplinaires/sensibles
4. Le module pur `cloneguard.ts` n'a aucune dépendance Supabase/Next/async
5. CloneGuard explique toujours pourquoi : authorize, require_validation, block, ou refuse
6. `applyCloneGuardToTask` ne mute jamais l'objet d'origine
- `pierre_documents` : status+doc_type, mission grouping
- `pierre_company_memory` : updated_at desc (employee snapshot fetch)

### Tests

**`src/lib/pierre/__tests__/hr-mission-control.test.ts`** — **198 tests** couvrant :
- Groupes 1-19 (Bloc 13) : isMissionControlSafeToRun, isMissionControlSensitive, isMissionControlBlocking, inferMissionControlActionType, classifyMissionControlQueue, buildMissionControlAction*(Task/Mission/Document/EmployeeSnapshot/FeedItem), buildMissionControlMissionCard, buildMissionControlEmployeeCard, buildMissionControlMetrics, buildMissionControlQueues, sortMissionControlActions, buildMissionControlDigest, buildMissionControlExecutiveBriefing, buildMissionControlRunPlan, buildMissionControlDashboard
- Groupe 20 : **buildMissionControlScaleProfile** (6 tests)
- Groupe 21 : **buildMissionControlDataWindow** (5 tests)
- Groupe 22 : **buildMissionControlBriefing** (12 tests)
- Groupe 23 : **buildMissionControlPreview** (10 tests)
- Groupe 24 : **Security** — blocked types, approval gates, future execute_at, hard cap (8 tests)
- Groupe 25 : **Robustness** — null/malformed inputs (12 tests)
- Groupe 26 : **Scale architecture assertions** (7 tests)

### Script E2E

**`scripts/pierre-mission-control-test.ps1`** — **60 étapes** PS5 compatible :
- Étapes 1-35 (Bloc 13) : routes /dashboard/*, /continuity
- Étapes 36-43 : routes canoniques /mission-control (GET)
- Étapes 44-46 : /mission-control/run-plan
- Étapes 47-49 : /mission-control/run-safe
- Étapes 50-53 : /mission-control/briefing
- Étapes 54-56 : vérification canonical_route sur routes /dashboard/*
- Étapes 57-59 : /continuity mission_control block
- Étape 60 : period=daily honored
- Pure module contract (synchronous, no async/Supabase/Next)

### Script E2E

**`scripts/pierre-employee-file360-test.ps1`** — 23 étapes PS5 (mis à jour Bloc 11.1), teste :
1. 401 sans token
2–4. GET /employees/files → index.files + index.totals
5–11. GET /employee/[id]/file → profile, sections, digest, timeline, missing_info, risks
12–13. POST /submit avec employee_id → GET mission → employee_file present
14. GET /employee/[id] → file_snapshot present
15. Logs schema : event_type + meta_json (pas level/event/payload)
16. Tasks : execute_at (pas scheduled_for comme colonne DB)
17. index.totals.employees === index.files.Count
18. Snapshot structure complète (tous champs requis)
19. file.health.score dans [0, 100]
20. file.next_actions présent
21. snapshot.health_score valide (range)
22. snapshot.risk_level valeur valide (green/orange/red/black)
23. Résumé PASS/FAIL

### Invariants conservés

| Invariant | Mécanisme Bloc 11 |
|-----------|-------------------|
| Colonne DB `execute_at` (pas `scheduled_for`) | Jamais utilisé dans les nouvelles routes ni dans employee-file.ts |
| Logs : `event_type` + `message` + `meta_json` | Aucune nouvelle écriture de log dans les routes Bloc 11 |
| `email.send` jamais auto-exécuté | Aucune logique d'exécution ajoutée |
| `approval_required=true` jamais auto-exécuté | Aucune modification des gates d'exécution |
| Blocs 1–10.5 non touchés | `approve/cancel/reschedule/process-task/continuity` non modifiés |
| Module pur sans Supabase/Next | `employee-file.ts` ne dépend d'aucun module DB ou HTTP |
| Salariés dans `pierre_company_memory.reusable_rh_context_json.employees` | Utilisé par toutes les nouvelles routes via `sanitizePierreEmployeeList` |

### Limites

- Pas d'UI pour le dossier salarié (hors scope Bloc 11)
- Pas de nouvelle table Supabase, pas de migration DB
- Le dossier 360 est construit en mémoire à partir des données existantes
- `buildEmployeeFile360` utilise le filtrage par identity pour limiter les données aux rows du salarié concerné — avec de très gros volumes (>10k tasks), un index jsonb serait préférable
- `normalizeEmployeeFileProfile` sans id/employee_id génère un ID basé sur nom+email — collision possible si deux salariés ont exactement le même nom et le même email

---

## Bloc 11.1 — Perfection Employee File 360 Premium (2026-05-17)

### Objectif

Solidifier le Bloc 11 avant de passer au Bloc 12 : robustesse totale, 141 tests, script E2E 23 étapes, module pur certifié sans aucun effet de bord non-déterministe.

### Hardening `employee-file.ts`

**Suppression de `crypto.randomUUID()`** — Les 4 fonctions internes de normalisation (`normalizeMission`, `normalizeTask`, `normalizeDocument`, `normalizeLog`) utilisaient `crypto.randomUUID()` comme fallback quand `row.id` est absent. Remplacé par des IDs déterministes basés sur `simpleHash` :

| Fonction | ID fallback |
|----------|-------------|
| `normalizeMission` | `m_${simpleHash(summary + intent + created_at)}` |
| `normalizeTask` | `t_${simpleHash(title + type + created_at)}` |
| `normalizeDocument` | `d_${simpleHash(title + doc_type + created_at)}` |
| `normalizeLog` | `l_${simpleHash(message + event_type + created_at)}` |

**Déduplication timeline** — `buildEmployeeTimeline` maintient un `Set<string>` des IDs d'événements (`source_type:source_id`). Si le même row apparaît deux fois dans le même tableau d'entrée, un seul événement est créé.

### Tests (+30 nouveaux → 141 total)

**`hr-employee-file.test.ts`** passe de 111 à 141 tests répartis en 6 nouveaux groupes :

| Groupe | Tests | Contenu |
|--------|-------|---------|
| `doesRowBelongToEmployee — context_snapshot_json and brain_output_json` | 5 | context_snapshot_json, brain_output_json nested employee_context, email nested, anti false-positive court nom, sans espace |
| `classifyEmployeeFileRisk — black: prudhommes and faute grave` | 2 | prud'hommes → black, faute grave → black |
| `classifyEmployeeFileRisk — red: rupture and offboarding profile` | 2 | rupture conventionnelle → red, statut profil offboarding → red |
| `classifyEmployeeFileRisk — orange: absence and awaiting_approval` | 2 | absence → orange, awaiting_approval → orange |
| `detectEmployeeMissingInfo — offboarding and absence` | 5 | end_date/offboarding, absence_details, contract_documents, guard contrat+docs, human_validation |
| `buildEmployeeTimeline — event type inference` | 5 | document_generated, email_prepared, task_blocked, invalid date, déduplication |
| `buildEmployeeFile360 — status cases` | 5 | sensitive/black, attention_required/red, incomplete/missing_required, digest sensitive, snapshot latest_event_at |
| `buildEmployeeFileIndex — category arrays` | 4 | attention_required peuplé, sensitive peuplé, incomplete peuplé, rows malformés ignorés |

### Script E2E (23 étapes)

**Ajout des étapes 19–22 :**
- Step 19 : `file.health.score` présent et dans `[0, 100]`
- Step 20 : `file.next_actions` présent
- Step 21 : `snapshot.health_score` dans `[0, 100]`
- Step 22 : `snapshot.risk_level` parmi `green/orange/red/black`

### Invariants confirmés Bloc 11.1

- Aucun `crypto.randomUUID()` dans le module pur — 0 effet de bord non-déterministe
- `simpleHash` : djb2, deterministe, stable entre appels
- Timeline : déduplication par `${sourceType}:${sourceId}`
- Toutes les routes : auth 401 + access 403 inchangés
- `execute_at` (pas `scheduled_for`) confirmé dans toutes les routes
- `event_type/message/meta_json` (pas `level/event/payload`) confirmé

### Résultats finaux

| Métrique | Bloc 11 | Bloc 11.1 |
|----------|---------|-----------|
| Tests hr-employee-file | 111 | **141** |
| Tests total | 661 | **691** |
| Fichiers test | 7 | 7 |
| tsc errors | 0 | **0** |
| Build | clean | **clean** |
| `crypto.randomUUID()` dans module pur | 4 appels | **0** |
| Steps E2E script | 19 | **23** |

---

## Bloc 12 — Pierre Operational Feed / Messages / Alertes / Briefings

**Objectif :** Fournir un feed opérationnel structuré (alertes, suivis, livraisons, briefings) exploitable directement par les intégrations externes ou futurs dashboards.

### Module pur `src/lib/pierre/hr/operational-feed.ts`

| Catégorie | Valeurs |
|-----------|---------|
| Categories | `alert`, `follow_up`, `delivery`, `briefing` |
| Severités | `critical`, `warning`, `success`, `info` |
| Priorités | `urgent`, `high`, `normal`, `low` |
| Sources | `mission`, `task`, `document`, `log`, `employee_file`, `continuity` |
| Périodes briefing | `instant`, `daily`, `weekly`, `monthly` |

**16 fonctions exportées :**

| Fonction | Rôle |
|----------|------|
| `normalizeFeedDate` | Normalise date depuis string/Date/timestamp → ISO string ou null |
| `buildDeterministicFeedId` | ID déterministe `feed_${hash}` sans crypto.randomUUID() |
| `inferFeedCategory` | Déduit la catégorie selon sourceType + contenu + keywords |
| `inferFeedSeverity` | Déduit la sévérité |
| `inferFeedPriority` | Déduit la priorité |
| `buildFeedItemFromMission` | Item feed depuis une row mission |
| `buildFeedItemFromTask` | Item feed depuis une row tâche |
| `buildFeedItemFromDocument` | Item feed depuis une row document (delivery+success) |
| `buildFeedItemFromLog` | Item feed depuis une row log (lit `event_type` — schéma correct) |
| `buildFeedItemFromEmployeeFileSnapshot` | Item feed depuis snapshot salarié |
| `dedupeFeedItems` | Déduplication par id — garde priorité la plus haute |
| `sortFeedItems` | Tri : priorité desc → sévérité desc → action_required → date desc → title |
| `buildFeedSummary` | Résumé agrégé (total + 4 catégories + 4 priorités + 4 sévérités + action_required) |
| `buildFeedSections` | Toujours 4 sections dans l'ordre : alert → follow_up → delivery → briefing |
| `buildOperationalBriefing` | Briefing narré avec stats, highlights, risks, next_actions |
| `buildPierreOperationalFeed` | Point d'entrée principal — assemble tout |

### Routes créées

| Route | Méthode | Rôle |
|-------|---------|------|
| `/api/pierre/use/messages` | GET | Feed complet (filtres: limit, priority, severity, action_required, include_raw) |
| `/api/pierre/use/messages/[category]` | GET | Feed filtré par categorie (400 + INVALID_MESSAGE_CATEGORY si invalide) |
| `/api/pierre/use/messages/briefing` | POST | Génère un briefing + log `operational_briefing_generated` (non-bloquant) |

### Routes enrichies

| Route | Ajout |
|-------|-------|
| `GET /api/pierre/use/continuity` | `operational_feed_summary` |
| `GET /api/pierre/use/mission/[missionId]` | `operational_messages: { items, summary }` |
| `GET /api/pierre/use/employee/[employeeId]/file` | `operational_messages: { items, summary }` |

### Tests `hr-operational-feed.test.ts` (138 tests)

| Groupe | Tests |
|--------|-------|
| `normalizeFeedDate` | 7 |
| `buildDeterministicFeedId` | 6 |
| `inferFeedCategory` | 12 |
| `inferFeedSeverity` | 9 |
| `inferFeedPriority` | 9 |
| `buildFeedItemFromMission` | 7 |
| `buildFeedItemFromTask` | 9 |
| `buildFeedItemFromDocument` | 6 |
| `buildFeedItemFromLog` | 7 |
| `buildFeedItemFromEmployeeFileSnapshot` | 9 |
| `dedupeFeedItems` | 6 |
| `sortFeedItems` | 7 |
| `buildFeedSummary` | 6 |
| `buildFeedSections` | 6 |
| `buildOperationalBriefing` | 9 |
| `buildPierreOperationalFeed` | 9 |
| `Robustness` | 8 |
| `Pure module contract` | 6 |

### Script E2E `pierre-operational-feed-test.ps1` (25 étapes PS5)

Étapes : GET /messages sans auth → 401, GET /messages avec auth → 200, feed/summary/sections présents, 4 catégories, GET /messages/alert|follow_up|delivery|briefing, catégorie invalide → 400, filtres limit/priority/action_required, POST /messages/briefing instant/daily/weekly/monthly, briefing.id commence par `brief_`, briefing.stats.total, meta.period, summary cohérence total=catégories, continuity inclut operational_feed_summary, mission soumiset détail avec operational_messages, items avec champs requis, PASS/FAIL.

### Résultats finaux Bloc 12

| Métrique | Bloc 11.1 | Bloc 12 |
|----------|-----------|---------|
| Tests hr-operational-feed | — | **138** |
| Tests total | 691 | **829** |
| Fichiers test | 7 | **8** |
| tsc errors | 0 | **0** |
| Build | clean | **clean** |
| Routes créées | — | **3** |
| Routes enrichies | — | **3** |

---

## Bloc 12.1 — Pierre Operational Feed Premium Hardening

**Objectif :** Enrichir le feed opérationnel avec des champs premium (intent, action_target, is_sensitive, is_blocking, is_delivery, is_briefing, display_context, action_kind), corriger le bug de classification briefing/delivery, et fournir un centre de commandement opérationnel structuré.

### Correction bug Bloc 12.1

Dans `inferFeedCategory`, la vérification `delivery` (basée sur `eventType.includes("generated")`) était évaluée **avant** la vérification `briefing`. `operational_briefing_generated` contient les deux mots — `briefing` et `generated` — ce qui le classifiait incorrectement en `delivery`.

**Fix :** L'ordre d'inférence est désormais : Alert → **Briefing** → Delivery → Follow_up.

```
// Avant (Bloc 12)
if (eventType.includes("generated")) return "delivery";
if (eventType.includes("briefing"))  return "briefing"; // jamais atteint pour operational_briefing_generated

// Après (Bloc 12.1)
if (eventType.includes("briefing"))  return "briefing"; // priorité correcte
if (eventType.includes("generated")) return "delivery";
```

### Nouveaux types exportés

| Type | Description |
|------|-------------|
| `PierreOperationalIntent` | 10 valeurs — intent opérationnel inféré de chaque item |
| `PierreOperationalFeedActionKind` | 10 valeurs — type d'action recommandée |
| `PierreOperationalFeedActionTarget` | Cible d'action avec href, method, ids |
| `PierrePremiumFeedSummary` | Résumé premium avec headline, status, compteurs |
| `PierreOperationalCommandCenter` | Centre de commandement avec listes catégorisées |

### Nouveaux champs `PierreOperationalFeedItem`

| Champ | Type | Description |
|-------|------|-------------|
| `intent` | `PierreOperationalIntent` | Intent opérationnel inféré |
| `action_kind` | `PierreOperationalFeedActionKind` | Type d'action recommandée |
| `action_target` | `PierreOperationalFeedActionTarget \| null` | Cible d'action cliquable |
| `display_context` | `string \| null` | Libellé contextuel affiché |
| `is_sensitive` | `boolean` | Item RH sensible |
| `is_blocking` | `boolean` | Item bloquant une progression |
| `is_delivery` | `boolean` | Item livraison d'artefact |
| `is_briefing` | `boolean` | Item briefing périodique |

### Nouvelles fonctions exportées

| Fonction | Description |
|----------|-------------|
| `normalizeFeedCategoryAlias` | Normalise aliases FR/EN vers catégorie canonique |
| `inferOperationalIntent` | Infère l'intent opérationnel d'un item |
| `buildFeedActionTarget` | Construit la cible d'action avec href |
| `buildFeedDisplayContext` | Construit le libellé contextuel d'affichage |
| `buildPremiumFeedSummary` | Construit le résumé premium avec status global |
| `buildOperationalCommandCenter` | Construit le centre de commandement |

### Routes mises à jour

| Route | Ajouts Bloc 12.1 |
|-------|-----------------|
| `GET /messages` | `premium_summary`, `command_center`, `inbox_counters`, `next_action`, `top_alert`, `latest_delivery`, `latest_briefing`; filtres: `category`, `employee_id`, `mission_id`, `task_id`, `intent`, `sensitive`, `blocking` |
| `GET /messages/[category]` | Aliases FR (`alertes`, `suivis`, `livraisons`, `briefings`); `category_label`, `premium_summary`, `command_center` |
| `POST /messages/briefing` | `premium_summary`, `command_center`, `feed_preview`; champs premium dans briefing |
| `GET /continuity` | `premium_feed_summary`, `command_center_preview` |
| `GET /mission/[id]` | `operational_premium_summary`, `operational_next_action` |
| `GET /employee/[id]/file` | `operational_premium_summary`, `operational_next_action` |

### Champs premium `PierreOperationalBriefing`

| Champ | Type |
|-------|------|
| `executive_summary` | `string` |
| `risk_summary` | `string \| null` |
| `delivery_summary` | `string \| null` |
| `followup_summary` | `string \| null` |
| `validation_summary` | `string \| null` |
| `recommended_next_actions` | `string[]` |
| `employee_focus` | `string \| null` |
| `mission_focus` | `string \| null` |

### Tests Bloc 12.1 — groupes ajoutés

| Groupe | Tests |
|--------|-------|
| `normalizeFeedCategoryAlias` | 14 |
| `inferFeedCategory — bug fix Bloc 12.1` | 7 |
| `inferOperationalIntent` | 15 |
| `buildFeedActionTarget` | 10 |
| `buildFeedDisplayContext` | 7 |
| `Premium fields on feed item builders` | 10 |
| `buildPremiumFeedSummary` | 10 |
| `buildOperationalCommandCenter` | 10 |
| `buildOperationalBriefing — premium fields` | 11 |
| `buildPierreOperationalFeed — premium output` | 8 |
| **Total nouveaux** | **102** |

### Script E2E `pierre-operational-feed-test.ps1` (44 étapes PS5)

44 étapes couvrant : auth, feed premium, aliases FR, filtres premium (sensitive, blocking, category, intent, employee_id), briefing premium fields (executive_summary, recommended_next_actions, premium_summary, feed_preview), routes enrichies (continuity premium_feed_summary, mission operational_premium_summary), items premium fields.

### Résultats finaux Bloc 12.1

| Métrique | Bloc 12 | Bloc 12.1 |
|----------|---------|-----------|
| Tests hr-operational-feed | 138 | **240** |
| Tests total | 829 | **931** |
| Fichiers test | 8 | **8** |
| tsc errors | 0 | **0** |
| Build | clean | **clean** |
| Nouvelles fonctions exportées | — | **6** |
| Nouveaux types exportés | — | **5** |
| Champs premium item | — | **8** |

---

## Bloc 13 — Pierre Mission Control — Centre de pilotage opérationnel

### Objectif

Transformer tous les blocs existants (missions, tâches, continuité, dossier employé 360, feed opérationnel) en un vrai poste de commandement opérationnel RH. Pierre dit ce qu'il a fait, ce qui est prêt, ce qui nécessite validation, ce qui est bloqué, ce qui est sensible, ce qui est en retard, quelles livraisons sont disponibles, quels dossiers employés nécessitent attention, ce que Pierre recommande maintenant, ce qui peut être lancé automatiquement et ce qui ne doit jamais l'être sans humain.

### Fichiers créés / modifiés

| Fichier | Rôle |
|---------|------|
| `src/lib/pierre/hr/mission-control.ts` | Module pur — 14 types, 19 fonctions exportées |
| `src/app/api/pierre/use/dashboard/route.ts` | GET /api/pierre/use/dashboard — tableau de bord complet |
| `src/app/api/pierre/use/dashboard/run-plan/route.ts` | GET /api/pierre/use/dashboard/run-plan — plan d'exécution |
| `src/app/api/pierre/use/dashboard/execute-safe/route.ts` | POST /api/pierre/use/dashboard/execute-safe — exécution des tâches sûres |
| `src/app/api/pierre/use/continuity/route.ts` | Enrichi — ajout de `mission_control_summary` |
| `src/lib/pierre/__tests__/hr-mission-control.test.ts` | 137 tests — toutes les fonctions exportées |
| `scripts/pierre-mission-control-test.ps1` | Script E2E PS5 — 35 étapes |
| `package.json` | `test` script — ajout de `hr-mission-control.test.ts` |

### Types exportés (mission-control.ts)

| Type | Description |
|------|-------------|
| `PierreMissionControlStatus` | `clear \| active \| attention_required \| blocked \| sensitive` |
| `PierreMissionControlPriority` | `urgent \| high \| normal \| low` |
| `PierreMissionControlQueueKey` | 11 clés de file d'attente |
| `PierreMissionControlActionType` | 12 types d'action |
| `PierreMissionControlSourceType` | 8 types de source |
| `PierreMissionControlAction` | Action individuelle avec toutes les métadonnées |
| `PierreMissionControlQueue` | File d'attente avec actions et compteur |
| `PierreMissionControlMetric` | Métrique clé/valeur/severity |
| `PierreMissionControlMissionCard` | Carte synthèse d'une mission |
| `PierreMissionControlEmployeeCard` | Carte synthèse d'un dossier employé |
| `PierreMissionControlExecutiveBriefing` | Briefing exécutif structuré |
| `PierreMissionControlRunPlan` | Plan d'exécution des tâches sûres |
| `PierreMissionControlDigest` | Digest avec tone et texte |
| `PierreMissionControlDashboard` | Dashboard complet retourné par le GET /dashboard |

### Fonctions exportées (mission-control.ts)

| Fonction | Rôle |
|----------|------|
| `isMissionControlSafeToRun` | Vérifie si une tâche peut être lancée automatiquement |
| `isMissionControlSensitive` | Détecte les indicateurs de sensibilité RH |
| `isMissionControlBlocking` | Détecte les blocages actifs |
| `inferMissionControlActionType` | Infère le type d'action d'une ligne DB |
| `classifyMissionControlQueue` | Classe une action dans une file d'attente |
| `buildMissionControlActionFromTask` | Construit une action depuis une tâche |
| `buildMissionControlActionFromMission` | Construit une action depuis une mission |
| `buildMissionControlActionFromDocument` | Construit une action depuis un document (livraison) |
| `buildMissionControlActionFromEmployeeSnapshot` | Construit une action depuis un snapshot employé |
| `buildMissionControlActionFromFeedItem` | Construit une action depuis un item de feed |
| `buildMissionControlMissionCard` | Construit une carte synthèse mission |
| `buildMissionControlEmployeeCard` | Construit une carte synthèse employé |
| `buildMissionControlMetrics` | Calcule les métriques globales |
| `buildMissionControlQueues` | Répartit les actions dans 11 files d'attente |
| `sortMissionControlActions` | Trie les actions par priorité |
| `buildMissionControlDigest` | Génère le digest opérationnel |
| `buildMissionControlExecutiveBriefing` | Génère le briefing exécutif |
| `buildMissionControlRunPlan` | Génère le plan d'exécution des tâches sûres |
| `buildMissionControlDashboard` | Construit le tableau de bord complet |

### Constantes de sécurité

| Constante | Valeur |
|-----------|--------|
| `BLOCKED_TASK_TYPES` | `email.send`, `send_email` — jamais exécutés automatiquement |
| `SAFE_RUN_STATUSES` | `ready`, `retry` |
| `TERMINAL_STATUSES` | `done`, `cancelled` |
| `NON_EXECUTABLE_STATUSES` | `done`, `cancelled`, `error`, `awaiting_approval` |
| `SENSITIVE_KEYWORDS` | `/harcel\|licenci\|disciplin\|faute.?grave\|judiciaire\|prudhomm\|discrimin\|agress\|offboarding\|critiqu/` |

### Routes Bloc 13

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/pierre/use/dashboard` | GET | Tableau de bord complet — status, queues, actions, métriques, briefing |
| `/api/pierre/use/dashboard/run-plan` | GET | Plan d'exécution — `?max=N&dry_run=false` |
| `/api/pierre/use/dashboard/execute-safe` | POST | Exécution réelle des tâches sûres — body `{max: N}` |
| `/api/pierre/use/continuity` | GET | Enrichi — ajout `mission_control_summary` |

### Les 11 files d'attente (queues)

| Clé | Description |
|-----|-------------|
| `do_now` | Actions urgentes à traiter immédiatement |
| `safe_to_run` | Tâches exécutables automatiquement |
| `approvals` | Validations humaines en attente |
| `blocked` | Blocages actifs à résoudre |
| `errors` | Erreurs à investiguer |
| `sensitive` | Cas sensibles — revue humaine obligatoire |
| `deliveries` | Livraisons disponibles |
| `scheduled` | Tâches planifiées (execute_at futur) |
| `waiting_info` | En attente d'information |
| `employee_attention` | Dossiers employés nécessitant attention |
| `monitoring` | Monitoring passif |

### Tests Bloc 13 — groupes

| Groupe | Tests |
|--------|-------|
| `isMissionControlSafeToRun` | 11 |
| `isMissionControlSensitive` | 10 |
| `isMissionControlBlocking` | 7 |
| `inferMissionControlActionType` | 11 |
| `classifyMissionControlQueue` | 12 |
| `buildMissionControlActionFromTask` | 10 |
| `buildMissionControlActionFromMission` | 6 |
| `buildMissionControlActionFromDocument` | 4 |
| `buildMissionControlActionFromEmployeeSnapshot` | 3 |
| `buildMissionControlActionFromFeedItem` | 2 |
| `buildMissionControlMissionCard` | 7 |
| `buildMissionControlEmployeeCard` | 4 |
| `buildMissionControlMetrics` | 6 |
| `buildMissionControlQueues` | 5 |
| `sortMissionControlActions` | 4 |
| `buildMissionControlDigest` | 6 |
| `buildMissionControlRunPlan` | 8 |
| `buildMissionControlExecutiveBriefing` | 7 |
| `buildMissionControlDashboard` | 14 |
| **Total** | **137** |

### Résultats finaux Bloc 13

| Métrique | Bloc 12.1 | Bloc 13 |
|----------|-----------|---------|
| Tests hr-mission-control | — | **137** |
| Tests total | 931 | **1068** |
| Fichiers test | 8 | **9** |
| tsc errors | 0 | **0** |
| Build | clean | **clean** |
| Nouveaux types exportés | — | **14** |
| Nouvelles fonctions exportées | — | **19** |
| Nouvelles routes | — | **3** |
| Routes enrichies | — | **1** |

---

## Bloc 15 — ClonePolicy + CloneTrust + Governance Runtime (2026-05-18)

### Objectif

Ajouter une couche de gouvernance complète au moteur Pierre : trois modules purs qui s'empilent et prennent toujours la décision la plus stricte. Le résultat est un runtime d'exécution autonome calibré par règles d'entreprise, historique de confiance, et évaluation de risque.

### Architecture des trois modules

```
CloneGuard (Bloc 14) — détection de signaux noirs/rouges
    └─ ClonePolicy (Bloc 15.1) — règles d'entreprise (22 règles par défaut)
        └─ CloneTrust (Bloc 15.2) — score de confiance 0-100, 6 niveaux d'autonomie
            └─ Governance Runtime (Bloc 15.3) — orchestrateur final
```

**Invariant absolu : la décision la plus stricte gagne toujours.**

Rang des décisions (0 = permissif → 5 = le plus strict) :
- 0 : `allow`
- 1 : `allow_with_warning`
- 2 : `supervised` *(niveau governance uniquement)*
- 3 : `require_approval`
- 4 : `block`
- 5 : `refuse`

### ClonePolicy (`src/lib/pierre/hr/clonepolicy.ts`)

Module pur. Applique les règles d'entreprise en plus de CloneGuard.

**22 règles par défaut**, classées par sévérité :
- **REFUSE** (système, non négociables) : harcèlement, discrimination, violence, licenciement abusif, litige juridique, prud'hommes
- **BLOCK** : email.send/send_email, communication externe non autorisée, risque black, modification données sensibles masse
- **REQUIRE_APPROVAL** : approval_required=true, risque red, licenciement, rémunération, cas disciplinaire, contrat de travail, données médicales
- **ALLOW_WITH_WARNING** : candidat externe, domain sensitive_case, onboarding

**Garanties** :
- Les règles `source: "system"` ont `can_override: false`
- ClonePolicy ne peut pas **affaiblir** CloneGuard (worst decision wins)
- Les règles runtime passées dans le contexte s'ajoutent aux règles par défaut
- Normalisation NFD locale (pas de dépendance cross-module)

**Exports clés** : `evaluatePierreClonePolicy`, `buildClonePolicyPreview`, `buildClonePolicyAuditEvent`, `applyClonePolicyToTask`, `isClonePolicyAutoExecutable`, `buildDefaultClonePolicyRules`

### CloneTrust (`src/lib/pierre/hr/clonetrust.ts`)

Module pur. Calcule un score de confiance 0–100 et en dérive un niveau d'autonomie.

**6 niveaux d'autonomie** :
| Niveau | Décision produite |
|--------|-------------------|
| `manual_only` | `manual_only` |
| `approval_first` | `approval_required` |
| `supervised` | `supervised_execution` |
| `limited_auto` | `supervised_execution` |
| `standard_auto` | `auto_allowed` (si guard+policy OK) |
| `high_trust` | `auto_allowed` (si guard+policy OK) |

**Facteurs de score** :
| Facteur | Plage |
|---------|-------|
| `company_trust_score` | -25 à +25 |
| `historical_success_rate` | 0 à +20 |
| `historical_task_count` | 0 à +10 |
| `risk_level_penalty` | -40 à 0 |
| `domain_penalty` | -15 à 0 |
| `cloneguard_penalty` | -40 à 0 |
| `clonepolicy_penalty` | -40 à 0 |
| `task_type_penalty` | -20 à 0 |
| `approval_required_flag` | -30 à 0 |

**Hard blocks absolus** (ignorent le score) : email.send/send_email, cloneguard refuse/block, clonepolicy refuse/block, approval_required=true, risque black, employee_file_risk black.

**Garanties** :
- CloneTrust **ne peut pas affaiblir** CloneGuard ni ClonePolicy
- `autonomy_level` cap restreint uniquement, ne booste jamais
- `trust_score` clampé 0–100, jamais NaN

**Exports clés** : `evaluatePierreCloneTrust`, `buildCloneTrustPreview`, `collectCloneTrustFactors`, `computeCloneTrustBaseScore`, `applyCloneTrustToTask`, `isCloneTrustAutoExecutable`

### Governance Runtime (`src/lib/pierre/hr/governance.ts`)

Orchestrateur pur. Combine les trois évaluateurs et retourne la décision finale.

```typescript
allowed_to_auto_execute =
  guard.allowed_to_auto_execute &&
  policy.allowed_to_auto_execute &&
  trust.allowed_to_auto_execute &&
  governanceDecision === "allow"
```

**Décision governance "supervised"** : niveau exclusif governance, mappé depuis CloneTrust `supervised_execution`. Positionné entre `allow_with_warning` et `require_approval`.

**Évaluations pré-calculées** : le contexte accepte `guard_evaluation`, `policy_evaluation`, `trust_evaluation` pour éviter de recalculer ce qu'un caller a déjà évalué.

**Exports clés** : `evaluateGovernance`, `buildGovernancePreview`, `buildGovernanceBriefing`, `buildGovernanceCard`, `applyGovernanceToTask`, `isGovernanceAutoExecutable`, `filterGovernanceSafeToRun`, `combineGovernanceDecisions`

### Intégration dans les routes existantes

| Route | Changement |
|-------|-----------|
| `submit/route.ts` | Governance évaluée après CloneGuard, snapshot dans `brain_output_json`, `governance: { evaluation, preview }` dans la réponse |
| `execute-task.ts` | Gate governance après gate CloneGuard (step 5.5), log `governance_execution_blocked` si bloqué |
| `continuity/run-next/route.ts` | Gate governance en boucle d'exécution, compteur `governance_blocked_count` |
| `mission/[missionId]/continue/route.ts` | Évaluation governance par tâche, `governance_summary` dans la réponse |
| `mission-control/route.ts` | `governance_card` dans la réponse, évaluation par action safe |
| `mission-control/run-safe/route.ts` | Gate `isGovernanceAutoExecutable` avant exécution, `governance_summary` |
| `mission-control/run-plan/route.ts` | Annotation `applyGovernanceToTask` sur chaque action, `governance_summary` |
| `mission-control/briefing/route.ts` | Compteurs `govBriefingBlocked` et `govBriefingAutoAllowed`, `governance_summary` |
| `mission/[missionId]/route.ts` | `governance: { evaluation, preview }` + `governance_card` dans `mission_control` |
| `employee/[employeeId]/file/route.ts` | `governance_summary` basé sur `cgTopEval` et `snapshot.risk_level` |

### Nouvelles routes canoniques

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/pierre/use/governance/evaluate` | POST | Évaluation complète (evaluation + preview + briefing + card) |
| `/api/pierre/use/governance/preview` | POST | Preview allégée + decision + allowed_to_auto_execute |
| `/api/pierre/use/clonepolicy/evaluate` | POST | Évaluation ClonePolicy seule + audit log |
| `/api/pierre/use/clonetrust/evaluate` | POST | Évaluation CloneTrust seule + audit log |

### Index SQL

`supabase/sql/pierre_governance_indexes_v1.sql` — 7 index pour :
- Audit trail governance sur `pierre_task_logs` (event_types governance/clonepolicy/clonetrust)
- `pierre_tasks.approval_required + status` pour eligibilité auto-exécution
- `pierre_tasks.type + status` pour gate par type
- `pierre_missions.risk_level + approval_required` pour contexte mission
- `pierre_company_memory` lookup singleton par user

### Tests Bloc 15

| Fichier | Tests | Couverture |
|---------|-------|-----------|
| `hr-clonepolicy.test.ts` | ≥180 | Normalizers, rules, decisions, runtime rules, security invariants |
| `hr-clonetrust.test.ts` | ≥150 | Normalizers, factors, score, hard blocks, autonomy caps, security |
| `hr-governance.test.ts` | ≥160 | Decisions, evaluations, pre-computed, pipeline functions |
| `hr-governance-runtime.test.ts` | ≥100 | Cross-module consistency, end-to-end, equivalence |

**Script E2E** : `scripts/pierre-governance-runtime-test.ps1` — 55 étapes, PS5 compatible, teste les 4 nouvelles routes + intégrations + invariants de sécurité.

### Résultats finaux Bloc 15

| Métrique | Avant Bloc 15 | Bloc 15 |
|----------|---------------|---------|
| Modules purs nouveaux | — | **3** (clonepolicy, clonetrust, governance) |
| Routes nouvelles | — | **4** |
| Routes enrichies | — | **10** |
| Fichiers test nouveaux | 11 | **15** |
| Index SQL nouveaux | — | **7** |
| tsc errors | 0 | **0** |
| Build | clean | **clean** |

---

## Bloc 16 — Pierre Audit Trail & Observabilité

### Objectif

Couche d'audit trail unifiée pour toutes les décisions, exécutions et événements du moteur Pierre. Observabilité complète : trail d'événements, diagnostics, score de santé, alertes, export.

### Module pur — `src/lib/pierre/hr/audit-trail.ts`

Module autonome (aucune dépendance vers governance/cloneguard/supabase). Déterministe, sans effets de bord.

**Types exportés** :
- `PierreAuditTrailSource` — source de l'événement (mission, task, document, log, governance, cloneguard, …)
- `PierreAuditTrailEventType` — type canonique d'événement (27 valeurs)
- `PierreAuditTrailRiskLevel` — green / orange / red / black
- `PierreAuditTrailSeverity` — info / notice / warning / action_required / blocked / critical
- `PierreAuditTrailStatus` — ok / waiting / blocked / failed / completed / unknown
- `PierreAuditTrailEvent` — événement central avec source, severity, risk_level, requires_human, governance/guard decisions
- `PierreAuditTrailDiagnostics` — compteurs agrégés (critical, blocked, human_required, governance_block, auto_allowed)
- `PierreAuditTrailHealth` — score 0–100 + label
- `PierreAuditTrailDigest` — tone (ok/attention/blocked/critical) + texte lisible
- `PierreAuditTrailAlert` — alerte structurée (level: info/warning/urgent/critical)
- `PierreAuditTrailTimeline` — events + sections + diagnostics + health + digest

**Fonctions exportées** :
- `buildAuditTrailEvents(params)` — construit la liste complète d'événements depuis missions/tasks/documents/logs
- `filterAuditTrailEvents(events, filter)` — filtre (mission_id, task_id, source, severity, requires_human, limit…)
- `buildAuditTrailSections(events)` — sections par catégorie (critical, blocked, human_required, …)
- `buildAuditTrailDiagnostics(events)` — compteurs agrégés
- `scoreAuditTrailHealth(events)` — score de santé (pénalités : critical×20, governance_block×15, blocked×10, failed×8…)
- `buildAuditTrailDigest(events)` — résumé tonalisé
- `buildAuditTrailTimeline(events)` — timeline complète (events + sections + diagnostics + health + digest)
- `buildAuditTrailAlerts(events)` — alertes triées par priorité
- `summarizeAuditTrailEvent(event)` — phrase lisible pour un événement
- `buildAuditTrailExport(params)` — export structuré avec metadata
- `buildAuditTrailSnapshot(events, filter)` — snapshot filtré
- Normalizers : `normalizeAuditTrailRiskLevel`, `normalizeAuditTrailSeverity`, `normalizeAuditTrailSource`, `inferAuditTrailEventType`, `inferAuditTrailSeverity`, `inferAuditTrailRiskLevel`, `normalizeAuditTrailEvent`

**IDs déterministes** : `"at_" + djb2(source + ":" + source_id + ":" + event_type)` — pas de `crypto.randomUUID`.

**Déduplication** : clé `source:source_id:event_type`, on garde l'entrée la plus récente.

**Tri** : DESC par `created_at`, dates nulles en dernier.

### Builders de logs purs — `src/lib/pierre/logs.ts`

Ajout de 4 fonctions pures (no Supabase, no async) :

| Fonction | event_type produit |
|----------|--------------------|
| `buildPierreAuditLogRow(params)` | paramétrable |
| `buildGovernanceAuditLogRow(params)` | `governance_execution_blocked` ou `governance_evaluation` |
| `buildExecutionAuditLogRow(params)` | `task_execution_completed` ou `task_execution_failed` |
| `buildHumanRequiredLogRow(params)` | `human_action_required` |

Invariant : toujours `{ user_id, agent_slug: "pierre", event_type, message, meta_json }`. Jamais `level`, `event`, ou `payload` dans `meta_json`.

### Nouvelles routes — Audit Trail

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/pierre/use/audit-trail` | GET | Trail complet (events, sections, diagnostics, health, digest, alerts) |
| `/api/pierre/use/audit-trail/alerts` | GET | Alertes seules avec diagnostics et digest |
| `/api/pierre/use/audit-trail/export` | GET | Export structuré avec scope et metadata |

**Paramètres de filtre** : `mission_id`, `task_id`, `employee_id`, `source`, `severity`, `risk_level`, `requires_human`, `status`, `limit` (max 500).

### Routes enrichies — `audit_trail_summary`

| Route | Champ ajouté |
|-------|-------------|
| `mission/[missionId]/route.ts` | `audit_trail` (events + sections + diagnostics + health + digest + alerts) |
| `employee/[employeeId]/file/route.ts` | `audit_trail_summary` |
| `continuity/route.ts` | `audit_trail_summary` |
| `mission-control/route.ts` | `audit_trail_summary` |
| `messages/route.ts` | `audit_trail_summary` |

Shape de `audit_trail_summary` :
```json
{
  "diagnostics": { "total_events": 12, "critical_count": 0, "human_required_count": 1, ... },
  "health": { "score": 87, "label": "Bon" },
  "digest": { "tone": "attention", "text": "..." },
  "alerts_count": 1,
  "critical_count": 0,
  "human_required_count": 1
}
```

### Enrichissements runtime (Phase 7)

| Route | Enrichissement |
|-------|---------------|
| `continuity/run-next/route.ts` | Import `buildExecutionAuditLogRow` — log non-bloquant par tâche exécutée (completed/failed) |
| `mission-control/run-safe/route.ts` | Import `buildExecutionAuditLogRow` — log non-bloquant par tâche exécutée (completed/failed) |

Pattern non-bloquant : `void Promise.resolve(supabase.from("pierre_task_logs").insert(row)).catch(() => {})`.

### Index SQL — `supabase/sql/pierre_audit_trail_indexes_v1.sql`

8 index pour les requêtes audit trail :
- `idx_pierre_task_logs_audit_user` — (user_id, agent_slug, created_at DESC)
- `idx_pierre_task_logs_audit_event` — (user_id, agent_slug, event_type, created_at DESC)
- `idx_pierre_task_logs_audit_mission` — (mission_id, created_at DESC)
- `idx_pierre_task_logs_audit_task` — (task_id, created_at DESC)
- `idx_pierre_tasks_audit_status` — (user_id, agent_slug, status, created_at DESC)
- `idx_pierre_tasks_audit_mission` — (user_id, agent_slug, mission_id, created_at DESC)
- `idx_pierre_missions_audit_status` — (user_id, agent_slug, status, created_at DESC)
- `idx_pierre_documents_audit_mission` — (user_id, agent_slug, mission_id, created_at DESC)

### Tests Bloc 16

| Fichier | Tests | Couverture |
|---------|-------|-----------|
| `hr-audit-trail.test.ts` | ≥190 | Normalizers, inference, buildAuditTrailEvents, filter, sections, diagnostics, health, digest, timeline, alerts, export, snapshot, security invariants |
| `hr-audit-trail-runtime.test.ts` | ≥80 | Builders de logs (4 fonctions), invariants schema, pas de level/event/payload, sécurité (email.send/red/black/approval), résilience malformed data, shapes diagnostics/health/digest |

**Script E2E** : `scripts/pierre-audit-trail-test.ps1` — 50 étapes, PS5 compatible, teste les 3 nouvelles routes + audit_trail_summary sur 4 routes + filtres + invariants de sécurité.

### Résultats finaux Bloc 16

| Métrique | Avant Bloc 16 | Bloc 16 |
|----------|---------------|---------|
| Module pur audit trail | — | **1** (audit-trail.ts) |
| Builders de logs purs | — | **4** |
| Routes nouvelles | — | **3** |
| Routes enrichies | — | **5** |
| Fichiers test nouveaux | 15 | **17** |
| Index SQL nouveaux | — | **8** |
| tsc errors | 0 | **0** |
| Build | clean | **clean** |

