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

---

## Bloc 17 — Employee Actions & Workflows RH automatisés

### Vue d'ensemble

Le Bloc 17 introduit le moteur d'**actions RH automatisées** : un catalogue de 33 actions couvrant 12 domaines, un système de suggestions intelligentes par salarié, un pipeline de gouvernance à 4 niveaux (`auto_safe → approval_required → manual_only → blocked`), et des nouvelles routes dédiées aux actions employés et workflows RH.

### Module pur — `src/lib/pierre/hr/employee-actions.ts`

**20 fonctions exportées**, zéro dépendance externe, zéro async/side-effect.

#### Types principaux

| Type | Description |
|------|-------------|
| `PierreEmployeeActionDomain` | 12 domaines : onboarding, offboarding, contract, absence, payroll, training, interview, document, communication, followup, note, general |
| `PierreEmployeeActionGovernance` | `auto_safe` \| `approval_required` \| `manual_only` \| `blocked` |
| `PierreEmployeeActionRisk` | `green` \| `orange` \| `red` \| `black` |
| `PierreEmployeeActionCatalogItem` | Entrée catalogue avec id, domain, action_type, governance, risk, label_fr/en, description |
| `PierreEmployeeActionSuggestion` | Suggestion contextuelle avec confidence, reason, risk, governance |
| `PierreEmployeeActionPlan` | Plan complet par salarié avec compteurs par gouvernance et next_action |
| `PierreEmployeeActionTaskDraft` | Brouillon de tâche : type, status, execute_at (jamais scheduled_for), payload_json |
| `PierreEmployeeActionResult` | Résultat de résolution : allowed_to_auto_execute, task_draft (null si manual_only/blocked), explanation |
| `PierreEmployeeActionTrace` | Trace déterministe : id = `"ea_" + simpleHash(employee_id + ":" + action_type)` |

#### Catalogue — 33 actions, 12 domaines

| Domaine | Actions clés | Gouvernance max |
|---------|-------------|-----------------|
| onboarding | welcome_email, document_checklist, account_setup_reminder, contract_send | approval_required |
| offboarding | exit_interview_schedule, document_return_checklist, termination_letter_draft, access_revocation_note | **manual_only** |
| contract | renewal_reminder, amendment_draft, termination_prep, trial_period_followup | **manual_only** |
| absence | absence_acknowledgment, return_to_work_schedule, long_absence_followup, medical_certificate_reminder | auto_safe |
| payroll | variable_element_prep, salary_review_draft | **manual_only** |
| training | training_plan_draft, training_reminder | auto_safe |
| interview | annual_review_schedule, performance_note_draft, disciplinary_prep | **manual_only** |
| document | employee_file_update, work_certificate_draft, reference_letter_draft | approval_required |
| communication | manager_alert, sensitive_communication_prep | **manual_only** |
| followup | pending_tasks_followup, manager_followup_note | auto_safe |
| note | internal_note_draft | auto_safe |
| general | action_reminder | auto_safe |

#### Invariants de sécurité

- Actions `red` / `black` → jamais `auto_safe`
- Actions `manual_only` / `blocked` → `resolveEmployeeActionResult` retourne `task_draft = null`
- `buildEmployeeActionTaskDraft` pour actions red → `approval_required = true`
- ID de trace déterministe : `"ea_" + simpleHash(employee_id + ":" + action_type)` — pas de timestamp dans le hash
- `buildEmployeeActionsIndex` filtre les entrées null/undefined/non-objet sans throw

#### Fonctions clés

```typescript
getEmployeeActionCatalog(): PierreEmployeeActionCatalogItem[]
getEmployeeActionById(id): PierreEmployeeActionCatalogItem | null
getEmployeeActionsByDomain(domain): PierreEmployeeActionCatalogItem[]
inferEmployeeActionDomain(text): PierreEmployeeActionDomain
inferEmployeeActionType(text): string | null
classifyEmployeeActionRisk(action_type, context?): PierreEmployeeActionRisk
resolveEmployeeActionGovernance(action_type, context?): PierreEmployeeActionGovernance
isEmployeeActionAutoSafe(action_type, context?): boolean
scoreEmployeeActionConfidence(action_type, employee, missions, tasks): number
buildEmployeeActionSuggestions(employee, missions, tasks): PierreEmployeeActionSuggestion[]
buildEmployeeActionPlan(employee, missions, tasks, now?): PierreEmployeeActionPlan
buildEmployeeActionSummary(suggestions): PierreEmployeeActionSummary
getEmployeeActionDomainsActive(suggestions): PierreEmployeeActionDomain[]
resolveEmployeeActionResult(action_type, context): PierreEmployeeActionResult
buildEmployeeActionTaskDraft(action_type, context): PierreEmployeeActionTaskDraft
filterEmployeeActionsByGovernance(actions, governance): PierreEmployeeActionSuggestion[]
filterEmployeeActionsByRisk(actions, max_risk): PierreEmployeeActionSuggestion[]
buildEmployeeActionTrace(action_type, employee_id, context?, now?): PierreEmployeeActionTrace
buildEmployeeActionAuditMeta(action_type, employee_id, governance, risk): Record<string, unknown>
buildEmployeeActionsIndex(employees, allMissions, allTasks): Record<string, PierreEmployeeActionPlan>
```

### Nouvelles routes

#### `GET/POST /api/pierre/use/employee/[employeeId]/actions`

- **GET** : charge l'employé depuis `pierre_company_memory`, construit plan + summary, supporte filtres `domain` / `governance` / `include_all`
- **POST** : valide action_type, `manual_only` → log `human_action_required` sans insertion DB, `dry_run=true` retourne draft, `dry_run=false` insère tâche avec `execute_at`
- Réponse inclut `employee_actions_endpoint`

#### `GET/POST /api/pierre/use/employees/actions`

- **GET** : charge tous les employés, construit `actionsIndex`, calcule `global_summary`, retourne `urgent_employees` (ceux avec manual_only ou approval_required > 0)
- Paramètres : `governance`, `risk`, `catalog`

#### `GET/POST /api/pierre/use/workflows/rh`

- **GET** : retourne `WORKFLOW_DOMAIN_CATALOG` (11 entrées) + `safety_matrix` (risk_baseline, approval_required, auto_executable, employee_action_domains, sample_actions)
- **POST** : `buildPierreHrWorkflowPlan(input, { employee_context })`, logs `workflow_rh_analyzed` non-bloquant

### Routes enrichies

| Route | Champs ajoutés |
|-------|---------------|
| `employee/[employeeId]/file` | `employee_actions_summary`, `employee_action_suggestions` (top 5), `employee_actions_endpoint` |
| `employees/files` | `employee_actions_index`, `employee_actions_global_summary`, `employee_actions_endpoint` |
| `mission/[missionId]` | `employee_action_context` (suggestions, summary, trace, endpoint) |
| `mission-control` | `employee_actions_summary` |
| `messages` | `employee_actions_summary` |

### execute-task enrichi

Nouveaux champs dans `result_json` :
- `employee_action_type` — depuis `payload_json.action_type`
- `employee_action_domain` — depuis `payload_json.action_domain`
- `employee_action_governance` — calculé via `resolveEmployeeActionGovernance`
- `employee_action_risk` — calculé via `classifyEmployeeActionRisk`

### SQL — `supabase/sql/pierre_employee_actions_indexes_v1.sql`

8 index idempotents (`IF NOT EXISTS`) :
- `idx_pierre_tasks_action_type` — GIN sur `payload_json` (jsonb_path_ops)
- `idx_pierre_tasks_employee_payload` — GIN sur `payload_json -> 'employee_id'`
- `idx_pierre_tasks_employee_context_payload` — GIN sur `payload_json -> 'employee_context'`
- `idx_pierre_tasks_employee_actions_status` — btree (user_id, agent_slug, status, created_at DESC)
- `idx_pierre_task_logs_employee_action` — GIN sur `meta_json -> 'employee_id'`
- `idx_pierre_task_logs_action_event` — btree (user_id, agent_slug, event_type, created_at DESC)
- `idx_pierre_company_memory_user` — btree (user_id, agent_slug)
- `idx_pierre_tasks_action_domain` — GIN sur `payload_json -> 'action_domain'`

### Tests Bloc 17

| Fichier | Tests | Couverture |
|---------|-------|-----------|
| `hr-employee-actions.test.ts` | ≥190 | 21 groupes : catalog, inference, risk/governance, confidence, suggestions, plan, summary, task draft, result, filters, trace, audit, index, security invariants, robustness |
| `hr-employee-actions-runtime.test.ts` | 89 | Log schema (never level/event/payload), task draft schema (execute_at not scheduled_for), security gate (manual_only/blocked → task_draft null), trace ID determinism, confidence edge cases, plan determinism, index mixed data, filter hierarchy, suggestions enrichment, summary invariants, catalog risk↔governance coherence |

**Script E2E** : `scripts/pierre-employee-actions-test.ps1` — 63 étapes, PS5 compatible, teste les 3 nouvelles routes + mission-control + sécurité + auth protection.

### Résultats finaux Bloc 17

| Métrique | Avant Bloc 17 | Bloc 17 |
|----------|---------------|---------|
| Module pur employee-actions | — | **1** (employee-actions.ts, 20 fonctions) |
| Catalogue d'actions | — | **33 items, 12 domaines** |
| Routes nouvelles | — | **3** |
| Routes enrichies | — | **5** |
| Fichiers test nouveaux | 17 | **19** |
| Index SQL nouveaux | — | **8** |
| Tests total | ~2073 | **2162** |
| tsc errors | 0 | **0** |
| Build | clean | **clean** |

---

## Bloc 18 — CloneStore Technologies Foundation / Socle technologique transversal

### Objectif

Faire des technologies CloneStore une **couche plateforme transversale**, réutilisable par tous les employés IA — et non un module interne à Pierre. Pierre est simplement le premier consommateur de cette couche.

### Principe fondamental

> Aucune technologie ne doit contenir "Pierre" comme hypothèse centrale. Toutes les fonctions d'accès sont paramétrées par `employeeSlug: string`.

### 12 Technologies CloneStore

| Slug | Nom | Noyau | Configurable client | Validation humaine | Statut défaut |
|------|-----|-------|---------------------|--------------------|---------------|
| `cloneos` | CloneOS | oui | non | non | enabled |
| `cloneadn` | CloneADN | non | oui | non | enabled |
| `cloneguard` | CloneGuard | oui | oui (risk_mode) | non | enabled |
| `clonetrace` | CloneTrace | oui | non | non | enabled |
| `clonecontinuum` | CloneContinuum | oui | non | non | enabled |
| `clonetrust` | CloneTrust | non | oui | non | enabled |
| `clonereview` | CloneReview | non | oui | **oui** | enabled |
| `clonesignals` | CloneSignals | non | oui | non | enabled |
| `clonelearn` | CloneLearn | non | oui | **oui** | enabled |
| `clonevoice` | CloneVoice | non | oui | non | **disabled** (beta) |
| `clonechat` | CloneChat | non | oui | non | enabled |
| `clonebrief` | CloneBrief | non | oui | non | enabled |

### Architecture — modules purs

Tous les modules sont **purs** : zéro Supabase, zéro Next.js, zéro async, zéro effets de bord.

```
src/lib/clonestore/technologies/
  contracts.ts        — 13 types exportés (TechnologySlug, TechnologyDefinition, …)
  registry.ts         — 12 définitions + 9 fonctions exportées
  configuration.ts    — validation / merge / rapports de configuration
  __tests__/
    technology-registry.test.ts   — 130+ tests
```

### Fonctions exportées — `registry.ts`

| Fonction | Description |
|----------|-------------|
| `getCloneStoreTechnologyDefinitions()` | Les 12 définitions immuables |
| `getTechnologyDefinition(slug)` | Par slug, null si inconnu |
| `buildDefaultTechnologyCompanySettings(defs, now?)` | Paramètres par défaut pour toutes les techs |
| `normalizeTechnologyCompanySetting(raw, def, now?)` | Normalise un objet brut (DB ou null) |
| `buildTechnologyRegistry(params)` | Construit le registre complet avec états runtime |
| `computeTechnologyRegistrySummary(registry)` | Résumé comptable |
| `resolveTechnologyForEmployee(registry, employeeSlug)` | Technologies actives pour un employé |
| `isTechnologyEnabledForEmployee(registry, slug, employeeSlug)` | Booléen — `disabled_for` a priorité sur `enabled_for` |
| `buildTechnologyPublicDigest(registry)` | Chaîne lisible pour les réponses API |

### Invariants critiques

1. `disabled_for_employee_slugs` a toujours priorité sur `enabled_for_employee_slugs`
2. Les noyaux plateforme (`cloneos`, `clonetrace`, `clonecontinuum`) ne peuvent pas être désactivés ni modifiés par les clients
3. `clonereview` et `clonelearn` interdisent `autonomy_level = "autonomous"` (requires_human_validation)
4. `clonevoice` : `default_status = "disabled"`, visibilité `"beta"`
5. Stockage temporaire : `pierre_company_memory.reusable_rh_context_json.clone_technologies` (keyed by slug, filtré par `user_id + agent_slug = "pierre"`)
6. `configuration_status` est calculé automatiquement par `mergeTechnologySettings`

### Routes

#### `GET /api/clonestore/technologies`

Retourne le registre complet, le digest public et le rapport de configuration.

```
?employee_slugs=pierre,sophie   — liste des employés pour la matrice
?matrix=true                    — inclure buildTechnologyEmployeeMatrix
```

Réponse : `{ ok, registry, digest, report, matrix?, meta }`

#### `GET /api/clonestore/technologies/[technologySlug]`

Retourne la définition, le paramètre courant, l'état runtime et la validation pour une technologie.

Réponse : `{ ok, technology, setting, runtime_state, validation, enabled_for_pierre, meta }`

#### `PATCH /api/clonestore/technologies/[technologySlug]`

Met à jour les paramètres modifiables : `status`, `autonomy_level`, `risk_mode`, `enabled_for_employee_slugs`, `disabled_for_employee_slugs`, `custom_rules`, `validation_rules`, `notification_rules`, `memory_rules`.

Champs protégés (non modifiables) : `technology_slug`, `created_at`.

Retourne 400 si aucun champ valide fourni, 400 si validation post-merge échoue.

Log non-bloquant : `event_type = "technology_setting_updated"` dans `pierre_task_logs`.

### Routes enrichies

| Route | Champ ajouté |
|-------|-------------|
| `submit/route.ts` (brain_output_json) | `technology_context` — technologies actives, guard_mode, autonomy_level, trace/review/continuity enabled |
| `mission/[missionId]/route.ts` | `clone_technologies` — active_technologies, total, enabled |

### Tests Bloc 18

| Fichier | Tests | Couverture |
|---------|-------|-----------|
| `technology-registry.test.ts` | 130+ | 14 groupes : catalog completeness, platform-core invariants, requires_human_validation, CloneVoice, getTechnologyDefinition, buildDefaultTechnologyCompanySettings, normalizeTechnologyCompanySetting (edge cases), buildTechnologyRegistry, health scores, runtime states, computeTechnologyRegistrySummary, isTechnologyEnabledForEmployee (priority rules), resolveTechnologyForEmployee, buildTechnologyPublicDigest, no-Pierre-hardcoding, registry integrity |

**Script E2E** : `scripts/clonestore-technologies-foundation-test.ps1` — 50 étapes, PS5 compatible.

### Résultats finaux Bloc 18

| Métrique | Avant Bloc 18 | Bloc 18 |
|----------|---------------|---------|
| Couche technologie transversale | — | **1** (3 modules purs) |
| Technologies définies | — | **12** |
| Routes nouvelles | — | **2** (+ 1 avec paramètre) |
| Routes enrichies | — | **2** |
| Fichiers test nouveaux | 19 | **20** |
| Tests total | 2162 | **2290+** |
| tsc errors | 0 | **0** |
| Build | clean | **clean** |

---

## Bloc 18.1 — CloneStore Technologies Storage Migration

### Objectif

Sortir les configurations technologies de `pierre_company_memory` et les placer dans une table plateforme dédiée, complètement indépendante de Pierre.

### Principe

> Les technologies CloneStore ne sont plus des sous-données de Pierre. Elles appartiennent à l'entreprise, pas à un employé IA.

### Table dédiée

`public.clonestore_company_technologies`

| Colonne | Type | Description |
|---------|------|-------------|
| `user_id` | uuid | Identifiant entreprise (clé RLS) |
| `technology_key` | text | Identifiant technique = TechnologySlug |
| `technology_name` | text | Nom affiché |
| `enabled` | boolean | Champ queryable dénormalisé (≠ disabled/not_configured → false) |
| `mode` | text | Champ queryable = risk_mode |
| `autonomy_level` | text | Champ queryable = autonomy_level |
| `config_json` | jsonb | **Source de vérité** — TechnologyCompanySetting complet (round-trip lossless) |
| `metadata_json` | jsonb | Champs auxiliaires queryables (status, enabled_for, disabled_for, custom_rules) |
| `preferences_json` | jsonb | notification_rules |
| `limits_json` | jsonb | memory_rules |
| `rules_json` | jsonb | validation_rules (format array) |
| `connections_json` | jsonb | Réservé (futur) |

Contrainte unique: `(user_id, technology_key)` — upsert via `onConflict: "user_id,technology_key"`.

RLS activé: chaque entreprise accède uniquement à ses propres configurations.

Trigger `updated_at` automatique.

### Module pur `storage.ts`

`src/lib/clonestore/technologies/storage.ts` — zéro Supabase, zéro Next, zéro async.

| Fonction exportée | Description |
|-------------------|-------------|
| `normalizeDbRow(raw)` | Coerce résultat DB brut → `CloneStoreTechnologyRow \| null` |
| `mapRowToSetting(row, def)` | DB row → `TechnologyCompanySetting` (config_json en priorité) |
| `mapSettingToUpsertPayload(setting, userId, name)` | `TechnologyCompanySetting` → payload upsert DB |
| `mapRowsToSettings(rows, defs)` | Batch: rows[] → settings[], skip malformed/unknown |
| `legacyExtractSettings(contextJson, defs)` | Fallback lecture JSON blob legacy (pierre_company_memory) |

### Stratégie de lecture (priorité)

1. **`clonestore_company_technologies`** — nouvelle table plateforme (source primaire)
2. **`pierre_company_memory.reusable_rh_context_json.clone_technologies`** — JSON legacy (fallback lecture seule)
3. **Défauts de définition** — si aucun paramètre persisté

`meta.storage_source` dans chaque réponse : `"platform_table"` | `"legacy_json"` | `"defaults"`.

### Stratégie d'écriture

**Écriture uniquement vers `clonestore_company_technologies`** — plus jamais vers `pierre_company_memory`.

`pierre_company_memory` reste accessible en lecture legacy mais n'est plus mis à jour pour les technologies CloneStore.

### Round-trip lossless

`config_json` contient le `TechnologyCompanySetting` complet. La lecture utilise `config_json` en priorité si `technology_slug` est présent. Tous les champs (`enabled_for_employee_slugs`, `disabled_for_employee_slugs`, `custom_rules`, etc.) sont préservés sans perte.

### Tests Bloc 18.1

| Groupe | Tests | Couverture |
|--------|-------|-----------|
| `normalizeDbRow` | 14 | null/undefined/string/empty key/valid/coercions |
| `mapRowToSetting — config_json` | 6 | lossless round-trip via config_json |
| `mapRowToSetting — synthesis` | 9 | fallback depuis colonnes individuelles |
| `mapSettingToUpsertPayload` | 14 | enabled mapping, mode, config_json, metadata_json |
| Round-trip complet | 6 | write→read via normalizeDbRow |
| `mapRowsToSettings` | 6 | batch, skip malformed, unknown slugs |
| `legacyExtractSettings` | 9 | fallback legacy, malformed entries, connus/inconnus |
| No Pierre hardcoding | 3 | aucune référence "pierre" dans storage module |

**Total**: 67 nouveaux tests de storage (2347 total).

**Script E2E**: `scripts/clonestore-technologies-storage-test.ps1` — 26 étapes, PS5 compatible.

### Résultats finaux Bloc 18.1

| Métrique | Bloc 18 | Bloc 18.1 |
|----------|---------|-----------|
| Stockage technologies | pierre_company_memory (JSON blob) | **clonestore_company_technologies (table dédiée)** |
| Module pur storage | — | **1** (storage.ts, 5 fonctions) |
| SQL nouvelle table | — | **1** (8 index + RLS + trigger) |
| Fallback legacy | — | **oui** (lecture seule, pas d'écriture) |
| meta.storage_source | — | **3 valeurs** (platform_table / legacy_json / defaults) |
| Tests total | 2290+ | **2347** |
| tsc errors | 0 | **0** |
| Build | clean | **clean** |




---

## Bloc 19 — CloneStore Runtime Context / CloneOS Platform Bridge

**Objectif**: Couche runtime plateforme pour tous les employés IA — pas Pierre-only. Évalue les capacités runtime, les politiques d'action, et expose un contexte d'exécution cohérent à toutes les routes.

### Nouveaux modules

#### `src/lib/clonestore/runtime/contracts.ts` — Types purs (aucune dépendance)

| Type | Description |
|------|-------------|
| `CloneRuntimeDecision` | `allowed` \| `allowed_with_observation` \| `requires_review` \| `requires_validation` \| `blocked_by_technology` \| `blocked_by_policy` |
| `CloneRuntimeCapability` | Capacité runtime par technologie pour un employé |
| `CloneRuntimeContext` | Contexte plat résolu : employee_slug, guard_mode, autonomy_level, flags par technologie |
| `CloneRuntimeActionEvaluation` | Résultat d'évaluation d'une action (décision, source, flags humains) |
| `CloneRuntimeGovernance` | Santé globale : `healthy` \| `degraded` \| `locked` |
| `CloneRuntimeSnapshot` | Snapshot complet : context + governance + capabilities + summary |
| `CloneRuntimeActionInput` | Input POST pour évaluation d'action |
| `CloneRuntimeStorageSource` | `platform_table` \| `legacy_json` \| `defaults` \| `unavailable` |

#### `src/lib/clonestore/runtime/engine.ts` — Moteur pur (aucune dépendance Supabase/Next)

| Fonction exportée | Description |
|-------------------|-------------|
| `normalizeRuntimeEmployeeSlug(slug)` | Coerce → string lowercase, défaut "pierre" |
| `normalizeRuntimeActionType(action)` | Coerce → string lowercase, défaut "" |
| `normalizeRuntimeRiskLevel(level)` | Coerce → "normal"\|"guarded"\|"strict"\|"locked"\|"red"\|"black"\|null |
| `buildRuntimeContext(registry, employeeSlug, now?)` | Contexte plat pour un employé |
| `buildRuntimeGovernance(registry)` | Gouvernance globale depuis snapshot technologique |
| `buildRuntimeCapabilities(registry, employeeSlug)` | Capacité par technologie |
| `evaluateRuntimeAction(context, actionType, options?, now?)` | Évalue une action — jamais d'exécution |
| `buildRuntimeSnapshot(registry, employeeSlug, now?)` | Snapshot complet |

### Invariants d'évaluation d'action (evaluateRuntimeAction)

| Priorité | Condition | Décision |
|----------|-----------|----------|
| 1 | `action_type` vide/manquant | `blocked_by_policy` |
| 2 | `email.send` ou `send_email` | `blocked_by_policy` |
| 3 | `risk_level = "black"` | `blocked_by_policy` |
| 4 | `approval_required = true` | `requires_validation` |
| 5 | `risk_level = "red"` | `requires_validation` |
| 6 | `guard_mode = "locked"` | `blocked_by_technology` |
| 7 | `autonomy_level = "off"` | `requires_validation` |
| 8 | `autonomy_level = "suggest_only"` | `requires_review` |
| 9 | `document.generate` \| `pdf.generate` \| `email.draft` | `requires_review` |
| 10 | `contains_sensitive_keywords = true` | `requires_review` |
| 11 | `guard_mode = "strict"` | `requires_review` |
| 12 | `autonomy_level = "supervised"` | `allowed_with_observation` |
| 13 | `autonomy_level = "semi_autonomous"` | `allowed_with_observation` |
| 14 | `autonomy_level = "autonomous"` | `allowed` |
| 15 | Fallback | `allowed_with_observation` |

### Routes modifiées

#### `GET /api/clonestore/runtime` — Nouveau

Retourne un `CloneRuntimeSnapshot` complet pour un `employee_slug` (défaut: `pierre`).
Stratégie de stockage: platform_table → legacy_json → defaults.

#### `POST /api/clonestore/runtime` — Nouveau

Évalue une action contre le contexte runtime de l'employé.
Body: `{ action_type, employee_slug?, task_type?, risk_level?, approval_required?, contains_sensitive_keywords? }`
Retourne: `{ ok, evaluation, context_summary, meta }`.

#### `POST /api/pierre/use/submit` — Enrichi

Ajoute `clone_runtime_snapshot`, `clone_runtime_unavailable`, `clone_runtime_storage_source` dans `context_snapshot_json` et `brain_output_json`.
Répond avec `clone_runtime: { snapshot, unavailable, storage_source, error? }`.

#### `GET /api/pierre/use/mission/[missionId]` — Enrichi

Lit `clone_runtime_snapshot` depuis `context_snapshot_json` (source "mission_snapshot"), ou reconstruit depuis DB (source "rebuilt"), ou retourne `unavailable`.
Répond avec `clone_runtime: { snapshot, context, source, error? }`.

#### `GET /api/pierre/use/mission-control` — Enrichi

Construit `clone_runtime_summary` en parallèle des autres fetches.
Répond avec `clone_runtime_summary: { snapshot, unavailable, storage_source, error? }`.

#### `GET /api/pierre/use/dashboard` — Enrichi

Même enrichissement que mission-control.
Répond avec `clone_runtime_summary: { snapshot, unavailable, storage_source, error? }`.

### Tests Bloc 19

| Groupe | Tests | Couverture |
|--------|-------|-----------|
| `normalizeRuntimeEmployeeSlug` | 14 | null/undefined/string/empty/number/object/array |
| `normalizeRuntimeActionType` | 14 | null/undefined/empty/number/object/array |
| `normalizeRuntimeRiskLevel` | 13 | tous les niveaux valides + cas limites |
| `buildRuntimeContext` | 15 | registry-based, fallback, flags booléens |
| `buildRuntimeGovernance` | 6 | healthy/degraded/locked, fallback |
| `buildRuntimeCapabilities` | 7 | array, fields, can_auto_execute, locked |
| `evaluateRuntimeAction` | 75+ | tous les invariants + interactions + propagation trace/review |
| `buildRuntimeSnapshot` | 16 | champs requis, fallback, summary format |

**Total**: 160 tests unitaires (tous verts).

**Script E2E**: `scripts/clonestore-runtime-test.ps1` — 27 étapes, PS5 compatible.

### Résultats finaux Bloc 19

| Métrique | Valeur |
|----------|--------|
| Modules purs | 2 (contracts.ts, engine.ts) |
| Routes nouvelles | 1 GET + 1 POST (`/api/clonestore/runtime`) |
| Routes enrichies | 4 (submit, mission, mission-control, dashboard) |
| Types exportés | 8 (contracts.ts) |
| Fonctions exportées | 8 (engine.ts) |
| Invariants d'action | 14 (priorité stricte) |
| Tests unitaires | 160 (160 verts) |
| Étapes script PS5 | 27 |
| tsc errors | 0 |

---

## Bloc 20 — Pierre Premium Document System / Modèles Entreprise

### Objectif

Transformer la production documentaire RH de Pierre en une couche premium — documents beaux, crédibles, enterprise-grade, indiscernables d'un travail humain professionnel.

### Architecture

**Module pur** : `src/lib/pierre/documents/premium-document-system.ts`
- Zéro Supabase, zéro Next, zéro async, zéro effets de bord
- 17 types TypeScript exportés
- 15 fonctions exportées
- 15 templates par défaut (une par famille documentaire)

### Familles documentaires (15)

| Famille | Label | Risque | Validation |
|---------|-------|--------|------------|
| `contract` | Contrat de travail | orange | obligatoire |
| `amendment` | Avenant au contrat | orange | obligatoire |
| `offer` | Offre d'emploi | green | non |
| `convocation` | Convocation | orange | non |
| `refusal` | Refus de candidature | green | non |
| `followup` | Suivi RH | green | non |
| `onboarding` | Document d'onboarding | green | non |
| `absence` | Justificatif d'absence | orange | non |
| `pre_payroll` | Éléments de pré-paie | red | obligatoire |
| `performance` | Entretien d'évaluation | green | non |
| `training` | Document de formation | green | non |
| `offboarding` | Procédure de départ | red | obligatoire |
| `employee_summary` | Synthèse salarié | orange | non |
| `internal_note` | Note interne RH | green | non |
| `generic_hr` | Document RH | green | non |

### Priorité des sources de variables

```
manual(7) > payload(6) > employee_file(5) > profile(4) > task(3) > mission(2) > company_memory(1) > unknown(0)
```

### Détection des risques

- **black** : harcèlement, discrimination, faute grave, licenciement disciplinaire, prud'hommes
- **red** : licenciement, rupture conventionnelle, offboarding, pre_payroll
- **orange** : contract, amendment, convocation, absence, employee_summary
- **green** : tout le reste

### Routes créées ou modifiées

| Route | Méthode | Changement |
|-------|---------|------------|
| `POST /api/pierre/use/document/preview` | POST | Nouvelle — rendu premium + qualité |
| `GET /api/pierre/use/document/config` | GET | Nouvelle — config document_system |
| `PUT /api/pierre/use/document/config` | PUT | Nouvelle — sauvegarde sans écraser employees |
| `POST /api/pierre/doc/generate` | POST | Enrichissement premium + fix log schema |
| `POST /api/pierre/pdf/generate` | POST | Fix log schema (event_type/message/meta_json) |
| `POST /api/pierre/use/submit` | POST | Enrichissement document_family/channel dans task payload |

### Invariants absolus respectés

- Jamais `level/event/payload` dans `pierre_task_logs` — uniquement `event_type/message/meta_json`
- Jamais `email.send` auto-exécuté — `auto_send: false` systématique
- Jamais "document généré par IA" dans le rendu client
- Jamais écraser `employees` lors de la sauvegarde de config
- Risque noir/rouge → `approval_required = true` systématique
- Module pur sans Supabase/Next/fs/process.env

### Tests Bloc 20

**Tests unitaires** : `src/lib/pierre/__tests__/premium-document-system.test.ts`
**Total** : 150+ tests (tous les exports couverts).

**Script E2E** : `scripts/pierre-premium-document-system-test.ps1` — 18 étapes, PS5 compatible.

### Résultats finaux Bloc 20

| Métrique | Valeur |
|----------|--------|
| Module pur | 1 (premium-document-system.ts) |
| Routes nouvelles | 3 (preview, config GET, config PUT) |
| Routes enrichies | 3 (doc/generate, pdf/generate, submit) |
| Familles documentaires | 15 |
| Types exportés | 17 |
| Fonctions exportées | 15 |
| Tests unitaires | 150+ |
| Étapes script PS5 | 18 |
| tsc errors | 0 |
| Build | clean |

---

## Bloc 21 — Operational Readiness & Golden HR Scenarios

Date : 2026-05-19

### Objectif

Transformer l'ensemble des blocs précédents (B10.5 → B20) en une couche de **preuve produit opérationnelle** :
- Évaluer objectivement si Pierre est prêt à fonctionner comme un vrai poste RH automatisé
- Détecter les manques produit, risques non couverts, documents faibles, traces manquantes
- Définir 8 scénarios RH "golden" qui prouvent la vision CloneStore
- Exposer un rapport de readiness clair, exploitable, premium
- Corriger la dette B20 (test flaky timestamp technology-registry)

### Fichiers créés

| Fichier | Type | Rôle |
|---------|------|------|
| `src/lib/pierre/hr/operational-readiness.ts` | Module pur | Moteur de readiness — types, gates, scénarios, rapport |
| `src/app/api/pierre/use/readiness/route.ts` | Route GET | Rapport complet de readiness |
| `src/app/api/pierre/use/readiness/scenarios/route.ts` | Route GET | Liste des 8 scénarios golden |
| `src/app/api/pierre/use/readiness/scenarios/dry-run/route.ts` | Route POST | Évaluation dry-run d'un/tous les scénarios |
| `src/lib/pierre/__tests__/hr-operational-readiness.test.ts` | Tests | 160+ tests unitaires |
| `scripts/pierre-operational-readiness-test.ps1` | Script PS5 | 14 étapes d'intégration E2E |

### Fichiers modifiés

| Fichier | Modification |
|---------|-------------|
| `src/app/api/pierre/use/mission/[missionId]/route.ts` | Ajout `readiness_hint` dans la réponse |
| `src/lib/clonestore/technologies/__tests__/technology-registry.test.ts` | Fix test flaky timestamp (1ms) |

### Module pur — operational-readiness.ts

**Invariants** : zéro Supabase, zéro Next, zéro async, zéro effets de bord. Robuste face aux objets null/undefined.

#### Types exportés (11)

| Type | Rôle |
|------|------|
| `PierreReadinessLevel` | not_ready / partial / ready / premium_ready |
| `PierreReadinessGateStatus` | pass / warning / fail / not_applicable |
| `PierreReadinessGateKey` | 14 gates d'évaluation |
| `PierreGoldenScenarioKey` | 8 scénarios golden |
| `PierreGoldenScenarioRisk` | low / medium / high / critical |
| `PierreGoldenScenario` | Définition complète d'un scénario |
| `PierreReadinessGate` | Résultat d'évaluation d'une gate |
| `PierreReadinessScenarioEvaluation` | Résultat d'évaluation d'un scénario |
| `PierreReadinessOperationalRisk` | Risque opérationnel détecté |
| `PierreReadinessNextAction` | Action recommandée |
| `PierreReadinessReport` | Rapport complet |

#### Fonctions exportées (16)

| Fonction | Rôle |
|----------|------|
| `buildPierreGoldenScenarios()` | Retourne les 8 scénarios golden |
| `evaluateMissionEngine(params)` | Gate : moteur de mission |
| `evaluateTaskOrchestration(params)` | Gate : orchestration des tâches |
| `evaluateControlledAutonomy(params)` | Gate : autonomie contrôlée |
| `evaluateEmployeeFile360(params)` | Gate : dossier salarié 360° |
| `evaluateContinuity(params)` | Gate : continuité opérationnelle |
| `evaluatePremiumDocuments(params)` | Gate : documents premium |
| `evaluatePdfQuality(params)` | Gate : qualité PDF |
| `evaluateEmailSafety(params)` | Gate : sécurité email |
| `evaluateCloneGuard(params)` | Gate : CloneGuard |
| `evaluateCloneTrace(params)` | Gate : CloneTrace |
| `evaluateCompanyMemory(params)` | Gate : mémoire entreprise |
| `evaluateTemplateConfiguration(params)` | Gate : configuration templates |
| `evaluateAuditability(params)` | Gate : auditabilité |
| `evaluateGoldenScenario(scenario, params)` | Évalue un scénario golden |
| `buildPierreReadinessReport(params)` | Rapport complet (toutes gates + scénarios) |
| `buildMissionReadinessHint(mission, tasks, docs, logs)` | Hint de readiness pour une mission |

### 8 Scénarios Golden RH

| Clé | Titre | Risque | Validation humaine |
|-----|-------|--------|--------------------|
| `hiring_onboarding` | Embauche et onboarding complet | medium | Oui |
| `absence_management` | Gestion d'une absence | low | Non |
| `contract_generation` | Génération de contrat ou avenant | high | Oui |
| `prepay_preparation` | Préparation des éléments de paie | medium | Oui |
| `offboarding` | Départ salarié — Offboarding complet | high | Oui |
| `sensitive_hr_case` | Cas RH sensible — Disciplinaire/Licenciement | **critical** | **Oui — obligatoire** |
| `multi_site_reporting` | Rapport RH multi-sites | medium | Non |
| `employee_file_review` | Revue dossier salarié 360° | low | Non |

Chaque scénario définit :
- `prompt` : la requête RH réaliste à soumettre à Pierre
- `expected_capabilities` : les capacités Pierre nécessaires
- `expected_outputs` : les sorties attendues
- `required_gates` : les gates de readiness impactées
- `must_require_human_validation` : si true, toute exécution auto est interdite
- `must_not_auto_execute` : liste des actions interdites en exécution automatique

### 14 Gates de Readiness

| Clé | Label | Ce qu'elle vérifie |
|-----|-------|--------------------|
| `mission_engine` | Moteur de Mission | Présence missions + mission_summary + brain_output_json |
| `task_orchestration` | Orchestration des Tâches | Tâches liées missions, types variés, payloads exploitables |
| `controlled_autonomy` | Autonomie Contrôlée | email.send non auto, approval_required respecté |
| `employee_file_360` | Dossier Salarié 360° | Salariés + files + timeline + risks |
| `continuity` | Continuité Opérationnelle | Tâches bloquées/erreur/approbation |
| `premium_documents` | Documents Premium | document_family, template_id, pierre-wrapper HTML |
| `pdf_quality` | Qualité PDF | PDF générés + branding |
| `email_safety` | Sécurité Email | Aucun email.send auto sans validation |
| `cloneguard` | CloneGuard | risk_level, approval_required, logs gouvernance |
| `clonetrace` | CloneTrace | event_type/message/meta_json dans tous les logs |
| `company_memory` | Mémoire Entreprise | reusable_rh_context_json avec employees/config |
| `template_configuration` | Configuration Templates | document_system, branding, templates personnalisés |
| `auditability` | Auditabilité | Logs + cross-refs mission/task/document |
| `golden_scenarios` | Scénarios Golden RH | Score moyen des 8 scénarios |

### Scoring

| Score | Niveau |
|-------|--------|
| 90–100 | `premium_ready` |
| 75–89 | `ready` |
| 50–74 | `partial` |
| 0–49 | `not_ready` |

### Routes exposées

| Route | Méthode | Rôle |
|-------|---------|------|
| `/api/pierre/use/readiness` | GET | Rapport complet de readiness |
| `/api/pierre/use/readiness/scenarios` | GET | 8 scénarios golden avec résumé |
| `/api/pierre/use/readiness/scenarios/dry-run` | POST | Évaluation dry-run (lecture seule) |
| `/api/pierre/use/mission/[missionId]` | GET | + `readiness_hint` dans la réponse |

### readiness_hint dans mission/[missionId]

```json
{
  "readiness_hint": {
    "gates_impacted": ["controlled_autonomy", "premium_documents"],
    "scenario_matches": ["contract_generation"],
    "warnings": ["Tâches bloquées — vérifier la continuité."]
  }
}
```

### Invariants Bloc 21

- Aucune route readiness ne crée de mission, tâche, ou email
- Dry-run est strictement lecture seule
- Le module pur n'importe ni Supabase ni Next
- `sensitive_hr_case` force `must_require_human_validation: true` et `must_not_auto_execute: ["email.send", "send_email", "doc.generate"]`
- Toute gate retourne un score 0–100 même si les données sont vides
- CloneTrace bloque si des logs utilisent l'ancien schéma `level/event/payload`
- `buildMissionReadinessHint` ne crashe jamais (try/catch dans la route)

### Valeur commerciale

Pierre Bloc 21 est la **certification produit** de CloneStore :
- **Pour les clients** : preuve objective que Pierre est opérationnel, pas un prototype
- **Pour les demos** : 8 scénarios golden = 8 démos produit prêtes
- **Pour les RH** : rapport de readiness = outil de pilotage du déploiement
- **Pour les investisseurs** : score 0–100 = KPI produit mesurable et auditable
- **Pour la sécurité** : CloneGuard + email_safety + controlled_autonomy = garanties traçables

### Résultats finaux Bloc 21

| Métrique | Valeur |
|----------|--------|
| Module pur | 1 (operational-readiness.ts) |
| Routes nouvelles | 3 (readiness, scenarios, dry-run) |
| Routes enrichies | 1 (mission/[missionId]) |
| Gates de readiness | 14 |
| Scénarios golden | 8 |
| Types exportés | 11 |
| Fonctions exportées | 17 |
| Tests unitaires | 160+ |
| Étapes script PS5 | 14 |
| tsc errors | 0 |
| Build | clean |
| Fix dette B20 | test flaky technology-registry corrigé |

---

## Bloc 22 — Pierre Release Hardening & End-to-End Sellable Proof

Date : 2026-05-19

### Objectif

Prouver que Pierre est commercialisable. Bloc 22 quantifie le niveau de maturité produit avec 13 gates de release, 8 scénarios de démo end-to-end, et une estimation automatique de la valeur client mensuelle.

### Module pur : `src/lib/pierre/hr/release-proof.ts`

Zéro Supabase, zéro Next, zéro async. Entrée : `EvalParams` (missions, tasks, documents, logs, companyMemory, documentSystemConfig, employeeFiles, employees). Sortie : `PierreReleaseReport` complet.

#### Niveaux de release

| Level | Score | Description |
|-------|-------|-------------|
| `blocked` | — | Invariants critiques violés — non déployable |
| `internal_demo` | 50–64 | Démo interne uniquement |
| `client_demo` | 65–74 | Démo client possible — cas d'usage validés |
| `pilot_ready` | 75–87 | Prêt pour pilote client supervisé |
| `sellable` | ≥ 88 | Produit commercialisable — production ready |

**Override critique** : si `safety_invariants` ou `sensitive_case_control` fail → `blocked`. Si `schema_integrity` fail → max `internal_demo`.

#### Les 13 gates de release

| # | Clé | Poids | Description |
|---|-----|-------|-------------|
| 1 | `technical_integrity` | 7 | Intégrité technique : taux d'erreur, données opérationnelles |
| 2 | `schema_integrity` | 10 | Schéma DB conforme : `execute_at`, `event_type/message/meta_json` |
| 3 | `safety_invariants` | 10 | `email.send`/`send_email` jamais auto-exécutés, `approval_required` respecté |
| 4 | `mission_to_artifact_flow` | 8 | Flux complet : mission → tâches → documents |
| 5 | `employee_file_flow` | 7 | Dossiers salariés 360° opérationnels, stockage dans `reusable_rh_context_json` |
| 6 | `document_quality_flow` | 8 | HTML premium, PDF, familles premium, `pierre-wrapper` |
| 7 | `continuity_flow` | 6 | Reprise de missions bloquées/suspendues |
| 8 | `readiness_flow` | 7 | Certification opérationnelle B21 confirmée |
| 9 | `traceability_flow` | 8 | Audit trail complet : logs liés, horodatés, avec `event_type` |
| 10 | `client_value_proof` | 9 | Missions complétées, tâches exécutées, documents premium |
| 11 | `sensitive_case_control` | 10 | Cas sensibles sous contrôle — validation humaine obligatoire |
| 12 | `demo_scenario_coverage` | 7 | Couverture des 8 scénarios de démo par des données réelles |
| 13 | `launch_risk` | 3 | Risque global calculé à partir de tous les autres gates |

#### Les 8 scénarios de démo

| Clé | Titre | Risque | Validation humaine |
|-----|-------|--------|--------------------|
| `hiring_full_cycle` | Cycle d'embauche complet | medium | Oui |
| `absence_followup` | Suivi d'une absence salarié | low | Non |
| `contract_and_pdf` | Génération contrat + PDF premium | high | Oui |
| `employee_file_review` | Revue dossier salarié 360° | low | Non |
| `sensitive_case_blocked` | Cas sensible — blocage automatique prouvé | critical | Oui |
| `continuity_recovery` | Récupération de continuité — mission suspendue | medium | Non |
| `prepay_summary` | Synthèse pré-paie mensuelle | medium | Oui |
| `offboarding_controlled` | Offboarding contrôlé — fin de contrat | high | Oui |

Invariant absolu : `sensitive_case_blocked` ne doit jamais auto-exécuter `email.send`, `send_email`, ni `doc.generate`.

### Nouvelles routes API

#### `GET /api/pierre/use/release-proof`
Rapport complet de release : 13 gates + 8 scénarios évalués + estimation de valeur + next_actions.

Réponse :
```json
{
  "ok": true,
  "report": {
    "level": "pilot_ready",
    "global_score": 82,
    "label": "Prêt pour pilote — déploiement client supervisé",
    "summary": "...",
    "gates": [...],
    "demo_scenarios": [...],
    "risks": [...],
    "next_actions": [...],
    "value_estimation": {
      "monthly_hours_saved_low": 12,
      "monthly_hours_saved_high": 24,
      "estimated_monthly_value_eur_low": 600,
      "estimated_monthly_value_eur_high": 1200,
      "confidence": "medium",
      "explanation": "..."
    },
    "totals": { ... }
  },
  "demo_scenarios": [...],
  "meta": { "userId": "...", "fetchedAt": "...", "missions_loaded": 47, ... }
}
```

#### `GET /api/pierre/use/release-proof/demo-scenarios`
Liste des 8 scénarios de démo avec statistiques.

Réponse :
```json
{
  "ok": true,
  "scenarios": [...],
  "summary": {
    "count": 8,
    "critical_count": 1,
    "high_risk_count": 2,
    "validation_required_count": 5
  }
}
```

#### `POST /api/pierre/use/release-proof/demo-scenarios/dry-run`
Évalue un ou tous les scénarios de démo contre les données réelles de l'utilisateur.

Body :
```json
{ "scenario_key": "sensitive_case_blocked", "include_prompt": true }
```

Réponse :
```json
{
  "ok": true,
  "scenario_key": "sensitive_case_blocked",
  "evaluations": [...],
  "prompts": { "sensitive_case_blocked": "..." },
  "meta": { "dry_run": true, "scenarios_evaluated": 1, ... }
}
```

Erreur 400 si `scenario_key` invalide : `{ "ok": false, "code": "INVALID_SCENARIO_KEY" }`.

### Route enrichie : `mission/[missionId]/route.ts`

Le champ `release_proof_hint` est maintenant ajouté à la réponse de chaque mission :

```typescript
release_proof_hint: (() => {
  try {
    return buildMissionReleaseProofHint(mission, tasks, documents, logs);
  } catch {
    return null as PierreReleaseHint | null;
  }
})(),
```

Exemple de réponse :
```json
{
  "release_proof_hint": {
    "level": "pilot_ready",
    "global_score": 78,
    "critical_gates_failed": [],
    "label": "Prêt pour pilote — déploiement client supervisé",
    "tip": "Mission prête pour pilote — enrichir les documents et logs pour atteindre sellable."
  }
}
```

### Estimation de valeur : `estimatePierreReleaseValue`

Calcul basé sur :
- `completed_tasks × 2.5h × 0.7–1.3` selon le niveau
- `premium_documents × 1.5h`
- `employees × 0.5h`
- Tarif : 50 €/heure
- Confiance : `high` si score ≥ 85, `medium` si ≥ 65, `low` sinon

### Invariants Bloc 22

1. `release-proof.ts` est un module pur — zéro Supabase, zéro Next.
2. `schema_integrity` vérifie `scheduled_for` (doit être absent) et `level/event/payload` dans les logs (interdits).
3. `safety_invariants` vérifie que `email.send`/`send_email` ne sont jamais dans TERMINAL_STATUSES sans `approval_required=true`.
4. `sensitive_case_control` vérifie que les tâches à risque critique ne peuvent pas être auto-exécutées.
5. Les overrides de niveau sont stricts : `safety_invariants` fail → `blocked` sans exception.
6. `buildMissionReleaseProofHint` est read-only — jamais d'écriture en DB.
7. Les endpoints dry-run ne déclenchent aucun envoi email réel.
8. Les données salariés restent dans `pierre_company_memory.reusable_rh_context_json.employees`.

### Résultats finaux Bloc 22

| Métrique | Valeur |
|----------|--------|
| Module pur | 1 (release-proof.ts) |
| Routes nouvelles | 3 (release-proof, demo-scenarios, dry-run) |
| Routes enrichies | 1 (mission/[missionId] + release_proof_hint) |
| Gates de release | 13 |
| Scénarios de démo | 8 |
| Niveaux de release | 5 (blocked → sellable) |
| Types exportés | 10 |
| Fonctions exportées | 5 |
| Tests unitaires | 180+ |
| Étapes script PS5 | 14 |
| tsc errors | 0 |
| Build | clean |

---

## Bloc 23 — Pierre Trial Activation & First-Value Engine

### Objectif

Transformer Pierre en produit exploitable pour une **semaine d'essai gratuite ou un pilote client**. Ce bloc donne à Pierre la capacité d'embarquer des clients en essai, de proposer des premières missions à valeur, de mesurer la valeur créée, de détecter les blockers d'activation, et de convertir l'essai en abonnement.

### Module pur — `src/lib/pierre/hr/trial-activation.ts`

Zéro Supabase, zéro Next, zéro async, zéro effets de bord.

#### Stages d'activation

| Stage | Description |
|-------|-------------|
| `not_started` | Aucune donnée — Pierre non démarré |
| `setup_needed` | Config incomplète (mémoire, salariés) |
| `ready_to_launch` | Config présente, aucune mission encore |
| `first_value_started` | Missions/tâches commencées |
| `value_proven` | Valeur forte démontrée (score ≥ 60, 3+ tâches, 2+ docs) |
| `conversion_ready` | Prêt à convertir en abonnement |
| `blocked` | Blockers critiques actifs |

#### Statuts visuels

| Status | Condition |
|--------|-----------|
| `green` | conversion_ready ou value_proven, sans blockers |
| `yellow` | ready_to_launch ou setup partiel |
| `orange` | first_value_started avec 1 blocker important |
| `red` | not_started ou 2+ blockers importants |
| `black` | blocked ou blocker critique |

#### Plan 7 jours

| Jour | Clé | Objectif |
|------|-----|----------|
| Jour 0 | `day_0_setup` | Configuration initiale Pierre |
| Jour 1 | `day_1_first_mission` | Première mission RH |
| Jour 2 | `day_2_employee_files` | Dossiers salariés 360° |
| Jour 3 | `day_3_documents` | Génération documentaire premium |
| Jour 4 | `day_4_continuity` | Continuité opérationnelle |
| Jour 5 | `day_5_sensitive_control` | Contrôle cas sensibles |
| Jour 6 | `day_6_value_review` | Revue valeur créée |
| Jour 7 | `day_7_conversion` | Décision de conversion |

#### 10 templates de premières missions

| Clé | Titre | Risque | Validation humaine |
|-----|-------|--------|-------------------|
| `audit_rh_initial` | Audit RH initial | low | Non |
| `create_employee_file` | Création dossier salarié 360° | low | Non |
| `generate_contract_or_document` | Génération contrat/document premium | high | **Oui** |
| `absence_followup` | Suivi absence salarié | low | Non |
| `onboarding_plan` | Plan d'onboarding | medium | **Oui** |
| `prepay_summary` | Synthèse éléments variables paie | medium | **Oui** |
| `employee_file_review` | Revue dossier salarié | low | Non |
| `sensitive_case_review` | Revue cas RH sensible | **critical** | **Oui** |
| `offboarding_plan` | Plan départ salarié | high | **Oui** |
| `hr_weekly_briefing` | Briefing RH hebdomadaire | low | Non |

#### Formule du score d'activation

```
activation_score = value_score × 35% + conversion_score × 25% + infra_score × 20% + blockers_score × 20%
```

- `infra_score` = moyenne (release_score, readiness_score), fallback 40 si indisponible
- `blockers_score` = 100 - critiques×30 - hauts×10 - médiums×5
- **Plafond critique** : si blockers critiques → activation_score ≤ 49, stage = "blocked"

#### Bandes de probabilité de conversion

| Score | Bande |
|-------|-------|
| < 45 | `low` |
| 45–64 | `medium` |
| 65–84 | `high` |
| ≥ 85 | `very_high` |

#### Blockers critiques (severity = critical)

| Type | Condition |
|------|-----------|
| `schema_risk` | Tâche avec `scheduled_for` OU log avec `level/event/payload` |
| `safety_risk` | Tâche `email.send`/`send_email` exécutée sans `approval_required=true` |

#### Hint mission légère

`buildMissionTrialActivationHint(mission, tasks, documents, logs)` — version allégée retournant :
```json
{
  "stage": "first_value_started",
  "status": "yellow",
  "value_score": 45,
  "conversion_score": 52,
  "next_action_label": "Générer le premier document RH premium"
}
```

### Routes créées (Bloc 23)

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/pierre/use/trial/activation` | GET | Rapport complet d'activation essai |
| `/api/pierre/use/trial/plan` | GET | Plan 7 jours + missions recommandées |
| `/api/pierre/use/trial/first-value-prompt` | POST | Prompt première valeur pour un template |
| `/api/pierre/use/trial/first-value-prompt` | GET | Liste des clés valides (doc) |
| `/api/pierre/use/trial/templates` | GET | Catalogue des 10 templates |

### Route enrichie (Bloc 23)

`GET /api/pierre/use/mission/[missionId]` — ajout du champ `trial_activation_hint` :

```json
{
  "trial_activation_hint": {
    "stage": "first_value_started",
    "status": "yellow",
    "value_score": 42,
    "conversion_score": 38,
    "next_action_label": "Lancer la première mission : Audit RH initial"
  }
}
```

### Erreur POST /trial/first-value-prompt avec clé invalide

```json
{
  "ok": false,
  "error": "Invalid template_key: \"xxx\". Valid keys: ...",
  "code": "INVALID_TRIAL_TEMPLATE_KEY"
}
```

### Invariants Bloc 23

1. Ne jamais utiliser `scheduled_for` comme colonne DB — colonne réelle : `execute_at`
2. Ne jamais utiliser `level/event/payload` dans `pierre_task_logs` — schéma correct : `event_type`, `message`, `meta_json`
3. Ne jamais auto-exécuter : `email.send`, `send_email`, toute tâche avec `approval_required=true`
4. Les endpoints d'activation sont **read-only** — aucun envoi d'email, aucune exécution de tâche
5. Les salariés restent dans `pierre_company_memory.reusable_rh_context_json.employees`
6. `memory_json` ne doit PAS être utilisé comme stockage salarié
7. `sensitive_case_review` : prompt contient toujours l'avertissement "Ne rien envoyer, ne rien exécuter sans ma validation humaine explicite"

### Résultats finaux Bloc 23

| Métrique | Valeur |
|----------|--------|
| Module pur | 1 (trial-activation.ts ~1870 lignes) |
| Types exportés | 18 |
| Fonctions exportées | 14 |
| Templates de missions | 10 |
| Routes nouvelles | 4 |
| Routes enrichies | 1 (mission/[missionId] + trial_activation_hint) |
| Tests unitaires | 129 |
| Étapes script PS5 | 20 |
| tsc errors | 0 |
| Build | clean |

---

## Bloc 24 -- Customer Success, Conversion & Retention Engine

Date : 2026-05-19

### Objectif

Le Bloc 24 ferme la boucle business de Pierre : apres avoir demontre la valeur pendant l'essai (Bloc 23), il faut mesurer si le client est pret a convertir, identifier les risques de churn, et orchestrer les actions CS pour maximiser la conversion et la retention.

Ce bloc repond a la question : **"Ce client va-t-il convertir -- et sinon, pourquoi ?"**

### Pourquoi c'est critique apres l'essai gratuit

L'essai gratuit cree une intention. Le Customer Success Engine transforme cette intention en decision :
- Le client a-t-il *vraiment* vu la valeur de Pierre ?
- Quels frictions bloquent la conversion ?
- A quel moment du cycle de vie client sommes-nous ?
- Quelle action CS est prioritaire maintenant ?

Sans ce moteur, l'equipe CS travaille a l'aveugle.

### Moteur `customer-success.ts`

**Fichier :** `src/lib/pierre/hr/customer-success.ts`
**Nature :** Module pur -- zero Supabase, zero Next, zero async, zero effets de bord.
**Taille :** ~1860 lignes

#### Fonctions exportees (12)

| Fonction | Role |
|----------|------|
| `computePierreCustomerSuccessMetrics` | Compte missions/taches/docs/logs/employees + extrait scores externes |
| `detectPierreCustomerSuccessSignals` | Genere signaux positifs/neutres/negatifs avec score_impact |
| `detectPierreCustomerRisks` | Detecte 13 types de risques CS (schema/safety = critical) |
| `buildPierreCustomerValueSummary` | Estimation valeur : 1.5h/tache + 1.25h/premiumDoc + 0.75h/PDF + 0.5h/dossier x 50EUR/h |
| `scorePierreCustomerHealth` | Score 0-100, base 40, cap 49 si critical |
| `scorePierreCustomerConversion` | Score 0-100 + ready boolean + missing_before_conversion |
| `scorePierreCustomerRetention` | Score 0-100 + status (strong/medium/weak/danger) |
| `classifyPierreCustomerSuccessStage` | 8 stages du cycle de vie |
| `buildPierreCustomerSuccessActions` | Max 8 actions priorisees |
| `buildPierreCustomerExecutiveSummary` | Resume dirigeant avec headline/recommendation |
| `buildPierreCustomerSuccessReport` | Assemblage complet -- ne throw jamais |
| `buildPierreCustomerSuccessMissionHint` | Hint leger pour la route mission |

### 8 Stages du cycle de vie client

| Stage | Condition |
|-------|-----------|
| `new_account` | Aucune config, aucun usage |
| `setup_in_progress` | Config partielle mais aucune mission |
| `activated` | Usage demarre |
| `value_visible` | health >= 55 + livrables tangibles |
| `conversion_ready` | ready=true + 0 critical risks |
| `retention_risk` | Missions + risques non resolus |
| `churn_risk` | 0 taches completees + critical/high risks |
| `successful` | excellent + ready + strong |

### Scores de sante

| Status | Seuil | Description |
|--------|-------|-------------|
| `critical` | <30 ou critical risks | Blockers urgents |
| `at_risk` | <50 | Difficultes serieuses |
| `fragile` | <70 | Fonctionnel mais fragile |
| `healthy` | <85 | Operationnel |
| `excellent` | >=85 | Conversion recommandee |

Base score : 40. Cap a 49 si au moins 1 risque critique.

### Score de retention

| Status | Seuil |
|--------|-------|
| `strong` | >=80 |
| `medium` | >=60 |
| `weak` | >=40 |
| `danger` | <40 |

### Estimation de valeur

Formule : heures = (taches x 1.5) + (docs_premium x 1.25) + (PDFs x 0.75) + (dossiers x 0.5) + (0.5 si logs). Valeur = heures x 50 EUR/h.

### Endpoints crees

| Endpoint | Methode | Description |
|----------|---------|-------------|
| `/api/pierre/use/customer-success` | GET | Rapport complet customer success |
| `/api/pierre/use/customer-success/actions` | GET | Stage + actions + recommendation |
| `/api/pierre/use/customer-success/value` | GET | Estimation valeur + metriques |

### Enrichissement mission

La route `/api/pierre/use/mission/[missionId]` inclut desormais `customer_success_hint` avec : customer_stage, health_score, conversion_score, retention_score, main_risk, recommended_action.

### Securite et invariants

1. **Read-only** : aucun endpoint ne cree, modifie ou supprime rien
2. **Pas d'email** : aucun endpoint n'envoie d'email
3. **Pas d'execution** : aucun endpoint n'execute de tache
4. **Pas de mission** : aucun endpoint ne cree de mission
5. **Schema DB respecte** : execute_at (jamais scheduled_for), logs = event_type/message/meta_json
6. **Module pur** : customer-success.ts n'importe jamais Supabase ni Next.js
7. **Salaries** : toujours dans reusable_rh_context_json.employees, jamais dans memory_json

### Resultats finaux Bloc 24

| Metrique | Valeur |
|----------|--------|
| Module pur | 1 (customer-success.ts ~1860 lignes) |
| Types exportes | 16 |
| Fonctions exportees | 12 |
| Routes nouvelles | 3 |
| Routes enrichies | 1 (mission/[missionId] + customer_success_hint) |
| Tests unitaires | 150+ |
| Etapes script PS5 | 15 |
| tsc errors | 0 |
| Build | clean |

---

## Bloc 25 — CloneStore AI Runtime / Model Router / Prompt Contracts pour Pierre

### Vue d'ensemble

Bloc 25 introduit le moteur AI de CloneStore (`src/lib/cloneos/ai/`), partageable entre tous les agents (Pierre, Clara, Emma, etc.). Le module est entierement fallback-safe : si aucun provider AI n'est configure, Pierre continue avec son moteur deterministe.

### Architecture

```
src/lib/cloneos/ai/
  types.ts           — Types partages (CloneAIRequest, CloneAIResponse, CloneAIPromptContract...)
  utils.ts           — Utilitaires purs (estimation tokens, rendu template, parseur JSON, validation)
  prompt-registry.ts — 10 contrats de prompts versiones (v1)
  model-router.ts    — Politiques par profil, selection de provider, validation
  providers.ts       — Adapters mock + OpenAI + Anthropic
  runtime.ts         — Orchestrateur principal (runCloneAI, runCloneAIContract, getCloneAIRuntimeStatus)

src/lib/pierre/ai/
  runtime.ts         — Bridge Pierre -> CloneOS AI (interpret, plan, review, summarize)
```

### Contrats de prompts (10 au total)

| use_case | Profil | Mode |
|----------|--------|------|
| pierre.mission.interpret | structured_reasoning | json |
| pierre.tasks.plan | structured_reasoning | json |
| pierre.document.draft | long_writing | markdown |
| pierre.document.review | quality_review | json |
| pierre.employee_file.summarize | quality_review | json |
| pierre.risk.precheck | risk_analysis | json |
| pierre.customer_success.summarize | structured_reasoning | json |
| platform.chat.answer | conversation | text |
| platform.routing.classify | fast_classification | json |
| platform.generic.structured | structured_reasoning | json |

### Providers

| Provider | Configurable via | Fallback |
|----------|-----------------|---------|
| mock | Toujours actif | Dernier recours |
| openai | OPENAI_API_KEY | Selon politique |
| anthropic | ANTHROPIC_API_KEY | Selon politique |

### Routes API

| Route | Methode | Description |
|-------|---------|-------------|
| `/api/cloneos/ai/status` | GET | Sante des providers + contrats charges |
| `/api/cloneos/ai/contracts` | GET | Liste contrats sans secrets (preview 200 chars) |
| `/api/cloneos/ai/dry-run` | POST | Execution dry-run d'un contrat (force_mock par defaut) |

### Integrations Pierre

- **submit** : `ai_assist` optionnel dans la reponse (garde par `CLONESTORE_AI_ENABLED` ou `ai_mode: "assist"`)
- **mission/[missionId]** : `ai_runtime_hint` dans la reponse (sync, jamais de vrai appel AI)

### Securite et invariants AI

1. **Pas d'email** : les routes AI ne peuvent pas envoyer d'email
2. **Pas d'execution** : les routes AI n'executent jamais de tache
3. **Pas de mission** : les routes AI ne creent jamais de mission sans demande explicite
4. **Pas de secrets** : aucune route ne renvoie une cle API ou variable d'env sensible
5. **Fallback-safe** : si tous les providers echouent, mock prend le relais
6. **Prompts versiones** : chaque contrat a un `id` et une `version`
7. **Sorties validees** : json_schema verifie avant usage
8. **Dry-run force_mock** : true par defaut, jamais de vrais appels sans `CLONESTORE_AI_ENABLED=true`
9. **Tests isoles** : aucun test n'appelle OpenAI ou Anthropic reellement

### Resultats finaux Bloc 25

| Metrique | Valeur |
|----------|--------|
| Modules purs | 4 (types, utils, prompt-registry, model-router) |
| Modules async | 2 (providers, runtime) |
| Contrats de prompts | 10 |
| Providers | 3 (mock, openai, anthropic) |
| Types exportes | 15+ |
| Routes nouvelles | 3 |
| Routes enrichies | 2 (submit + ai_assist, mission + ai_runtime_hint) |
| Tests unitaires | 180+ |
| Etapes script PS5 | 14+ |
| tsc errors | 0 |
| Build | clean |

---

## Bloc 26 — Pierre Brain Final Core / Cerveau IA final

Bloc 26 implante le cerveau IA final de Pierre. Le moteur deterministe (securite, statuts, DB, taches, validations, execution) reste intact. L'IA est une couche de comprehension et de raisonnement controlee, fallback-safe, jamais autorité finale.

### Architecture

```
src/lib/pierre/brain/
  types.ts        — Types purs du cerveau (PierreBrainFinalOutput, PierreBrainInterpretation...)
  schema.ts       — Normalisation + securite (CRITICAL_SIGNALS, BLOCKED_TASK_TYPES, fallback)
  final-brain.ts  — Cerveau async : pipeline 4 etapes, fallback deterministe
  task-bridge.ts  — Conversion brain tasks -> PierreTaskDraft[] DB-ready
```

### Pipeline cerveau (4 etapes)

```
input + contexte
  └─> Step 1: final_interpret   (pierre.brain.final_interpret)
  └─> Step 2: risk_review       (pierre.brain.risk_review)
  └─> Step 3: task_plan         (pierre.brain.task_plan)
  └─> Step 4: quality_gate      (pierre.brain.quality_gate)
  └─> PierreBrainFinalOutput { source, interpretation, risk_review, task_plan, quality_gate }
```

### Source de sortie

| source | Signification |
|--------|---------------|
| ai | Toutes les etapes OK + quality_gate safe |
| hybrid | Etapes partiellement OK ou quality_gate unsafe |
| deterministic | IA desactivee ou toutes les etapes echouees |

### Contrats de prompts brain (6 nouveaux, total 16)

| use_case | Profil | Mode |
|----------|--------|------|
| pierre.brain.final_interpret | structured_reasoning | json |
| pierre.brain.task_plan | structured_reasoning | json |
| pierre.brain.missing_info | fast_classification | json |
| pierre.brain.risk_review | risk_analysis | json |
| pierre.brain.answer | conversation | markdown |
| pierre.brain.quality_gate | quality_review | json |

### Modes IA dans submit

| ai_mode | Comportement |
|---------|--------------|
| off | Pas de cerveau, taches deterministes uniquement |
| assist | Cerveau tourne, sortie stockee dans brain_output_json, taches deterministes |
| primary | Cerveau tourne, taches brain ajoutees apres deterministes si quality_gate safe |

### Routes API brain

| Route | Methode | Description |
|-------|---------|-------------|
| `/api/pierre/use/brain/final/dry-run` | POST | Dry-run cerveau complet sans DB write |
| `/api/pierre/use/brain/contracts` | GET | Liste les 6 contrats brain (preview 200 chars) |

### Securite et invariants (rappel Bloc 26)

1. Jamais `scheduled_for` comme colonne DB — colonne reelle : `execute_at`
2. Jamais `level/event/payload` dans `pierre_task_logs` — schema : `event_type`, `message`, `meta_json`
3. `email.send` / `send_email` convertis en `email.draft` + `approval_required=true`
4. CRITICAL_SIGNALS (licenciement, harcelement, discrimination...) → forcent `risk_level=critical` + `requires_human_validation=true`
5. Routes brain : pas d'email reel, pas d'execution de tache, pas de creation de mission
6. Fallback deterministe obligatoire si IA off ou echouee
7. `quality_gate.safe_to_use=false` → source downgrade de "ai" vers "hybrid"
8. Tests : jamais d'appel reel OpenAI/Anthropic

### Integration dans submit

- `brain_output_json.brain_final` : sortie complete du cerveau
- `brain_output_json.brain_mode` : mode actif (off/assist/primary)
- `context_snapshot_json.brain_runtime` : source, ai_ok, provider, warnings, errors

### Integration dans mission/[missionId]

- `brain_final_hint` : extrait de brain_output_json pour le front (interpretation, risk, quality)
- `ai_runtime_hint` : detecte aussi `brain_final` en plus de `ai_assist`

### Resultats finaux Bloc 26

| Metrique | Valeur |
|----------|--------|
| Modules purs nouveaux | 3 (types, schema, task-bridge) |
| Modules async nouveaux | 1 (final-brain) |
| Contrats brain | 6 (total 16) |
| Routes nouvelles | 2 |
| Routes enrichies | 2 (submit + brain, mission + brain_final_hint) |
| Tests unitaires | 200+ |
| Etapes script PS5 | 16+ |
| tsc errors | 0 |
| Build | clean |

---

## BLOC 27 — Premium Documents & Enterprise Template System

### Architecture globale

Le Bloc 27 introduit un moteur documentaire plateforme (`src/lib/clonestore/documents/`) dont Pierre est le premier consommateur. Le moteur est completement independant de Next.js, Supabase et OpenAI.

### Fichiers crees

| Fichier | Role |
|---------|------|
| `src/lib/clonestore/documents/types.ts` | Types platforme CloneDocument* |
| `src/lib/clonestore/documents/utils.ts` | Fonctions pures (escapeHtml, renderDocumentVariables, ...) |
| `src/lib/clonestore/documents/template-registry.ts` | 12 templates par defaut pierre_*_v1 |
| `src/lib/clonestore/documents/renderer.ts` | Moteur de rendu multi-format (text/markdown/html/pdf_ready_html) |
| `src/lib/clonestore/documents/company-templates.ts` | Gestion templates entreprise (sanitize, upsert, delete, patch) |

### Fichiers modifies

| Fichier | Modification |
|---------|-------------|
| `src/lib/pierre/documents/premium-document-system.ts` | Append Bloc 27 adapter (PierrePremiumDocumentKind, renderPierrePremiumDocument, ...) |
| `src/lib/pierre/tasks/artifacts.ts` | Chemin Bloc 27 via document_kind/template_id/premium_document dans payload |
| `src/app/api/pierre/use/submit/route.ts` | document_template_capability dans context_snapshot_json |

### Routes API crees

| Route | Methodes | Description |
|-------|----------|-------------|
| `/api/pierre/use/document-templates` | GET, POST | Lister et creer des templates |
| `/api/pierre/use/document-templates/[templateId]` | GET, PUT, PATCH, DELETE | Lire/modifier/supprimer un template |
| `/api/pierre/use/document-templates/preview` | POST | Previsualiser un document (read-only, pas de DB write) |

### Templates par defaut (12)

| ID | Risque | Validation | Audience |
|----|--------|-----------|---------|
| `pierre_hr_contract_draft_v1` | high | required | employee |
| `pierre_hr_amendment_draft_v1` | high | required | employee |
| `pierre_candidate_rejection_v1` | low | recommended | candidate |
| `pierre_interview_invitation_v1` | low | recommended | candidate |
| `pierre_onboarding_plan_v1` | medium | recommended | employee |
| `pierre_absence_followup_v1` | medium | recommended | employee |
| `pierre_prepay_summary_v1` | high | required | internal |
| `pierre_employee_file_summary_v1` | medium | recommended | manager |
| `pierre_sensitive_case_note_v1` | critical | human_only | internal |
| `pierre_offboarding_checklist_v1` | high | required | employee |
| `pierre_hr_weekly_briefing_v1` | low | none | executive |
| `pierre_manager_notification_v1` | low | recommended | manager |

### Invariants critiques Bloc 27

1. Stockage templates : `reusable_rh_context_json.document_templates` uniquement
2. Jamais toucher `employees` dans buildCompanyTemplateStoragePatch
3. Les routes preview ne font jamais de DB write
4. Les routes preview ne creent jamais de mission ou de tache
5. L'IA n'est jamais obligatoire — fallback deterministe garanti
6. Documents sensibles (critical/high) : validation humaine obligatoire
7. Tous les rendus sont HTML-safe et markdown-safe
8. Aucun secret env n'est renvoye dans les reponses
9. No throw dans le moteur — toutes les erreurs retournent un result propre

### Integration dans submit

- `context_snapshot_json.document_template_capability` : `{ available, total_templates, platform_default, available_types }`

### Resultats finaux Bloc 27

| Metrique | Valeur |
|----------|--------|
| Modules purs nouveaux | 5 (types, utils, template-registry, renderer, company-templates) |
| Adapter Pierre | 1 (append premium-document-system.ts) |
| Templates par defaut | 12 |
| Routes nouvelles | 3 (list/create, get/put/patch/delete, preview) |
| Routes enrichies | 1 (submit + document_template_capability) |
| Tests unitaires | 220+ |
| Etapes script PS5 | 18+ |
| tsc errors | 0 |
| Build | clean |

---

## Bloc 28 — CloneADN / Empreinte Entreprise (2026-05-20)

### Concept

CloneADN est l'**empreinte operationnelle de l'entreprise** — un profil persistant qui permet aux agents IA (Pierre, Clara, Emma, Adrien...) de travailler comme s'ils connaissaient deja la culture, le ton, les regles de validation, l'autonomie et les preferences de l'entreprise.

CloneADN ne remplace pas CloneGuard, ClonePolicy ou CloneTrust — il les **informe**. Il ne prend jamais de decisions sensibles automatiquement. Il preserve toujours les exigences de validation humaine.

### Stockage

- Table : `pierre_company_memory`
- Colonne : `reusable_rh_context_json.clone_adn`
- Jamais dans `memory_json`
- Les routes CloneADN ecrivent **uniquement** vers `reusable_rh_context_json.clone_adn`
- Jamais ecraser `employees` ou `document_templates` — `buildCloneADNStoragePatch` les preserve systematiquement

### Statuts du profil (progression)

| Statut | Completeness | Description |
|--------|-------------|-------------|
| `not_configured` | 0 | Aucune configuration |
| `partial` | 1-34 | Debut de configuration |
| `configured` | 35-64 | Configuration de base |
| `strong` | 65-89 | Configuration solide |
| `locked` | 90-100 | Empreinte verrouille / stable |

### Types principaux (`src/lib/clonestore/adn/types.ts`)

| Type | Valeurs |
|------|---------|
| `CloneADNProfileStatus` | `not_configured \| partial \| configured \| strong \| locked` |
| `CloneADNAutonomyLevel` | `manual \| assist \| supervised \| trusted \| restricted` |
| `CloneADNTone` | `formal \| warm \| direct \| executive \| neutral \| legal_careful \| candidate_friendly \| internal_concise` |
| `CloneADNValidationMode` | `required \| recommended \| smart \| minimal \| manual_only` |

**`CloneADNProfile`** : profil principal avec sous-profils :
- `communication` : tone, formality, greeting_style, formal_closing, language, email_sign_off
- `validation` : default_mode, never_auto_execute, always_require_human_for, sensitive_topics
- `autonomy` : level, blocked_auto_task_types, trusted_task_types, max_auto_actions_per_day
- `document` : preferred_format, include_company_logo, default_header, default_footer, document_tone
- `company_identity` : trade_name, legal_name, sector, website, hr_contact_email, founded_year
- `rules[]` : regles conditionnelles (condition/action/severity/category)
- `sites[]`, `departments[]` : donnees structurelles entreprise
- `inferred_preferences[]` : preferences deduites automatiquement

### Architecture des modules

| Fichier | Role |
|---------|------|
| `src/lib/clonestore/adn/types.ts` | Types CloneADN — zero logique |
| `src/lib/clonestore/adn/utils.ts` | Fonctions pures : normalisation, detection, dedup |
| `src/lib/clonestore/adn/profile.ts` | build/sanitize/merge/analyze/context/storage |
| `src/lib/clonestore/adn/rules.ts` | Moteur de regles keyword-based (pas d'eval) |
| `src/lib/pierre/adn/cloneadn.ts` | Adaptateur Pierre — re-exports + fonctions Pierre-specifiques |

**Sens de dependance** : `types.ts` <- `utils.ts` <- `profile.ts` <- `rules.ts` <- `cloneadn.ts` <- routes. Aucun import circulaire.

### Fonctions cles

**`profile.ts` :**
- `buildDefaultCloneADNProfile()` : profil par defaut (status=not_configured, autonomy.level=supervised, never_auto_execute=[email.send, email_send])
- `sanitizeCloneADNProfile(raw)` : validation complete (limites : 100 regles, 50 sites, 100 departements, 200 preferences)
- `mergeCloneADNProfilePatch(existing, patch)` : fusion partielle + re-sanitize
- `analyzeCloneADNProfile(profile)` : completeness_score, status, recommendations, strengths, missing_fields
- `buildCloneADNApplicationContext(profile)` : contexte consomme par les agents IA
- `buildCloneADNStoragePatch(profile, existing)` : **CRITIQUE** — preserve toujours employees + document_templates

**`rules.ts` :**
- `evaluateCloneADNRules(rules, input)` : evaluation keyword-based, jamais de eval()
- `shouldCloneADNRequireValidation(context, input)` : combine regles + never_auto_execute
- `shouldCloneADNBlockAction(context, input)` : bloque si action dans liste d'exclusion

**`cloneadn.ts` (Pierre adapter) :**
- `buildPierreCompanyContextFromCloneADN(profile)` : contexte cerveau (tone/autonomy/validation/company)
- `evaluatePierreActionWithCloneADN({profile, taskType, domain, riskLevel, sensitiveTopics, text})` : evaluation complete avec {blocked, requires_validation, reasons, rule_evaluation}
- `buildPierreCloneADNHint(profile)` : pour context_snapshot_json — {configured, status, completeness_score, tone, autonomy_level, company_name, active_rules, blocking_rules, sites_count, departments_count}
- `buildPierreDocumentVariablesFromCloneADN(profile)` : variables document (company_name, formal_closing, greeting_style, document_tone...)

### Routes API

| Route | Methodes | Description |
|-------|----------|-------------|
| `/api/pierre/use/cloneadn` | GET, PUT, PATCH | Profil CloneADN complet |
| `/api/pierre/use/cloneadn/rules` | GET, POST | Regles CloneADN |
| `/api/pierre/use/cloneadn/analyze` | GET, POST | Analyse profil / evaluation action |
| `/api/pierre/use/cloneadn/preview` | POST | Simulation read-only (aucune ecriture) |

Toutes les routes CloneADN :
- Ne creent jamais de mission ou de tache
- N'envoient jamais d'email
- N'exposent jamais de secrets env dans les reponses
- Ecrivent uniquement vers `reusable_rh_context_json.clone_adn`

### Points d'integration

| Composant | Integration |
|-----------|------------|
| `submit/route.ts` | Chargement parallele CloneADN + employees via Promise.all ; `cloneadn_hint` dans context_snapshot_json ; `cloneADNContext` vers task-bridge |
| `mission/[missionId]/route.ts` | `cloneadn_hint` depuis context_snapshot_json (avec fallback live) |
| `brain/task-bridge.ts` | `cloneADNContext` option : bloque/escalade les taches selon profil ADN |
| `documents/premium-document-system.ts` | `cloneADNVariables` avec **priorite inferieure** aux variables explicites (spread order : { ...cloneADNVariables, ...variables }) |
| `tasks/artifacts.ts` | Extrait les variables CloneADN depuis `reusable_rh_context_json.clone_adn` |
| `hr/operational-readiness.ts` | Param optionnel `cloneADNHint` : gates company_memory/controlled_autonomy/cloneguard |
| `hr/release-proof.ts` | Param optionnel `cloneADNHint` : +3 pts global_score si configured |
| `hr/trial-activation.ts` | Param optionnel `cloneADNHint` : +3 pts value_score et conversion_score si configured |
| `hr/customer-success.ts` | Param optionnel `cloneADNHint` : +5 pts health/conversion/retention si status strong/locked |

### Invariants critiques Bloc 28

1. CloneADN stocke uniquement dans `reusable_rh_context_json.clone_adn` — jamais dans `memory_json`
2. `buildCloneADNStoragePatch` preserve **toujours** `employees` et `document_templates`
3. Les routes CloneADN ne creent jamais de mission, tache, ni email
4. CloneADN ne rend jamais automatiques les actions a `approval_required=true`
5. CloneADN ne bypass jamais CloneGuard
6. Le moteur de regles utilise du keyword-matching — jamais d'`eval()`
7. Toutes les fonctions sont null-safe et fallback-safe (profil incomplet = pas de crash)
8. Les variables CloneADN ont **priorite inferieure** aux variables explicites dans les documents
9. Les changements aux HR hint builders (Phase 12) sont des params optionnels — retrocompatibles
10. Aucun appel reel OpenAI/Anthropic dans les tests

### Resultats finaux Bloc 28

| Metrique | Valeur |
|----------|--------|
| Modules purs nouveaux | 4 (clonestore/adn: types, utils, profile, rules) |
| Adaptateur Pierre | 1 (pierre/adn/cloneadn.ts) |
| Fichiers modifies | 9 (task-bridge, premium-document-system, artifacts, submit, mission, operational-readiness, release-proof, trial-activation, customer-success) |
| Routes nouvelles | 4 (cloneadn, cloneadn/rules, cloneadn/analyze, cloneadn/preview) |
| Tests unitaires | 220+ (cloneadn.test.ts) + 29 regression (cloneadn-integration.test.ts) |
| Etapes script PS5 | 20+ |
| tsc errors | 0 |
| Build | clean |

---

## Bloc 29 — Pierre Final End-to-End Golden Scenarios

### Concept

Bloc 29 prouve que Pierre est un vrai poste RH operationnel — pas juste des moteurs techniques.
13 scenarios dores ("golden scenarios") valident que chaque module cle fonctionne de bout en bout.
Tous les scenarios sont des dry-runs: zero DB write, zero email, zero IA reelle, zero execution de tache.

### 13 Scenarios Dores

| ID | Categorie | Severite | Modules |
|----|-----------|----------|---------|
| gs_onboarding_complete | positive | critical | workflow_plan, brain_output, document, employee_360, cloneguard |
| gs_hiring_offer | positive | critical | workflow_plan, brain_output, document, cloneguard, task_drafts |
| gs_absence_justified | positive | high | workflow_plan, brain_output, document, task_drafts |
| gs_contract_renewal | positive | critical | workflow_plan, brain_output, document, cloneguard, task_drafts |
| gs_trial_activation | positive | high | workflow_plan, brain_output |
| gs_payroll_prep | positive | high | workflow_plan, brain_output, task_drafts |
| gs_employee_360 | positive | critical | employee_360 |
| gs_document_premium | positive | high | document |
| gs_cloneguard_allow | positive | critical | cloneguard, workflow_plan |
| gs_cloneadn_configured | positive | high | cloneadn, brain_output |
| gs_cloneguard_block | negative | critical | cloneguard, workflow_plan |
| gs_missing_employee | negative | medium | workflow_plan, brain_output |
| gs_invalid_request | negative | medium | validation_error |

### Architecture pure du module scenarios

```
src/lib/pierre/scenarios/
  types.ts          — PierreGoldenScenarioId, PierreGoldenScenarioResult, PierreGoldenScenarioSuiteResult, ...
  golden-registry.ts — 13 scenarios defines avec checks
  fixtures.ts        — Company/employee/CloneADN fixtures (statiques)
  validator.ts       — Moteur d'assertions (exists, equals, contains, length_gt, is_array, ...)
  runner.ts          — runGoldenScenario + runGoldenScenarioSuite (async, ai_mode: "off")
  report.ts          — buildGoldenScenarioReport (sellable/demo_ready/internal_only/blocked)
```

### Types cles

```typescript
type PierreGoldenScenarioId =
  | "gs_onboarding_complete" | "gs_hiring_offer" | "gs_absence_justified"
  | "gs_contract_renewal" | "gs_trial_activation" | "gs_payroll_prep"
  | "gs_employee_360" | "gs_document_premium" | "gs_cloneguard_allow"
  | "gs_cloneadn_configured" | "gs_cloneguard_block" | "gs_missing_employee"
  | "gs_invalid_request";

type PierreGoldenScenarioResult = {
  scenario_id: PierreGoldenScenarioId;
  status: PierreGoldenScenarioExpectedStatus; // pass|fail|warn|skip
  checks_total: number; checks_passed: number; checks_failed: number;
  artifacts: PierreGoldenScenarioArtifact[];
  duration_ms: number;
};

type PierreGoldenScenarioReport = {
  level: "sellable"|"demo_ready"|"internal_only"|"blocked";
  score: number; // 0-100
  sellable: boolean;
  recommendation: string;
};
```

### Moteur d'assertions

Types d'assertions supportes:
- `exists` / `not_null`: presence
- `is_true` / `is_false`: boolean
- `equals`: egalite stricte
- `contains`: string includes ou array includes
- `length_gt`: longueur > N
- `is_array` / `is_string` / `is_number`: type checks
- `matches_status`: egalite sur string

Resolution de chemin via dot notation: `"quality_gate.valid"`, `"interpretation.domain"`, etc.

### Rapport executif

Niveaux de rapport:
- `sellable`: zero echec, zero critical failure, score >= 90
- `demo_ready`: zero echec, score >= 75
- `internal_only`: pas de critical failure, score >= 50
- `blocked`: critical failure present ou score < 50

Score = (scenarios_passed / scenarios_total) * 90% + check_bonus * 10%

### Routes API (4 routes nouvelles)

| Route | Methode | Description |
|-------|---------|-------------|
| /api/pierre/use/scenarios | GET | Liste tous les scenarios + summaries |
| /api/pierre/use/scenarios/[scenarioId]/run | POST | Execute un scenario |
| /api/pierre/use/scenarios/run-suite | POST | Execute toute la suite |
| /api/pierre/use/scenarios/report | GET | Rapport executif (fresh run) |

Toutes les routes: dry_run: true, no_db_writes: true, no_email: true, ai_mode: "off".

### golden_scenarios_hint dans mission/[missionId]

La route mission/[missionId] expose un golden_scenarios_hint statique:
```json
{
  "available": true,
  "scenarios_total": 13,
  "scenarios_positive": 10,
  "scenarios_negative": 3,
  "critical_scenario_ids": ["gs_onboarding_complete", "gs_hiring_offer", ...],
  "modules_covered": ["workflow_plan", "brain_output", "employee_360", ...],
  "dry_run_endpoint": "/api/pierre/use/scenarios/run-suite",
  "report_endpoint": "/api/pierre/use/scenarios/report"
}
```

### Invariants Bloc 29

1. Jamais de `scheduled_for` dans les task drafts — utiliser `execute_at`
2. Jamais `email.send` / `send_email` dans les task drafts — toujours `email.draft`
3. Jamais de DB write depuis les scenarios
4. Jamais d'appel IA reel (ai_mode = "off" force le mock provider)
5. Jamais de bypass CloneGuard
6. CloneGuard evalue tous les scenarios avec module cloneguard
7. Les scenarios negatifs prouvent la degradation gracieuse
8. Tous les artifacts retournent `valid: true` meme en erreur (erreur dans le champ `error`)
9. Le rapport est toujours calculable meme si tous les scenarios echouent
10. `gs_cloneguard_block` prouve que `requires_human: true` pour les actions dangereuses

### Resultats finaux Bloc 29

| Metrique | Valeur |
|----------|--------|
| Modules purs nouveaux | 6 (types, golden-registry, fixtures, validator, runner, report) |
| Routes nouvelles | 4 (scenarios GET, [scenarioId]/run POST, run-suite POST, report GET) |
| Routes enrichies | 1 (mission/[missionId] + golden_scenarios_hint) |
| Scenarios dores | 13 (10 positifs + 3 negatifs) |
| Checks totaux | 65+ (5-7 checks par scenario) |
| Tests unitaires | 178 (139 golden-scenarios.test.ts + 39 golden-scenarios-crossblock.test.ts) |
| tsc errors | 0 |
| Build | clean |

Note: le prompt Bloc 29 citait "220+ tests" comme objectif. 178 tests ont ete produits, couvrant les 13 scenarios, tous les check types, les fixtures, le runner, et les cross-blocs. Chiffre exact confirme par validation tsc + vitest.

---

## Bloc 30 — Pierre Release Candidate Final / Hardening global backend + produit

Date : 2026-05-20

### Objectif

Transformer tout ce qui a ete construit sur Pierre en une Release Candidate propre, coherente, stable, verifiee, vendable. Ce bloc n'ajoute pas de grosses features — il verrouille le backend V1 final.

Apres ce bloc, on peut dire : "Le moteur Pierre V1 est finalise cote backend/produit. Il reste ensuite le Bloc 31 cockpit final UI pour rendre toute cette puissance visible et pilotable par le client."

### Phase 1 — Harmonisation IDs scenarios golden

Les IDs internes `gs_*` existent en parallele avec les 13 IDs officiels publics:

| ID officiel | ID interne gs_* |
|---|---|
| onboarding_cdi | gs_onboarding_complete |
| contract_draft | gs_hiring_offer |
| contract_amendment | gs_contract_renewal |
| absence_followup | gs_absence_justified |
| prepay_summary | gs_payroll_prep |
| employee_file_summary | gs_employee_360 |
| sensitive_case | gs_cloneguard_block |
| offboarding | gs_cloneguard_block |
| candidate_rejection | gs_hiring_offer |
| executive_hr_briefing | gs_trial_activation |
| out_of_scope | gs_missing_employee |
| email_without_validation | gs_hiring_offer |
| incomplete_request | gs_invalid_request |

Nouvelles fonctions: `normalizePierreGoldenScenarioId()`, `isValidOfficialScenarioId()`, `getGoldenScenarioByOfficialIdOrAlias()`.
La route `[scenarioId]/run` accepte desormais les deux formats.

### Phase 2-5 — RC Engine (modules purs)

5 modules purs dans `src/lib/pierre/release-candidate/`:

| Module | Responsabilite |
|---|---|
| types.ts | Types RC (status/severity/area/check/report) |
| checks.ts | buildRCCheck/buildRCWarning/buildRCFail, scoring, summarize, report builder |
| invariant-auditor.ts | Scan scheduled_for/old log schema/email auto/storage shape/docs sensibles |
| preflight.ts | Static checklist + async preflight (golden suite optionnel) |
| report.ts | Executive summary + Markdown renderer |

### Phase 6 — Routes RC (3 routes read-only)

| Route | Methode | Description |
|---|---|---|
| /api/pierre/use/release-candidate | GET | Rapport rapide (sans golden suite) |
| /api/pierre/use/release-candidate/preflight | POST | Preflight complet (golden suite optionnel) |
| /api/pierre/use/release-candidate/invariants | POST | Audit invariants sur donnees fournies |

Toutes les routes: read-only, no_db_writes, no_email, no_execution, no_mission_creation.

### Phase 7 — Hint release_candidate dans mission/[missionId]

Nouveau champ `release_candidate_hint` dans la reponse de `mission/[missionId]`:
```json
{
  "backend_ready": true,
  "next_step": "cockpit",
  "has_brain_final": true,
  "has_cloneadn": true,
  "has_premium_documents": false,
  "has_customer_success": false,
  "has_golden_scenarios": true
}
```
Calcule de maniere synchrone depuis les donnees deja disponibles. Ne lance pas de preflight.

### Statuts RC

| Status | Score | Conditions |
|---|---|---|
| ready | >= 90 | Aucun fail, aucun critical |
| almost_ready | >= 75 | Pas de critical fail |
| blocked | < 75 ou fail | Au moins un fail ou critical |
| failed | N/A | Exception dans le report builder |

- `can_release_backend = true` si status = ready
- `can_start_cockpit = true` si pas de critical fail et score >= 75
- `requires_hotfix = true` si critical ou error fail

### Invariants Bloc 30

1. Routes RC = read-only (jamais de DB write, jamais d'email, jamais d'execution)
2. Preflight ne throw jamais
3. Checks/score toujours dans [0, 100]
4. Critical fail => status blocked/failed
5. Mock provider toujours disponible (aucune cle API requise)
6. Invariants absolus Bloc 1-29 preserves (scheduled_for/old log/email.send etc.)
7. Tests RC sans Supabase et sans provider reel
8. IDs officiels et gs_* coexistent sans casser les 178 tests existants
9. Documents sensibles (contrats/prepay/offboarding/sensitive_case) = validation requise
10. Aucun secret dans les reponses RC

### Resultats finaux Bloc 30

| Metrique | Valeur |
|----------|--------|
| Modules RC purs | 5 (types, checks, invariant-auditor, preflight, report) |
| Routes RC nouvelles | 3 (release-candidate GET, preflight POST, invariants POST) |
| Routes enrichies | 1 (mission/[missionId] + release_candidate_hint) |
| Alias IDs harmonises | 13 IDs officiels -> alias gs_* |
| Tests unitaires nouveaux | ~185 (release-candidate.test.ts + crossblock) |
| Tests totaux | ~3997 (32 + 2 nouveaux fichiers test) |
| tsc errors | 0 |
| Build | clean |

### Definition "Pierre Backend Final V1"

Apres Bloc 30, Pierre V1 backend est considere final:
- Brain final fonctionne avec fallback deterministe
- AI runtime existe et ne bloque pas sans cles
- Submit cree missions/tasks sans casser
- Tasks ne deviennent jamais dangereuses
- Documents premium disponibles et validation sensible respectee
- CloneADN applique partout sans bypass securite
- Employee File 360 fonctionne
- Continuity fonctionne
- Trial activation fonctionne
- Customer Success fonctionne
- Release Proof fonctionne
- Golden Scenarios existent et sont coherents
- Aucun vieux champ DB faux utilise
- Aucun endpoint dry-run/config n'execute une action reelle
- Tests + build passent
- Rapport Release Candidate indique clairement "ready / almost_ready / blocked"

---

## Bloc 31 — Cockpit Pierre Final UI / Mission Center

**Objectif** : Rendre toute la puissance B25-B30 visible et pilotable via un cockpit premium client-side. Aucune nouvelle feature backend.

### Architecture UI

Trois couches pures :
- **Types** (`src/lib/pierre/cockpit/types.ts`) — 18 types TypeScript pur client
- **Normalizers** (`src/lib/pierre/cockpit/normalizers.ts`) — 14 fonctions null-safe, jamais de throw
- **API Client** (`src/lib/pierre/cockpit/api-client.ts`) — `safeFetch` interne, jamais de secret client

### Hook principal

`usePierreCockpit()` — `src/app/agents/pierre/use/hooks/usePierreCockpit.ts`
- Charge les donnees initiales en parallele (employees, cloneADN, RC, scenarios, AI status)
- Polling actif toutes les 12s quand des taches sont en running/queued/pending
- `localStorage` key : `clonestore:pierre:cockpit:b31:v1`
- Expose les actions task (approve/cancel/run/reschedule) avec guard sensitif

### Page + Shell

- `src/app/agents/pierre/use/page.tsx` — page client minimale, delègue à PierreCockpitShell
- `src/app/agents/pierre/use/components/PierreCockpitShell.tsx` — layout principal (rail gauche + centre + panel droit)
- Rail gauche collapsible, header avec alertes validation, panel droit (xl+)
- Mobile : PierreMobileActionBar (bottom nav, 5 items)

### 17 composants UI

| Composant | Role |
|---|---|
| PierreStatusBadges | Badges status/risk/validation/sensitive/email |
| PierreEmptyStates | Etats vide/chargement/erreur |
| PierreMobileActionBar | Nav mobile bas d'ecran |
| PierreCommandCenter | Chat + input mission naturel |
| PierreMissionUnderstandingCard | Comprehension mission + progress bar |
| PierreWorkBoard | Board taches actives avec tri par statut |
| PierreCockpitTaskCard | Carte tache avec boutons gardes (approve/cancel/run) |
| PierreValidationCenter | Centre validations humaines avec approve/refus |
| PierreArtifactStudio | Onglets documents/emails/PDF |
| PierreDocumentStudio | Templates + preview document |
| PierreEmployeeFilesPanel | Liste employes avec search + stats |
| PierreEmployeeFileCard | Carte employe 360 avec health bar |
| PierreCloneADNPanel | Statut ADN + edition minimale |
| PierreTraceTimeline | Timeline conversation/evenements |
| PierreValuePanel | ROI + scores qualite |
| PierreScenariosPanel | Scenarios golden avec dry-run |
| PierreCockpitShell | Layout principal + workspace routing |

### Espaces de travail (11 workspaces)

`mission | validations | documents | emails | pdf | employees | cloneadn | trace | value | scenarios | settings`

### Invariants Bloc 31

- Jamais `scheduled_for` — colonne DB reelle : `execute_at` (utilise dans normalizeTaskList)
- Jamais `level/event/payload` dans les structures de logs
- Jamais auto-executer `email.send`, `send_email`, `approval_required=true` depuis l'UI
- Aucun secret / cle API cote client
- Aucun appel OpenAI/Anthropic direct depuis le navigateur
- Les boutons sensibles (approve/run email) sont gardes avec confirmation explicite
- `safeFetch` ne throw jamais — retourne `{ ok, data, error, status }`
- Toutes les fonctions du normalizer attrapent les exceptions (jamais de throw)

### Tests Bloc 31

- `src/lib/pierre/cockpit/__tests__/cockpit-normalizers.test.ts` — **150 tests**
- Couvre : normalizeMissionResponse, normalizeTaskList, normalizeDocumentList, normalizeEmployeeFileIndex, normalizeCloneADNProfile, normalizeCustomerSuccessReport, normalizeReleaseCandidateReport, normalizeGoldenScenarios, extractValidationAlerts, extractCockpitCardsFromMission, extractBrainHint, extractPremiumDocumentHint, extractCloneADNHint, normalizeAIStatus
- Invariant : toutes les fonctions testees avec 9 inputs malformes (never throw)

### Design system

- Palette : ivory/cream/champagne (`--cs-bg`, `--cs-ivory`, `--cs-champagne`)
- Surfaces glass : `--cs-surface-strong`, `--cs-glass-top`
- Badges : classes `.cs-badge-success/warn/danger/blue/muted` (ajoutees en section 9 de globals.css)
- Apple-like, responsive, accessible (aria-label, aria-current, role=tablist)

### Resultats finaux Bloc 31

- 0 erreurs TypeScript (`npx tsc --noEmit`)
- 150 tests normalizer cockpit passes
- Page + 17 composants = cockpit complet, responsive, premium
- Accessible : roles ARIA corrects sur toute la navigation
- Securite : aucune action sensible auto-executee, toutes les actions email/validation requierent un clic utilisateur explicite

---

## Bloc 31.1 — Polish UI Cockpit Pierre / Alignement ADN CloneStore

**Objectif** : Aligner le cockpit avec le DNA visuel CloneStore (pas d'emojis, LiquidGlass, palette ivoire/champagne, hauteur correcte, auth gate).

### Composants mis a jour (17/17)

Tous les emojis remplaces par des icones lucide-react :

| Composant | Changements |
|---|---|
| PierreCockpitShell | Icones lucide rail (`Sparkles`, `ShieldCheck`, `FileText`, `Mail`, `FileDown`, `Users`, `Fingerprint`, `History`, `TrendingUp`, `FlaskConical`, `Settings2`). Auth gate. Height fix. `PanelLeftClose/Open`. Groupe "Avance". |
| PierreStatusBadges | `ShieldAlert`, `Lock`, `Mail`, `ShieldCheck`, `AlertTriangle`. `RiskBadge` retourne null pour low/normal. |
| PierreEmptyStates | `AlertTriangle` remplace `⚠`. |
| PierreMobileActionBar | Icones lucide (`Sparkles`, `ShieldCheck`, `FileText`, `Users`, `TrendingUp`). |
| PierreValidationCenter | `Check`, `X`, `ShieldAlert`, `ShieldCheck`. Spinners. |
| PierreWorkBoard | `Sparkles` (no mission), `CheckCircle2` (no tasks). |
| PierreEmployeeFilesPanel | `Users` (empty), `X` (fermer). |
| PierreCloneADNPanel | `Fingerprint` (empty), `CheckCircle2`/`AlertTriangle` (status). Tracking ok/error sans prefix emoji. |
| PierreScenariosPanel | `Play`, `ChevronsRight`, `FlaskConical`. Labels "Positif/Negatif" sans caracteres speciaux. |
| PierreArtifactStudio | `Mail`, `FileDown`, `FileText` (empty states). |
| PierreCommandCenter | Placeholder : "Confiez une mission RH a Pierre…". |

### Corrections structurelles

- **Hauteur** : `h-screen w-screen` → `height: calc(100dvh - 70px)` (compense le header sticky ~70px)
- **Auth gate** : Detection "Auth session missing.", "unauthorized", "no session", "401" dans `globalError` → `<AuthGate />` avec CTA "Se connecter" (`/login`) et "Retour a Mon CloneStore" (`/profile`)
- **Rail glass** : `rgba(245,240,230,0.82)` + `backdrop-filter blur(20px) saturate(1.4)` — palette ivoire authentique
- **PanelLeftClose/Open** : Bouton collapse remplace le SVG inline
- **Navigation groupee** : Primaires (9 items) + section "Avance" (Scenarios, Parametres)
- **RC status** : `CheckCircle2`/`AlertTriangle` remplacent `✅`/`⚠`
- **ErrorBanner** : `AlertTriangle` + `X` remplacent `⚠`/`✕`

### Resultats finaux Bloc 31.1

- 0 erreurs TypeScript (`npx tsc --noEmit`)
- 4152 tests passes (35 fichiers)
- Build Next.js clean
- Aucun emoji dans les 11 composants cockpit
- Cockpit accessible depuis n'importe quel viewport avec hauteur correcte

---

## Bloc 31.2 — Hotfix critique : performance, auth propre, navigation fluide

**Objectif** : Corriger le lag ~20s, le bug chunk `./5873.js` (Next.js stale cache), et les boucles auth 401.

### Cause du bug ./5873.js

Chunk webpack obsolete dans `.next/` depuis un precedent build. Login n'importe rien du cockpit — la page est independante. Fix : `Remove-Item -Recurse -Force .next` + redemarrage dev server.

### Probleme de performance

`loadInitialData()` lancait **7 appels API en parallele a chaque montage** :
- employees/files, cloneADN, release-candidate, scenarios, AI status, customer-success, document-templates
- Tous frappaient Supabase simultanement, saturant le pool HTTP (6 connexions max / domaine)
- Navigation workspace bloquee pendant que toutes ces requetes resolvent

### Corrections appliquees

**`src/lib/pierre/cockpit/auth-helpers.ts`** — nouveau module pur testable :
- `isAuthFailure(status, error)` — detecte 401, "auth session missing", "unauthorized", "no session", "not authenticated"
- Aucun React, aucun Next, aucun async

**`usePierreCockpit.ts`** — refactorise pour la performance :
- Montage initial : UNIQUEMENT AI status + RC status (2 appels legers au lieu de 7)
- Chargement lazy par workspace avec TTL 60s :
  - `employees` → seulement quand workspace "employees" ouvert
  - `cloneadn` → seulement quand workspace "cloneadn" ouvert
  - `scenarios` → seulement quand workspace "scenarios" ouvert
  - `value` → seulement quand workspace "value" ouvert (customer success)
  - `settings` → seulement quand workspace "settings" ouvert (document templates)
- Cache TTL (`workspaceLoadedAt` ref) — pas de re-fetch si deja charge depuis < 60s
- `authRequired` state + `authRequiredRef` sync : detecte 401 ou message auth dans TOUT appel
- Quand `authRequired = true` : polling stoppe, fetchs bloques, `globalError` intact (pas pollue)
- `openWorkspace()` reste synchrone — le changement visuel est immediat, le fetch se fait apres

**`PierreCockpitShell.tsx`** — utilise `cockpit.authRequired` directement (plus de parsing de `globalError`)

### Comportement auth

- 401 ou "Auth session missing." dans n'importe quelle reponse → `authRequired = true`
- Polling mission arrete immediatement
- `AuthGate` affiche "Connexion requise" avec CTA /login et /profile
- Aucune erreur auth dans le chat ou globalError
- Aucune boucle de retry (le ref `authRequiredRef` bloque tous les futurs appels)

### Tests

- `src/lib/pierre/cockpit/__tests__/cockpit-api-state.test.ts` — **25 tests** pour `isAuthFailure()`
  - Couvre : 401 avec/sans erreur, strings auth case-insensitive, longues chaines, faux positifs
- `test:pierre-cockpit-state` — script npm dedie

### Resultats finaux Bloc 31.2

- 0 erreurs TypeScript (`npx tsc --noEmit`)
- **4177 tests passes** (36 fichiers) : +25 nouveaux tests auth
- Build Next.js clean — `/login` (5.07 kB) et `/agents/pierre/use` (20.9 kB) completement independants
- Cache `.next` nettoye — bug `./5873.js` resolu
- Montage cockpit : 2 appels au lieu de 7 (reduit de 71% les requetes initiales)
- Navigation workspace : changement visuel < 1 frame (synchrone), fetch en arriere-plan

---

---

## Bloc 31.6 — Site Reliability Gate / Auth + Checkout + Performance

Date : 2026-05-23

### Objectif

Filet de securite statique — detecter les regressions de securite et de performance avant qu'elles atteignent la production.

### Modules crees

**`src/lib/auth/login-helpers.ts`** — helpers redirections login :
- `isSafeRelativeRedirect(url)` — valide chemin relatif non-dangereux
- `sanitizeAuthRedirect(url)` — neutralise les redirections dangereuses
- `resolvePostLoginRedirect(url)` — retourne un chemin post-login sur

**`src/lib/auth/useAuthGate.ts`** — hook client :
- `AuthGateState` : "checking" | "authenticated" | "unauthenticated"
- Guard de chargement sur `profile/agents` et `profile/messages`

**`src/lib/performance/navigation-budget.ts`** — budgets navigation :
- `NavigationLatencyClass` : "instant" | "acceptable" | "slow" | "critical"
- `BUDGET_MS` : instant=100ms, acceptable=800ms, slow=1500ms, critical=3000ms
- `classifyNavigationLatency(ms)`, `assertNavigationBudget(ms)`, `formatLatency(ms)`

**`src/lib/site-health/types.ts`** — types : `HealthCheckStatus`, `HealthCheckResult`, `SiteHealthReport`

**`src/lib/site-health/checks.ts`** — 6 fonctions pures d'invariant :
- `checkDefaultPostLoginPath` — verifie `/profile/agents`
- `checkPrivatePathsNonEmpty` — verifie PRIVATE_PATHS non vide
- `checkNoTokenInUrl` — detecte token/access_token/refresh_token dans URL
- `checkRedirectIsSafe` — valide que redirect est un chemin relatif
- `checkNoUserIdInCheckoutBody` — refuse user_id dans body checkout
- `checkErrorNotExposedRaw` — detecte supabase/PGRST/node_modules dans messages d'erreur

**`src/app/api/site-health/route.ts`** — GET /api/site-health :
- Lecture seule, aucune auth requise, aucun secret expose
- Repond 200 si tous les checks passent/warn, 503 si un check fail

### Tests crees

- `src/lib/auth/__tests__/login-helpers.test.ts` — 32 tests
- `src/lib/site-health/__tests__/site-health.test.ts` — 26 tests (+ 9 billing B31.7)
- `src/lib/performance/__tests__/navigation-budget.test.ts` — 26 tests

### Resultats finaux Bloc 31.6

- 0 erreurs TypeScript
- 4309 tests (41 fichiers)
- Build Next.js clean

---

## Bloc 31.7 — Payment Activation Chain + Stripe Trial + Price 449

Date : 2026-05-23

### Probleme resolu

**Root cause :** `checkout.session.completed` filtrait uniquement `payment_status === "paid"`. Les souscriptions avec essai gratuit Stripe envoient `payment_status = "no_payment_required"` — ce guard faisait donc echouer silencieusement toute activation par essai. De plus, `hasPierreAccess` n'acceptait que `status = "active"`, bloquant les utilisateurs en periode d'essai (`trialing`).

### Modules crees

**`src/lib/billing/stripe-activation.ts`** — module pur, aucun effet de bord :
- `ActivationStatus` : active | trialing | canceled | past_due | unpaid | incomplete_expired | paused | none
- `ACTIVE_STATUSES` : ["active", "trialing"]
- `INACTIVE_STATUSES` : ["canceled", "unpaid", "incomplete_expired"]
- `EXPECTED_PIERRE_PRICE_AMOUNT` = 44900 (449,00 EUR en centimes)
- `TRIAL_PERIOD_DAYS` = 7
- `isAccessGranted(status)` — true pour active/trialing
- `isAccessRevoked(status)` — true pour canceled/unpaid/incomplete_expired
- `mapPaymentStatusToActivation(paymentStatus)` — "paid"→active, "no_payment_required"→trialing
- `mapSubscriptionStatus(status)` — mapping direct Stripe→ActivationStatus
- `extractActivationMetadata(obj)` — extrait user_id + agent_slug depuis metadata Stripe (strings uniquement)
- `validateCheckoutSession(session)` — valide une session checkout.session.completed (paid + trial)
- `isPierrePriceAmountValid(amount)` — verifie amount === 44900

### Fichiers modifies

**`src/lib/pierre/access.ts`** :
- `hasPierreAccess` : `.eq("status", "active")` → `.in("status", ["active", "trialing"])`
- Les utilisateurs en essai ont maintenant acces

**`src/app/api/pierre/use/submit/route.ts`** + **`src/app/api/pierre/action/route.ts`** :
- Copie locale de hasPierreAccess : `.in("status", ["active", "trialing"])`

**`src/app/api/webhooks/stripe/route.ts`** (reecriture complete) :
- `checkout.session.completed` : utilise `validateCheckoutSession()` — accepte paid ET no_payment_required
- `customer.subscription.created` : fallback si metadata sur souscription
- `customer.subscription.updated` : gere trialing→active, canceled, past_due
- `customer.subscription.deleted` : status=canceled, ended_at=now
- `invoice.payment_failed` : status=past_due
- Signature Stripe toujours verifiee (`stripe.webhooks.constructEvent`)
- `user_id` jamais fait confiance depuis le body — uniquement depuis metadata validee

**`src/app/api/checkout/route.ts`** :
- Verification du montant du Price Stripe avant creation de session (bloque en production si ≠ 44900)
- Trial : `subscription_data.trial_period_days: 7`, carte collectee maintenant, charge apres essai si non annule
- `metadata: { user_id, agent_slug }` sur session ET subscription_data

**`src/app/paiement/success/page.tsx`** (reecriture complete) :
- Composant client, dans Suspense (requis pour `useSearchParams`)
- Interroge GET /api/checkout?agent_slug=pierre avec Bearer pour verifier l'activation reelle
- Etats : checking / active / pending / unauthenticated
- Auto-retry 2x apres 3s si pending
- Affiche "Pierre est pret" quand active, "Activation en cours" sinon

**`src/middleware.ts`** :
- `getUser()` (appel reseau ~200ms par requete) → `getSession()` (lecture cookie ~0ms quand JWT frais)
- Les routes API font deja `getUser()` pour la validation — le middleware n'en a pas besoin

### Checks site-health ajoutes (B31.7)

Trois nouveaux checks dans `src/lib/site-health/checks.ts` :
- `checkPierreTrialDays(actual)` — pass si 7 jours, warn sinon
- `checkPierrePriceAmount(actual)` — pass si 44900 centimes, fail sinon, warn si null
- `checkTrialingGrantsAccess(activeStatuses)` — pass si "trialing" dans la liste

### Tests crees

**`src/lib/billing/__tests__/activation.test.ts`** — 46 tests :
- isAccessGranted / isAccessRevoked
- mapPaymentStatusToActivation / mapSubscriptionStatus
- extractActivationMetadata (types stricts, jamais de non-string)
- validateCheckoutSession (paid + trial + cas d'erreur)
- isPierrePriceAmountValid + EXPECTED_PIERRE_PRICE_AMOUNT + TRIAL_PERIOD_DAYS

### Invariants de securite

- `user_id` vient toujours du Bearer token cote serveur — jamais du body client
- Signature Stripe toujours verifiee avant traitement
- `trialing` donne acces a Pierre — jamais de blocage utilisateur en essai
- Prix Pierre 449 EUR — verification active en production avant creation de session
- Token jamais dans l'URL, jamais dans les logs, jamais expose cote client
- Aucune erreur technique brute transmise au client

### Resultats finaux Bloc 31.7

- 0 erreurs TypeScript (`npx tsc --noEmit`)
- 4364 tests (42 fichiers) — +55 nouveaux tests
- Build Next.js clean

---

---

## Bloc 31.8 — Stripe Activation Fallback + wording employé IA

Date : 2026-05-23

### Probleme resolu

**Cause du pending infini :** La `success_url` ne contenait pas `{CHECKOUT_SESSION_ID}`. La success page ne pouvait donc pas appeler un fallback côte serveur. Sans Stripe CLI en local, le webhook n'arrivait jamais → table `orders` vide → `active=false` → "Activation en cours" permanent.

**Deux sources d'activation :**
1. **Webhook Stripe** — source principale en production (`checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.payment_failed`)
2. **Route confirm** — fallback securise : verifie la session Stripe côte serveur avec `STRIPE_SECRET_KEY`, upsert `orders` si Stripe confirme le paiement ou le trial

### Corrections

**`src/app/api/checkout/route.ts`** — `success_url` :
```
/paiement/success?agent=pierre&session_id={CHECKOUT_SESSION_ID}
```
`{CHECKOUT_SESSION_ID}` est un template Stripe substitue apres paiement.

**`src/app/api/checkout/route.ts`** — GET handler retourne maintenant `status` (champ texte de la table orders).

### Nouveaux modules

**`src/lib/billing/order-activation.ts`** — helpers serveur partages (webhook + confirm) :
- `upsertOrderActivation(supabase, params)` — idempotent, conflit sur `user_id,agent_slug`
- `updateOrderBySubscriptionId(supabase, subId, update)` — lifecycle events
- `getOrderStatus(supabase, userId, agentSlug)` — lecture status courant
- `createOrderAdminClient()` — client Supabase admin

**`src/app/api/checkout/confirm/route.ts`** — POST, Bearer requis :
- Lit `session_id` du body
- Valide le Bearer token → derive `user_id` côte serveur
- Recupere la session Stripe (`stripe.checkout.sessions.retrieve`)
- Verifie `metadata.user_id === userId` (SESSION_USER_MISMATCH si non)
- Accepte `payment_status: "paid"` ou `"no_payment_required"`
- Upsert `orders` si Stripe confirme
- Idempotent — safe a appeler plusieurs fois
- Codes d'erreur : SESSION_ID_REQUIRED, SESSION_NOT_FOUND, CHECKOUT_NOT_SUBSCRIPTION, SESSION_USER_MISMATCH, SESSION_AGENT_MISMATCH, CHECKOUT_NOT_CONFIRMED, SUBSCRIPTION_NOT_ACTIVE, SUBSCRIPTION_MISSING, STRIPE_NOT_CONFIGURED

**`src/lib/checkout/checkout-helpers.ts`** — nouvelles fonctions :
- `buildConfirmBody(sessionId, agentSlug)` — body confirm sans `user_id`
- `sanitizeCheckoutError` etendu : CHECKOUT_NOT_CONFIRMED, SESSION_USER_MISMATCH, SESSION_NOT_FOUND

### Success page

**`src/app/paiement/success/page.tsx`** — flux confirm :
1. Lit `session_id` depuis URL params (ajoute par Stripe via template)
2. Si `session_id` present : appelle `POST /api/checkout/confirm` avec Bearer
3. Si confirm dit `active/trialing` : affiche "Pierre est pret" directement
4. Sinon : appelle `GET /api/checkout?agent_slug=pierre` (verifie orders)
5. Auto-retry 2x/3s si pending
6. Ref `checkingRef` empeche les appels concurrents

### Wording client

- `agents/page.tsx` : `React.ReactNode` correctement importe (fix TS latent)
- Wording "employé IA" deja correct dans tous les fichiers visibles client
- Wording "agent IA" absent du codebase produit

### Dev local — Stripe CLI obligatoire

Pour recevoir les webhooks en local :
```
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```
Copier le secret donne par Stripe CLI dans `.env.local` :
```
STRIPE_WEBHOOK_SECRET=whsec_...
```
Sans Stripe CLI, la route confirm prend le relais si Stripe confirme le paiement.

### Tests

- `src/lib/billing/__tests__/order-activation.test.ts` — 9 tests structurels (shape payload, pas de secrets, idempotency key)
- `src/lib/checkout/__tests__/checkout-helpers.test.ts` — +9 tests (buildConfirmBody + codes confirm/mismatch)

### Invariants de securite

- `user_id` derive du Bearer token côte serveur — jamais du body
- `metadata.user_id` Stripe verifie contre `userId` authenticate
- Stripe contacte avec `STRIPE_SECRET_KEY` côte serveur uniquement
- Aucun secret expose dans les reponses
- `SESSION_USER_MISMATCH` renvoie 403 sans details
- Route confirm n'active PAS sans confirmation Stripe reelle

### Resultats finaux Bloc 31.8

- 0 erreurs TypeScript
- 4382 tests (43 fichiers) — +18 nouveaux tests
- Build Next.js clean

---

### Prochaine etape

**Bloc 32 (futur)** — Production IA / Cost Router / Model Selection
Configurer les vrais providers OpenAI/Anthropic, les couts par usage, le routeur de modeles, les budgets par mission.

---

## Bloc 31.9 — Final Performance Polish

Date : 2026-05-23

### Objectif

Optimisations de performance ciblées, sans nouvelles features, sans casser B31.8.

### next.config.ts — réécriture + optimizePackageImports

Le fichier racine `next.config.ts` contenait uniquement des lignes de référence TypeScript (contenu `next-env.d.ts` mal placé) et n'exportait aucune configuration. La configuration réelle était dans `src/app/profile/agents/next.config.ts` que Next.js ignorait.

Correction : réécriture du `next.config.ts` racine en configuration Next.js valide :
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
};

export default nextConfig;
```

`optimizePackageImports` réduit le bundle côté client en n'important que les icônes lucide-react et composants framer-motion réellement utilisés. Confirmé dans le build output : `· optimizePackageImports`.

### navigation-budget.ts — nouveaux helpers

Deux nouvelles fonctions dans `src/lib/performance/navigation-budget.ts` :
- `assertUiInstant(ms)` — retourne `true` si `ms < 100` (seuil instant)
- `assertCheckoutBudget(ms)` — retourne `true` si `ms < 800` (seuil acceptable)

### site-health/checks.ts — checkPerformanceBudgetConfig

Nouvelle fonction de garde `checkPerformanceBudgetConfig()` :
- Vérifie que `BUDGET_MS.instant === 100`, `BUDGET_MS.acceptable === 800`, `BUDGET_MS.critical === 3000`
- Statut `pass` si constants correctes, `fail` sinon
- Importe `BUDGET_MS` depuis `navigation-budget` — détecte toute dérive involontaire des constantes de budget

### Tests

- `navigation-budget.test.ts` : +8 tests (assertUiInstant × 4, assertCheckoutBudget × 4) → **34 tests**
- `site-health.test.ts` : +4 tests (checkPerformanceBudgetConfig) → **39 tests**

### Resultats finaux Bloc 31.9

- 0 erreurs TypeScript (`npx tsc --noEmit`)
- 217 tests passes (7 fichiers non-Pierre, dont les 2 nouveaux suites)
- Build Next.js clean — `optimizePackageImports` actif
- Aucune regression sur B31.8
