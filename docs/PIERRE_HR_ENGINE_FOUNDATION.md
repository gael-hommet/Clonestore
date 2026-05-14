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
| Backward compat réponse API | Champ `interpretation` conservé avec les mêmes clés ; `tasks` toujours présent en top-level |
