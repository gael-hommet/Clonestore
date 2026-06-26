# TECH-07 — CloneTrace Global Audit Timeline

## 1. Pourquoi CloneTrace devient global

**Avant TECH-07 :** CloneTrace existait partiellement dans Pierre (audit trail B38-B43)
comme outil Pierre-spécifique.

**Après TECH-07 :** `CloneTrace` est la couche globale d'audit immuable de toute la
plateforme CloneStore. Pierre est simplement le premier producteur d'événements via un bridge.

**Problème architecturel résolu :**
```
Avant : CloneTrace = l'historique de Pierre
Après : CloneTrace = la mémoire d'audit globale de toute la plateforme
```

La plateforme doit garantir une piste d'audit cohérente pour Pierre, Emma, Lucas, Sophie,
et tout futur employé IA — même ceux qui ne sont pas encore créés.

**Invariants absolus de CloneTrace :**
1. Un événement créé ne peut jamais être supprimé.
2. Un événement critique ne peut jamais être modifié sans trace.
3. Aucune donnée sensible brute dans les métadonnées ou résumés.
4. `immutable: true` sur tous les événements, toujours.

---

## 2. Pipeline complet avec CloneTrace

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
  → applyAbsoluteInvariants()
  → mapPolicyResultToGuardDecision()
  → resolveExecutionMode()
  ↓
CloneTrace audit event               ← guard-trace-bridge.ts
  → createTraceEventFromGuardDecision()
  → addEventToTimeline()             ← NOUVEAU — TECH-07
  ↓
CloneTrust autonomy hint             ← TECH-08+
  ↓
result: allow / prepare_only / require_validation / block / refuse
```

---

## 3. Types d'événements (30 types)

| Catégorie | Event Types |
|-----------|-------------|
| Missions | `request_received`, `mission_created` |
| Tâches | `task_created`, `task_started`, `task_completed`, `task_failed` |
| Décisions Guard | `action_attempted`, `action_allowed`, `action_prepared`, `action_requires_validation`, `action_blocked`, `action_refused` |
| Validation humaine | `validation_requested`, `validation_approved`, `validation_rejected` |
| Documents/Emails | `document_prepared`, `email_prepared`, `email_sent` |
| Mémoire | `memory_read`, `memory_update_proposed`, `memory_update_approved` |
| Infrastructure | `guard_evaluated`, `policy_matched` |
| Coordination | `employee_handoff`, `schedule_created`, `schedule_triggered`, `retry_scheduled` |
| Système | `error_recorded`, `proof_attached`, `system_note` |

---

## 4. Immuabilité des événements

```typescript
// Invariant structurel :
interface GlobalTraceEvent {
  immutable: true;        // Jamais false
  // ...
}

// Timeline : pas de suppression
// La fonction deleteTraceEvent n'existe pas dans global-trace-storage.ts
// appendTraceEvent() est l'unique voie d'entrée

// Idempotence : même event_id → ignoré (pas d'erreur, pas de doublon)
```

---

## 5. Sanitisation des données sensibles

Les clés suivantes sont **automatiquement redactées** dans les métadonnées :

```
password, token, secret, api_key, authorization, stripe, supabase,
openai, anthropic, private_key, webhook_secret, sk_live_, whsec_,
OPENAI_API_KEY, ANTHROPIC_API_KEY
```

Le résumé (`summary`) est passé dans `sanitizeTraceSummary()` qui retire les patterns :
- `sk_live_*` → `[REDACTED_TOKEN]`
- `whsec_*` → `[REDACTED_SECRET]`
- `Bearer <token>` → `[REDACTED_BEARER]`

---

## 6. Types d'acteurs

| Actor Type | Qui |
|-----------|-----|
| `human_user` | Utilisateur humain (approbation, validation) |
| `ai_employee` | Pierre, et futurs employés IA |
| `cloneguard` | CloneGuard (décisions de gouvernance) |
| `clonepolicy` | ClonePolicy (évaluation des règles) |
| `clonetrace` | CloneTrace lui-même (événements système) |
| `cloneadn` | CloneADN (accès mémoire entreprise) |
| `cloneos` | CloneOS (orchestration) |
| `system` | Système d'initialisation |
| `external_service` | Service externe |

---

## 7. Bridge Guard → Trace

```typescript
import { createTraceEventFromGuardDecision } from "@/lib/clonestore/trace";

const traceEvent = createTraceEventFromGuardDecision({
  company_id: "cmp_001",
  timeline_id: "tl_cmp_001",
  decision: "refuse",
  action_type: "legal_decision",
  risk_level: "critical",
  rule_ids_matched: ["policy_001"],
  employee_slug: "pierre",
});
// → event_type: "action_refused"
// → severity: "critical"
// → guard_decision.decision: "refuse"
```

Mapping Guard → Trace :

| Décision Guard | Event Type Trace |
|---------------|-----------------|
| `allow` | `action_allowed` |
| `prepare_only` | `action_prepared` |
| `require_validation` | `action_requires_validation` |
| `block` | `action_blocked` |
| `refuse` | `action_refused` |

---

## 8. Bridge Pierre → Trace

Pierre peut alimenter CloneTrace via `pierre-trace-bridge.ts` sans modifier son moteur :

```typescript
import { createTraceEventFromPierreEvent } from "@/lib/clonestore/trace";

const traceEvent = createTraceEventFromPierreEvent({
  company_id: "cmp_001",
  timeline_id: "tl_cmp_001",
  pierre_event_type: "document_generated",  // type Pierre natif
  summary: "Lettre d'avertissement préparée",
  risk_level: "medium",
  mission_id: "m_123",
});
// → event_type: "document_prepared"
// → source: "pierre_bridge"
// → employee_slug: "pierre"
```

Mappings Pierre → Global (sélection) :

| Event Pierre | Event Global |
|--------------|-------------|
| `mission_created` | `mission_created` |
| `document_generated` | `document_prepared` |
| `email_drafted` | `email_prepared` |
| `validation_required` | `validation_requested` |
| `validation_approved` | `validation_approved` |
| `memory_update` | `memory_update_proposed` |
| `guard_blocked` | `action_blocked` |
| `error` | `error_recorded` |
| `reminder_created` | `schedule_created` |

---

## 9. Score de santé de la timeline

Le snapshot calcule un score entre 0 et 100 :

| Condition | Pénalité |
|-----------|---------|
| Chaque événement `critical` | -10 pts (max -40) |
| Chaque événement `error` | -5 pts (max -20) |
| Chaque statut `blocked` | -3 pts (max -15) |
| Chaque statut `refused` | -8 pts (max -24) |
| Validation en attente > 5 | -5 pts |
| Timeline vide | 50 pts |

| Score | Statut |
|-------|--------|
| 0 événements | `empty` |
| 80–100 | `healthy` |
| 50–79 | `degraded` |
| 0–49 | `critical` |

---

## 10. Ce qui reste spécifique à Pierre

| Module Pierre | Rôle | Statut |
|---------------|------|--------|
| `src/lib/pierre/hr/cloneguard.ts` | Guard RH Pierre-spécifique (Bloc 14) | Intact, non modifié |
| `src/lib/pierre/hr/clonepolicy.ts` | Policy RH Pierre-spécifique (Bloc 15) | Intact, non modifié |
| `src/lib/pierre/hr/governance.ts` | Orchestrateur Pierre (Bloc 15) | Intact, non modifié |
| `src/lib/pierre/hr/clonetrust.ts` | Trust Pierre-spécifique | Intact, non modifié |

---

## 11. Ce qui n'a PAS été fait dans TECH-07

| Ce qui n'a PAS été fait | Pourquoi |
|-------------------------|---------|
| Écriture en Supabase | Pas de backend branché — TECH-07 = couche pure |
| Migration DB | Hors périmètre |
| UI lourde | TECH-07 = couche types/logique pure |
| Modification moteur Pierre | Pierre (B38-B48) est clos |
| Création Emma/Lucas/Sophie | Hors périmètre |
| CloneTrust complet | Hors périmètre TECH-07 |
| Branchement runtime Pierre | Pierre peut utiliser le bridge, optionnel |
| Routes API | Non nécessaire en V1 |
| Suppression d'événements | Interdit par design — audit immuable |

---

## 12. Fichiers créés dans TECH-07

```
Créés :
  src/lib/clonestore/trace/global-trace-types.ts           — 25+ types/interfaces
  src/lib/clonestore/trace/global-trace-defaults.ts        — constructeurs d'acteurs et timelines
  src/lib/clonestore/trace/global-trace-event-factory.ts   — factories d'événements + sanitisation
  src/lib/clonestore/trace/global-trace-timeline.ts        — gestion timeline (ajout, filtrage, groupements)
  src/lib/clonestore/trace/global-trace-validation.ts      — 30 règles de validation
  src/lib/clonestore/trace/global-trace-snapshot.ts        — snapshot avec score de santé
  src/lib/clonestore/trace/global-trace-storage.ts         — store en mémoire (pas de suppression)
  src/lib/clonestore/trace/employee-trace-access.ts        — profils d'accès employés IA
  src/lib/clonestore/trace/guard-trace-bridge.ts           — CloneGuard → CloneTrace bridge
  src/lib/clonestore/trace/pierre-trace-bridge.ts          — Pierre → CloneTrace bridge
  src/lib/clonestore/trace/index.ts                        — exports publics
  src/lib/clonestore/trace/__tests__/global-trace-timeline-tech07.test.ts — 60+ tests
  docs/TECH_07_CLONETRACE_GLOBAL_AUDIT_TIMELINE.md         — cette documentation

Non modifiés :
  src/lib/pierre/hr/cloneguard.ts   — moteur Pierre intact
  src/lib/pierre/hr/clonepolicy.ts  — moteur Pierre intact
  src/lib/pierre/hr/governance.ts   — moteur Pierre intact
  src/lib/pierre/hr/clonetrust.ts   — moteur Pierre intact
  go-live-proofs.local.json         — interdit
```

---

## 13. Prochain bloc recommandé : TECH-08

**TECH-08 — CloneOS Command Center Alignment**

Objectif : aligner CloneOS avec les couches globales TECH-05/06/07.
CloneOS est déjà partiellement implémenté ; TECH-08 connecte CloneOS
aux couches globales CloneGuard, CloneADN et CloneTrace.

```
TECH-05 — CloneADN Global Enterprise Memory ✅
TECH-06 — CloneGuard + ClonePolicy Global Rules ✅
TECH-07 — CloneTrace Global Audit Timeline (ce bloc) ✅
TECH-08 — CloneOS Command Center Alignment
TECH-09 — CloneBrief Executive Summaries
TECH-10 — CloneVoice Readiness Layer
TECH-11 — Technology Readiness Final Gate
```
