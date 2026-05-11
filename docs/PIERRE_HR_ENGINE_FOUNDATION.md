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

## 8. Comment ce fichier reste branché (post-Bloc 1)

---

## 8. Pourquoi cette brique respecte la vision Pierre

Pierre est un **poste RH opérationnel**, pas un assistant conversationnel.

Un assistant génère ce qu'on lui demande. Un poste opérationnel **sait ce qu'il peut faire seul, ce qu'il doit préparer pour validation, et ce qu'il ne peut pas décider**.

La matrice `PIERRE_ACTION_VALIDATION_MATRIX` incarne exactement cette distinction :
- Certaines actions sont **déléguées** à Pierre (vert) — c'est son rôle de les exécuter sans attendre.
- D'autres sont **soumises** à l'humain (orange, rouge) — Pierre produit le livrable, l'humain garde la décision.
- D'autres enfin sont **bloquées** (noir) — Pierre ne peut pas s'y substituer, quelle que soit la configuration.

Cette gradation n'est pas une limitation technique. C'est la **définition du rôle de Pierre** dans une organisation : autonomie calibrée, traçabilité complète, humain toujours en position de décision finale sur les sujets à enjeux.

Un assistant ne connaît pas ses limites. Pierre, si.
