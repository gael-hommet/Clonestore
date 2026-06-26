# TECH-08 — CloneOS Command Center Alignment

## 1. CloneOS est le noyau opératoire global

**CloneOS n'est pas Pierre.**
**CloneOS n'est pas CloneChat.**
**CloneOS est le noyau opératoire global.**

### Différences fondamentales

| Entité | Rôle | Couche |
|--------|------|--------|
| **CloneOS** | Noyau opératoire — reçoit, classifie, route, planifie, gouverne | Technologie globale |
| **CloneChat** | Interface conversationnelle (canal d'entrée) | Canal utilisateur |
| **Pierre** | Employé IA RH — exécute les missions HR | Employé IA métier |

CloneChat peut être l'une des sources d'une commande CloneOS (via `source: "clonechat"`).
Pierre peut être l'employé sélectionné par CloneOS pour une commande RH.
Mais CloneOS, CloneChat, et Pierre sont trois couches distinctes.

### Ce que CloneOS fait

```
User request (via CloneChat, Cockpit, API...)
  ↓
CloneOS interprète / classifie
  ↓
CloneOS sélectionne l'employé IA (Employee Runtime Contract — TECH-02)
  ↓
CloneOS construit le contexte (CloneADN — TECH-05)
  ↓
CloneOS applique CloneGuard (TECH-06) — chaque tâche évaluée
  ↓
CloneOS génère les événements CloneTrace (TECH-07)
  ↓
CloneOS retourne un plan d'exécution (pas d'exécution réelle)
```

---

## 2. Pipeline complet

```
CloneOSCommandInput
  ↓ normalize
  ↓ classifyCloneOSCommand()
     → domain: hr/finance/support/admin/legal/general
     → intent: create_document/prepare_email/hr_operation/...
     → risk_level: low/medium/high/critical
     → candidate_employee_slugs: [pierre] (si HR)
  ↓ routeCloneOSCommand()
     → Employee Runtime Contract (TECH-02)
     → Pierre = seul employé actif en V1
     → Si domaine non RH → no_employee
  ↓ buildCloneOSCommandContext()
     → EmployeeRuntimeContract (TECH-02)
     → GlobalTechnologyConfig (TECH-03)
     → GlobalEnterpriseMemory (TECH-05)
     → CloneGuardContext (TECH-06)
     → CloneTrace timeline_id (TECH-07)
  ↓ buildCloneOSCommandPlan()
     → CloneOSMissionPlan
     → CloneOSTaskPlan[] (pas d'exécution)
  ↓ evaluateCloneOSCommandPlanWithGuard()
     → evaluateGlobalGuard() pour chaque tâche (TECH-06)
     → invariants absolus enforced (legal/payroll/termination/signature → refuse)
  ↓ buildCloneOSCommandTraceEvents()
     → CloneTrace events (TECH-07)
     → request_received, mission_created, guard_evaluated, etc.
  ↓ CloneOSCommandCenterResult
     → ok: bool
     → status: ready_for_execution/requires_validation/blocked/refused
     → next_action: directive pour l'UI ou l'employé IA
```

---

## 3. Comment Employee Runtime Contract est utilisé (TECH-02)

Le router CloneOS consulte l'`EMPLOYEE_RUNTIME_REGISTRY` pour :
- Lister les employés actifs (`status: "active" | "beta"`)
- Vérifier le domaine de chaque employé
- Récupérer les technologies requises (hard + soft)
- Évaluer la readiness de l'employé

```typescript
// Pierre est le seul employé actif en V1
const route = routeCloneOSCommand(classified);
// → route.employee_slug === "pierre"
// → route.hard_required_technologies = ["cloneos", "cloneguard", ...]
```

---

## 4. Comment CloneADN est utilisé (TECH-05)

Le contexte CloneOS construit un `CloneOSEnterpriseMemoryContext` depuis `GlobalEnterpriseMemory` :
- `company_name`, `language`, `timezone`, `default_tone`
- `active_rules` (via Pierre ADN bridge)
- `has_enterprise_memory` (V1 : false — pas de Supabase branché)

```typescript
const memCtx = buildEnterpriseMemoryContextForCommand(companyId, "pierre");
// → { language: "fr", timezone: "Europe/Paris", active_rules: [], ... }
```

---

## 5. Comment CloneGuard est utilisé (TECH-06)

Chaque tâche du plan est évaluée individuellement via `evaluateGlobalGuard()` :

```typescript
const guardResult = evaluateCloneOSCommandPlanWithGuard(plan, context);
// → task_results: [{ decision: "allow" }, { decision: "refuse" }, ...]
// → overall_decision: "refused" (le plus restrictif l'emporte)
```

**Invariants absolus — jamais contournables :**

| Action | Décision Guard |
|--------|---------------|
| `legal_decision` | `refuse` |
| `payroll_execution` | `refuse` |
| `termination_decision` | `refuse` |
| `contract_signature` | `refuse` |

---

## 6. Comment CloneTrace est utilisé (TECH-07)

Les événements de trace sont générés (mais pas persistés en DB) :

```typescript
const events = buildCloneOSCommandTraceEvents(
  input, classified, route, plan, guardResult, timelineId
);
// → [request_received, mission_created, task_created, guard_evaluated, ...]
```

Chaque événement est `immutable: true`. Aucun ne peut être supprimé.

---

## 7. Comment Pierre est routé en V1

Pierre est le seul employé IA actif déclaré dans `EMPLOYEE_RUNTIME_REGISTRY`.
Le classifier détecte les mots-clés RH et assigne `candidate_employee_slugs: ["pierre"]`.

Pierre bridge :
```typescript
const result = processPierreCommandThroughCloneOS({
  company_id: "cmp_001",
  raw_request: "Préparer un contrat d'embauche",
  mission_type: "hr_document_generation",
});
```

Le bridge `pierre-cloneos-bridge.ts` construit l'input CloneOS sans modifier le moteur Pierre.

---

## 8. Pourquoi Emma/Lucas/Sophie ne sont pas créés

Emma (Support), Lucas (Finance), Sophie (Legal) sont sur la roadmap mais non déclarés dans le registry en V1.

Le router CloneOS retourne `is_available: false / readiness_status: "no_employee"` pour tout domaine sans employé déclaré. Il n'invente aucun employé.

---

## 9. Ce qui n'a PAS été fait dans TECH-08

| Ce qui n'a PAS été fait | Pourquoi |
|-------------------------|---------|
| Écriture en Supabase | Couche pure — pas de backend branché |
| Migration DB | Hors périmètre |
| UI lourde | TECH-08 = couche types/logique pure |
| Modification moteur Pierre | Pierre (B38-B48) est clos |
| Création Emma/Lucas/Sophie | Hors périmètre — pas encore déclarés |
| Vrai multi-agent autonome | Hors périmètre TECH-08 |
| CloneChat complet | CloneChat est un canal, pas CloneOS |
| CloneBrief complet | Hors périmètre — TECH-09 |
| CloneVoice | Non actif en production |
| Exécution de mission | TECH-08 = plan uniquement |
| Appels OpenAI/Anthropic | Classification heuristique déterministe |
| Modification checkout/Stripe | Hors périmètre |

---

## 10. Fichiers créés dans TECH-08

```
Créés :
  src/lib/clonestore/cloneos/cloneos-command-types.ts       — 23 types
  src/lib/clonestore/cloneos/cloneos-command-classifier.ts  — classification heuristique
  src/lib/clonestore/cloneos/cloneos-employee-router.ts     — routage Employee Registry
  src/lib/clonestore/cloneos/cloneos-command-context.ts     — contexte TECH-02+05+06+07
  src/lib/clonestore/cloneos/cloneos-command-plan.ts        — plan mission + tâches
  src/lib/clonestore/cloneos/cloneos-command-guard.ts       — intégration CloneGuard
  src/lib/clonestore/cloneos/cloneos-command-trace.ts       — intégration CloneTrace
  src/lib/clonestore/cloneos/cloneos-command-center.ts      — orchestrateur principal
  src/lib/clonestore/cloneos/cloneos-command-validation.ts  — 25 règles de validation
  src/lib/clonestore/cloneos/cloneos-command-snapshot.ts    — snapshot + health score
  src/lib/clonestore/cloneos/pierre-cloneos-bridge.ts       — bridge Pierre → CloneOS
  src/lib/clonestore/cloneos/index.ts                       — exports publics
  src/lib/clonestore/cloneos/__tests__/cloneos-command-center-tech08.test.ts — 67 tests
  docs/TECH_08_CLONEOS_COMMAND_CENTER_ALIGNMENT.md          — cette documentation

Non modifiés :
  src/lib/cloneos/**                    — AI/channels/files (B32-B39) intact
  src/lib/pierre/**                     — moteur Pierre intact
  src/lib/clonestore/guard/**           — TECH-06 intact
  src/lib/clonestore/trace/**           — TECH-07 intact
  src/lib/clonestore/adn/**             — TECH-05 intact
  go-live-proofs.local.json             — interdit
```

---

## 11. Différence src/lib/cloneos vs src/lib/clonestore/cloneos

| Module | Rôle |
|--------|------|
| `src/lib/cloneos/ai/` | Runtime IA — model-router, providers, cost-shield (B32-B38) |
| `src/lib/cloneos/channels/` | Email/canaux — Resend, send-policy (B33-B39) |
| `src/lib/cloneos/files/` | Gestion fichiers — extraction, security (B34-B37) |
| **`src/lib/clonestore/cloneos/`** | **Command Center global — TECH-08 (ce module)** |

Ces deux namespaces coexistent sans conflit.

---

## 12. Prochain bloc recommandé : TECH-09

**TECH-09 — CloneBrief Executive Summaries**

Objectif : créer la couche globale CloneBrief pour les synthèses exécutives.
CloneBrief consomme les données de CloneTrace (TECH-07) et CloneADN (TECH-05)
pour générer des résumés de l'activité des employés IA.

```
TECH-05 — CloneADN Global Enterprise Memory ✅
TECH-06 — CloneGuard + ClonePolicy Global Rules ✅
TECH-07 — CloneTrace Global Audit Timeline ✅
TECH-08 — CloneOS Command Center Alignment (ce bloc) ✅
TECH-09 — CloneBrief Executive Summaries
TECH-10 — CloneVoice Readiness Layer
TECH-11 — Technology Readiness Final Gate
```
