# TECH-06 — CloneGuard + ClonePolicy Global Rules

## 1. Pourquoi CloneGuard devient global

**Avant TECH-06 :** CloneGuard existait uniquement dans `src/lib/pierre/hr/cloneguard.ts` (Bloc 14)
et `src/lib/pierre/hr/clonepolicy.ts` (Bloc 15) comme outils Pierre-spécifiques.

**Après TECH-06 :** `CloneGuard` est la couche globale de gouvernance de toute la plateforme
CloneStore. Pierre est simplement le premier consommateur RH.

**Problème architecturel résolu :**
```
Avant : CloneGuard = le guard de Pierre
Après : CloneGuard = le moteur global qui décide pour TOUS les employés IA
```

La plateforme doit garantir les mêmes invariants pour Pierre, Emma, Lucas, Sophie,
et tout futur employé IA — même ceux qui ne sont pas encore créés.

---

## 2. Pourquoi ClonePolicy est interne à CloneGuard

**ClonePolicy n'est PAS une technologie client séparée.**

ClonePolicy est le moteur interne de règles exécuté dans le pipeline CloneGuard.
Dans `/profile/technologies`, il apparaît comme "Moteur interne" (control_level=internal_only).

Pipeline correct :
```
CloneGuard → évalue les invariants absolus + les règles ClonePolicy → décision finale
```

ClonePolicy sans CloneGuard n'a pas de sens architectural.

---

## 3. Pipeline complet

```
Request / Task / Action
  ↓
Employee Runtime Contract (TECH-02)
  ↓
GlobalEnterpriseMemory / CloneADN context (TECH-05)
  ↓
ClonePolicy rule evaluation          ← global-policy-evaluator.ts
  → listMatchingPolicyRules()
  → resolvePolicyEffectFromRules()
  ↓
CloneGuard risk decision             ← global-guard-evaluator.ts
  → applyAbsoluteInvariants()  ← invariants absolus (priorité max)
  → mapPolicyResultToGuardDecision()
  → resolveExecutionMode()
  ↓
CloneTrust autonomy hint             ← TECH-07+
  ↓
CloneTrace event                     ← TECH-07+
  ↓
result: allow / prepare_only / require_validation / block / refuse
```

---

## 4. Décisions possibles

| Décision | Description |
|----------|-------------|
| `allow` | Action autorisée, peut s'exécuter |
| `prepare_only` | Document/email préparé seulement, jamais distribué automatiquement |
| `require_validation` | Validation humaine obligatoire avant toute exécution |
| `block` | Action bloquée par une règle système |
| `refuse` | Action refusée — règle absolue (légal/éthique) |

Ordre de priorité (plus restrictif gagne) :
```
allow(0) < prepare_only(1) < require_validation(2) < block(3) < refuse(4)
```

---

## 5. Invariants absolus

Ces 4 invariants sont **jamais contournables**, même par un admin :

| Action | Décision | Motif |
|--------|----------|-------|
| `legal_decision` | `refuse` | Aucun employé IA ne peut prendre de décision légale autonome |
| `payroll_execution` | `refuse` | L'exécution officielle de la paie reste humaine |
| `termination_decision` | `refuse` | Aucun licenciement autonome |
| `contract_signature` | `refuse` | L'IA ne signe jamais |

Ces invariants sont vérifiés **avant** toute évaluation de règle politique.

---

## 6. Règles globales par défaut (12 règles)

| rule_id | Action | Effet | Sévérité |
|---------|--------|-------|----------|
| policy_001 | legal_decision | refuse | absolute |
| policy_002 | payroll_execution | refuse | absolute |
| policy_003 | termination_decision | refuse | absolute |
| policy_004 | contract_signature | refuse | absolute |
| policy_005 | send_email (medium/high/critical) | require_validation | critical |
| policy_006 | update_memory | require_validation | enforcement |
| policy_007 | toutes les actions | allow_with_warning + trace | enforcement |
| policy_008 | draft_document (high/critical) | prepare_only | critical |
| policy_009 | delete_data | block | critical |
| policy_010 | external_api_call | require_validation | enforcement |
| policy_011 | read_context (low) | allow | info |
| policy_012 | create_task (low/medium) | allow | info |

---

## 7. Comment Pierre utilise le bridge

Pierre peut utiliser CloneGuard Global via `pierre-guard-bridge.ts` sans modifier son moteur :

```typescript
import { evaluatePierreActionWithGlobalGuard } from "@/lib/clonestore/guard";

const result = evaluatePierreActionWithGlobalGuard({
  company_id: "cmp_001",
  pierre_action_type: "email.send",       // action Pierre native
  pierre_risk_level: "high",             // risque Pierre
  pierre_domain: "hr",
});
// → { decision: "require_validation", can_execute: false, human_validation_required: true }
```

Mappings Pierre → Global :

| Action Pierre | Action globale |
|---------------|----------------|
| draft_hr_document | draft_document |
| prepare_email / email.draft | draft_email |
| send_email / email.send | send_email |
| employee_record_update | modify_record |
| memory_update | update_memory |
| legal_or_disciplinary_decision | legal_decision |
| payroll_official | payroll_execution |
| termination / dismissal_action | termination_decision |
| contract_action / contract_signature | contract_signature |
| reminder_create / followup_schedule | create_task |

---

## 8. Ce qui reste spécifique à Pierre

| Module Pierre | Rôle | Statut |
|---------------|------|--------|
| `src/lib/pierre/hr/cloneguard.ts` | Guard RH Pierre-spécifique (Bloc 14) | Intact, non modifié |
| `src/lib/pierre/hr/clonepolicy.ts` | Policy RH Pierre-spécifique (Bloc 15) | Intact, non modifié |
| `src/lib/pierre/hr/governance.ts` | Orchestrateur Pierre (Bloc 15) | Intact, non modifié |
| `src/lib/pierre/hr/clonetrust.ts` | Trust Pierre-spécifique | Intact, non modifié |

Le moteur Pierre peut continuer à utiliser ses modules actuels indéfiniment.
Le bridge TECH-06 permet à Pierre d'utiliser la couche globale si souhaité,
mais le branchement runtime complet peut venir dans un futur bloc si nécessaire.

---

## 9. Ce qui n'a PAS été fait dans TECH-06

| Ce qui n'a PAS été fait | Pourquoi |
|-------------------------|----------|
| Écriture en Supabase | Pas de backend branché — TECH-06 = couche pure |
| Migration DB | Hors périmètre |
| UI lourde | TECH-06 = couche types/logique pure |
| Modification moteur Pierre | Pierre (B38-B48) est clos |
| Création Emma/Lucas/Sophie | Hors périmètre |
| CloneTrust complet | Hors périmètre TECH-06 |
| CloneTrace complet | Hors périmètre TECH-06 |
| Branchement runtime Pierre | Pierre peut utiliser le bridge, optionnel |
| Routes API | Non nécessaire en V1 |

---

## 10. Fichiers créés dans TECH-06

```
Créés :
  src/lib/clonestore/guard/global-guard-types.ts        — 25 types/interfaces
  src/lib/clonestore/guard/global-policy-defaults.ts    — 12 règles par défaut
  src/lib/clonestore/guard/global-policy-evaluator.ts   — évaluateur politique
  src/lib/clonestore/guard/global-guard-evaluator.ts    — évaluateur guard
  src/lib/clonestore/guard/global-guard-validation.ts   — 23 règles de validation
  src/lib/clonestore/guard/global-guard-snapshot.ts     — snapshot
  src/lib/clonestore/guard/employee-guard-access.ts     — accès employés IA
  src/lib/clonestore/guard/pierre-guard-bridge.ts       — bridge Pierre
  src/lib/clonestore/guard/index.ts                     — exports publics
  src/lib/clonestore/guard/__tests__/global-guard-policy-tech06.test.ts — 50 tests
  docs/TECH_06_CLONEGUARD_CLONEPOLICY_GLOBAL_RULES.md  — cette documentation

Non modifiés :
  src/lib/pierre/hr/cloneguard.ts   — moteur Pierre intact
  src/lib/pierre/hr/clonepolicy.ts  — moteur Pierre intact
  src/lib/pierre/hr/governance.ts   — moteur Pierre intact
  src/lib/pierre/hr/clonetrust.ts   — moteur Pierre intact
  go-live-proofs.local.json         — interdit
```

---

## 11. Prochain bloc recommandé : TECH-07

**TECH-07 — CloneTrace Global Audit Timeline**

Objectif : créer la couche globale CloneTrace au niveau plateforme.
Aujourd'hui CloneTrace existe partiellement dans Pierre.
TECH-07 extrait la couche d'audit pour qu'elle soit partageable entre tous les employés IA.

```
TECH-06 — CloneGuard + ClonePolicy Global Rules (ce bloc) ✅
TECH-07 — CloneTrace Global Audit Timeline
TECH-08 — CloneOS Command Center Alignment
TECH-09 — CloneBrief Executive Summaries
TECH-10 — CloneVoice Readiness Layer
TECH-11 — Technology Readiness Final Gate
```
