# TECH-03 — Global Technology Config Model

## 1. Pourquoi ce modèle existe

Avant TECH-03, deux couches technologiques coexistaient dans CloneStore :

| Couche | Fichiers | Couverture |
|---|---|---|
| B46 visible layer | `technology-b46-types.ts`, `technology-b46-registry.ts` | 6 technologies visibles |
| Registry/contracts | `contracts.ts`, `registry.ts` | 12 TechnologySlugs |

Cette dualité créait un problème : les 13 technologies (incluant ClonePolicy, interne) n'avaient
pas de modèle unifié pour la configuration, le statut, les guardrails, la visibilité et les
overrides employé.

TECH-03 crée **GlobalTechnologyConfig** — un modèle unifié couvrant les 13 technologies
avec un type cohérent, configurable par le client, et relié au Employee Runtime Contract (TECH-02).

---

## 2. Pourquoi 13 technologies, pas 12

`TechnologySlug` (contracts.ts) couvre 12 technologies. Il n'inclut pas `clonepolicy`.

ClonePolicy n'est pas un produit client autonome — c'est un **moteur interne** qui s'exécute
dans le pipeline de CloneGuard :

```
CloneGuard → ClonePolicy → CloneTrust
```

ClonePolicy est donc présent dans `GlobalTechnologyKey` (13 clés) mais :
- Absent de `TechnologySlug` (contracts.ts) — inchangé
- `control_level: "internal_only"`
- `visible_to_customer: false`
- `required_for_employee_runtime: false` (il est déclenché par CloneGuard, pas directement)

Cette distinction est intentionnelle et documentée dans les deux fichiers de types.

---

## 3. Architecture GlobalTechnologyKey

```typescript
// GlobalTechnologyKey — superset de TechnologySlug
// 13 clés = 12 TechnologySlugs + "clonepolicy"
export type GlobalTechnologyKey =
  | "cloneos"        // Core — orchestration
  | "cloneadn"       // Memory — enterprise memory
  | "cloneguard"     // Governance — risk validation
  | "clonetrace"     // Traceability — audit trail
  | "clonevoice"     // Interface — voice (roadmap)
  | "clonechat"      // Interface — conversational
  | "clonepolicy"    // Governance — policy engine (interne, dans CloneGuard)
  | "clonecontinuum" // Automation — session continuity
  | "clonetrust"     // Governance — gradual autonomy (NOT zero-trust)
  | "clonereview"    // Quality — deliverable control (roadmap)
  | "clonesignals"   // Automation — triggers & alerts (roadmap)
  | "clonelearn"     // Learning — governed learning (roadmap)
  | "clonebrief";    // Executive — briefing engine (roadmap)
```

---

## 4. Structure d'une GlobalTechnologyConfig

Chaque technologie a une configuration avec :

| Champ | Description |
|---|---|
| `key` | GlobalTechnologyKey — identifiant unique |
| `display_name` | Nom affiché |
| `short_description` | Description courte pour UI |
| `category` | core, governance, memory, traceability, interface, automation, quality, learning, executive |
| `visibility` | public, customer_only, internal, beta, hidden |
| `status` | active, partial, disabled, roadmap, locked |
| `mode` | production, supervised, test, disabled, roadmap |
| `runtime_status` | operational, partial, unavailable, not_implemented |
| `control_level` | platform_locked, company_configurable, employee_override_allowed, internal_only |
| `risk_mode` | conservative, balanced, permissive, disabled |
| `autonomy_level` | none, suggest_only, supervised, semi_autonomous, autonomous |
| `configurable_by_customer` | Boolean — customer peut configurer |
| `locked_by_platform` | Boolean — verrouillé par CloneStore |
| `visible_to_customer` | Boolean — visible dans l'interface client |
| `required_for_public_launch` | Boolean — bloquant pour le go-live |
| `required_for_employee_runtime` | Boolean — requis pour exécuter un employé IA |
| `supports_employee_overrides` | Boolean — per-employee overrides activés |
| `employee_overrides` | GlobalTechnologyEmployeeOverride[] |
| `settings` | Record<string, unknown> — settings libres par technologie |
| `guardrails` | GlobalTechnologyGuardrails — contraintes de sécurité |
| `dependencies` | GlobalTechnologyKey[] — dépendances |
| `conflicts` | GlobalTechnologyKey[] — conflits |
| `readiness_score` | 0–100 — score issu de l'audit TECH-01 |

---

## 5. Scores TECH-01 (scores de base)

| Technologie | Score | Statut |
|---|---|---|
| CloneOS | 85 | active / partial |
| CloneADN | 80 | active / partial |
| CloneGuard | 85 | active / partial |
| CloneTrace | 80 | active / partial |
| CloneContinuum | 65 | partial |
| CloneTrust | 60 | partial |
| CloneVoice | 15 | partial / disabled |
| CloneChat | 50 | partial |
| ClonePolicy | 85 | active (interne, pipeline) |
| CloneReview | 10 | roadmap |
| CloneSignals | 5 | roadmap |
| CloneLearn | 5 | roadmap |
| CloneBrief | 5 | roadmap |

---

## 6. CloneTrust — Autonomie Graduelle (NOT zero-trust)

**Règle absolue** : CloneTrust = autonomie graduelle (gradual autonomy).

CloneTrust calibre progressivement l'autonomie des employés IA au fur et à mesure que la
confiance est établie par des comportements vérifiés.

```typescript
settings: {
  trust_model: "gradual_autonomy",  // NOT "zero_trust"
  baseline_autonomy: "supervised",
  escalation_threshold: 0.8,
}
```

Ne jamais vendre CloneTrust comme un système "zéro-confiance". Ce n'est pas ce que c'est.

---

## 7. Compatibilité B46 — Bridge Layer

TECH-03 n'a pas modifié les fichiers B46 existants. Un bridge dédié assure la compatibilité :

```
global-tech-b46-bridge.ts
  mapGlobalConfigToB46Item()           — Config → B46TechnologyItem
  buildB46CompatibleTechnologyItemsFromGlobal()  — 6 items B46 à partir des configs globales
  isB46TechnologyId()                  — type guard
  getB46VisibleTechnologyKeys()        — les 6 IDs B46
  getB46ConfigsFromGlobal()            — 6 configs B46 depuis les 13 globales
  getNonB46ConfigsFromGlobal()         — 7 configs non-B46 (roadmap/interne)
```

Cette architecture garantit que le code existant utilisant B46 continue de fonctionner sans
modification, tandis que les nouvelles fonctionnalités utilisent GlobalTechnologyConfig.

---

## 8. Fichiers créés dans TECH-03

```
src/lib/clonestore/technologies/
  global-tech-config.ts      — GlobalTechnologyKey + tous les types
  global-tech-defaults.ts    — DEFAULT_GLOBAL_TECH_CONFIGS pour 13 technologies
  global-tech-snapshot.ts    — buildGlobalTechnologyConfigSnapshot + helpers
  global-tech-validation.ts  — validateGlobalTechnologyConfig (20 règles)
  global-tech-b46-bridge.ts  — Bridge B46 ↔ Global
  global-tech-storage.ts     — Sérialisation/désérialisation pour stockage
  index.ts                   — Exports centralisés (TECH-03 uniquement, pas B46)

  __tests__/
    global-tech-config-tech03.test.ts  — 50+ tests statiques et logiques

docs/
  TECH_03_GLOBAL_TECHNOLOGY_CONFIG_MODEL.md  — ce fichier
```

**Fichiers NON modifiés** :
- `contracts.ts` — TechnologySlug inchangé
- `registry.ts` — TECHNOLOGY_DEFINITIONS inchangé
- `technology-b46-types.ts` — B46 types inchangés
- `technology-b46-registry.ts` — B46 registry inchangée
- `configuration.ts`, `storage.ts` — helpers existants inchangés
- Pierre moteur (`src/lib/pierre/`) — inchangé

---

## 9. Règles de validation (20 règles)

| Code | Règle |
|---|---|
| R01 | key doit être un GlobalTechnologyKey valide |
| R02 | display_name doit être non-vide |
| R03 | short_description doit être non-vide |
| R04 | readiness_score doit être 0–100 |
| R05 | locked_by_platform + configurable_by_customer = contradiction |
| R06 | internal_only + visible_to_customer = contradiction |
| R07 | required_for_public_launch implique required_for_employee_runtime |
| R08 | status=roadmap interdit required_for_employee_runtime=true |
| R09 | mode=roadmap requiert status=roadmap |
| R10 | runtime_status=not_implemented ↔ status roadmap/disabled (warning) |
| R11 | supports_employee_overrides → control_level approprié (warning) |
| R12 | employee_overrides : employee_slug non-vide |
| R13 | employee_overrides non-vide mais supports_employee_overrides=false |
| R14 | dependencies → GlobalTechnologyKeys valides |
| R15 | conflicts → GlobalTechnologyKeys valides |
| R16 | un key ne peut pas se lister lui-même en conflict |
| R17 | un key ne peut pas se lister lui-même en dependency |
| R18 | governance + permissive/disabled risk_mode (warning) |
| R19 | created_at doit être présent |
| R20 | updated_at doit être présent |

---

## 10. Prochain bloc recommandé : TECH-04

**TECH-04 — Profile Technologies Configuration UI**

Objectif : créer l'UI de configuration des technologies pour la page `/profile/technologies`.
Utilise les types GlobalTechnologyConfig (TECH-03) pour piloter l'affichage.

Corrections UI à apporter (identifiées en TECH-01) :
- CloneVoice badge "Actif" → corriger (status=disabled)
- CloneTrust description "zéro-confiance" → corriger (autonomie graduelle)
- Afficher les 13 technologies avec statuts corrects (pas seulement 6 visibles + 6 roadmap)

Cet ordre est verrouillé :
```
TECH-03 — Global Technology Config Model (ce bloc) ✅
TECH-04 — Profile Technologies Configuration UI
TECH-05 — CloneADN Global / Enterprise Memory
TECH-06 — CloneGuard + ClonePolicy Global Rules
TECH-07 — CloneTrace Global Audit Timeline
TECH-08 — CloneOS Command Center Alignment
TECH-09 — CloneBrief Executive Summaries
TECH-10 — CloneVoice Readiness Layer
TECH-11 — Technology Readiness Final Gate
```
