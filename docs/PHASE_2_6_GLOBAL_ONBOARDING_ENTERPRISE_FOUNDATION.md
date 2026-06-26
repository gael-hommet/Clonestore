# PHASE 2.6 — Global Onboarding Enterprise Foundation

> Généré le : 2026-06-03
> Base : TECH-01 → TECH-11 validés. PHASE 2.1 → 2.5 validées. Moteur Pierre intact.
> Public launch : NO-GO externe.

---

## 1. Objectif PHASE 2.6

Créer le premier onboarding global CloneStore : `/profile/onboarding/page.tsx`.

**Ce n'est pas le setup Pierre.** C'est la configuration de l'entreprise entière :
- Identité entreprise → CloneADN Global (TECH-05)
- Équipe & humains → EnterpriseHumanRegistry
- Documents → EnterpriseDocumentProfile
- Règles & validations → EnterpriseRuleProfile
- Technologies → aperçu lecture seule (TECH-03)
- Première mission guidée → Pierre (plan-only)

---

## 2. Différence onboarding global vs setup Pierre

| | Onboarding global PHASE 2.6 | Setup Pierre `/agents/pierre/setup` |
|--|--|--|
| Périmètre | Toute l'entreprise CloneStore | Pierre uniquement (HR) |
| Données | Identité, humains, docs, règles, techs | Identity, communication, policies RH |
| Persistance | Local state guidé — pas de DB | SavePayload → Supabase pierre_company_memory |
| Page | `/profile/onboarding` | `/agents/pierre/setup` |
| Lien | Post-paiement global | Post-activation Pierre |

Ces deux pages coexistent et sont complémentaires. L'onboarding global oriente vers `/agents/pierre/setup` en étape 6.

---

## 3. Étapes onboarding (6 étapes wizard)

| # | Étape | Contenu | Type CloneADN |
|---|-------|---------|---------------|
| 1 | Identité entreprise | company_name, industry, size_range, country, language, timezone, description | `EnterpriseIdentityProfile` |
| 2 | Équipe & humains | full_name, role_title, department, is_approver, validation_scope | `EnterpriseHumanProfile` |
| 3 | Documents | title, document_type, is_official, applies_to_domains | `EnterpriseDocumentProfile` |
| 4 | Règles & validations | title, domain, risk_level, requires_validation, description | `EnterpriseRuleProfile` |
| 5 | Technologies | Lecture seule — 5 technologies cockpit (TECH-03) | `GlobalTechnologyConfig` |
| 6 | Première mission Pierre | 3 templates plan-only | `GlobalOnboardingFirstMissionDraft` |

### Progression

- Barre de progression globale (0-100%)
- Score CloneADN en temps réel (`computeCoverageScore`)
- Chaque étape peut être passée (skipped)
- StepIndicator visuel (pending / in_progress / done / skipped)

---

## 4. CloneADN Global

### Imports utilisés

```typescript
import {
  buildEmptyGlobalEnterpriseMemory,
  computeCoverageScore,
  validateGlobalEnterpriseMemory,
} from "@/lib/clonestore/adn";
import type {
  EnterpriseIdentityProfile,
  EnterpriseHumanProfile,
  EnterpriseDocumentProfile,
  EnterpriseRuleProfile,
  GlobalEnterpriseMemory,
} from "@/lib/clonestore/adn";
```

### buildMemoryFromDraft

Construit un `GlobalEnterpriseMemory` valide depuis le draft onboarding :
- `identity` → depuis `GlobalOnboardingCompanyDraft`
- `humans.humans[]` → depuis `GlobalOnboardingHumanDraft[]` (mappage `EnterpriseHumanProfile`)
- `documents[]` → depuis `GlobalOnboardingDocumentDraft[]` (mappage `EnterpriseDocumentProfile`)
- `rules[]` → depuis `GlobalOnboardingRuleDraft[]` (mappage `EnterpriseRuleProfile`)

### Score de complétude (temps réel)

`computeCoverageScore(memoryDraft)` → score 0-100 affiché dans le résumé CloneADN.

### Validation

`validateGlobalEnterpriseMemory(memoryDraft)` → badge "Valide" / "Incomplet".

---

## 5. Employee Runtime / Pierre actif

### Imports

```typescript
import {
  PIERRE_EMPLOYEE_RUNTIME_CONTRACT,
  EMPLOYEE_RUNTIME_REGISTRY,
} from "@/lib/clonestore/employees/employee-registry";
```

### Affichage étape 6

- Nom : Pierre
- Domaine : RH
- Statut : launch candidate
- `public_positioning` depuis le contrat
- Liens : `/agents/pierre/use` + `/agents/pierre/setup`
- Microcopy : "Pierre est le seul employé IA actif en V1 — domaine RH."
- "Aucune action sensible ne part sans validation humaine."

---

## 6. Technologies affichées

### Imports

```typescript
import {
  DEFAULT_GLOBAL_TECH_CONFIGS,
  DEFAULT_GLOBAL_TECH_CONFIG_LIST,
} from "@/lib/clonestore/technologies/global-tech-defaults";
```

### Technologies cockpit

5 technologies en lecture seule : `cloneos`, `cloneadn`, `cloneguard`, `clonetrace`, `clonebrief`.

Pour chaque : display_name · short_description · status · readiness_score (barre progress).

### CloneVoice

> "CloneVoice n'est pas actif en production — préparation uniquement."

### Lien

→ `/profile/technologies` pour configuration complète.

---

## 7. Première mission guidée Pierre

3 templates plan-only :

| Template | Prompt | Type |
|---------|--------|------|
| 1 | "Prépare un email d'accueil pour un nouveau salarié." | `hr_email_onboarding` |
| 2 | "Qualifie une absence et identifie les informations manquantes." | `absence_followup` |
| 3 | "Prépare un document RH simple prêt à validation." | `hr_document_simple` |

Chaque template : `plan_only: true`, `employee_slug: "pierre"`.

CTA principal → `/agents/pierre/use` (cockpit Pierre).

Microcopy : "Pierre préparera un plan et des brouillons. Aucune action sensible ne part sans validation humaine."

---

## 8. Local state / pas de persistance DB

### Types onboarding

- `GlobalOnboardingStepId` — 6 valeurs
- `GlobalOnboardingStepStatus` — pending / in_progress / done / skipped
- `GlobalOnboardingCompanyDraft`, `GlobalOnboardingHumanDraft`, `GlobalOnboardingDocumentDraft`, `GlobalOnboardingRuleDraft`, `GlobalOnboardingFirstMissionDraft`
- `GlobalOnboardingState` — état complet du wizard

### Pas de localStorage

Les données restent en `useState` — non persistées.
"Configuration locale guidée — aucune donnée envoyée."

### Pas de Supabase

Zéro écriture DB. Zéro appel réseau (hors auth Supabase si utilisateur connecté).

---

## 9. Garde-fous

| Guard | Affichage |
|-------|-----------|
| Plan-only | "Aucune action exécutée depuis cet onboarding." |
| Validation humaine | "Validation humaine obligatoire sur les actions sensibles." |
| Pierre seul actif | "Pierre est le seul employé IA actif en V1 — domaine RH." |
| CloneVoice | "CloneVoice n'est pas actif en production — préparation uniquement." |
| Local state | "Configuration locale guidée — aucune donnée persistée à ce stade." |
| Lecture seule | Actions CTA vers cockpit / technologies — pas d'exécution |

---

## 10. Ce qui n'a PAS été fait

| Non fait | Raison |
|----------|--------|
| Persistance Supabase onboarding | PHASE 2.7+ |
| Modification `/agents/pierre/setup` | Règle absolue — intact |
| Écriture GlobalEnterpriseMemory en DB | PHASE 2.7+ |
| Emma / Lucas / Sophie actifs | INTERDIT |
| Pierre moteur touché | INTERDIT |
| OpenAI / Anthropic / Stripe | INTERDIT |
| Public launch approuvé | INTERDIT |

---

## 11. Fichiers créés

| Fichier | Contenu |
|---------|---------|
| `src/app/profile/onboarding/page.tsx` | Page wizard 6 étapes + CloneADN + Pierre + techs |
| `docs/PHASE_2_6_GLOBAL_ONBOARDING_ENTERPRISE_FOUNDATION.md` | Ce document |
| `src/app/profile/__tests__/phase-2-6-global-onboarding-enterprise.test.ts` | 45 tests statiques |

---

## 12. Invariants respectés

- `npx tsc --noEmit` : 0 erreur
- Pierre moteur `src/lib/pierre/**` : INTOUCHÉ
- `/agents/pierre/setup` : INTOUCHÉ
- GO-LIVE 01 → GO-LIVE 10 : INTACTS
- TECH-01 → TECH-11 : INTACTS
- PHASE 2.1 → 2.5 tests : TOUJOURS VERTS
- Aucune écriture Supabase
- Aucune action exécutée

---

## 13. Prochain bloc recommandé : PHASE 2.7

**PHASE 2.7 — Pierre Cockpit Integration Into Global Space**

Objectif : intégrer les résultats CloneOS de PHASE 2.3/2.4 dans le cockpit Pierre `/agents/pierre/use` — rendre visibles les plans et résultats CloneOS depuis le cockpit Pierre, et vice versa.

```
PHASE 2.1 ✅ Audit verrouillé
PHASE 2.2 ✅ Cockpit shell connecté
PHASE 2.3 ✅ CloneOS Command Bar
PHASE 2.4 ✅ Last Request Panel / Timeline
PHASE 2.5 ✅ Messages Center 4 Tabs
PHASE 2.6 ✅ Global Onboarding (ce bloc)
PHASE 2.7 → Pierre Cockpit Integration Into Global Space
PHASE 2.8 → Responsive Polish
PHASE 2.9 → Final QA Gate
```
