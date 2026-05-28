# B44 — Empreinte Entreprise & Empreinte Pierre Final Setup

**Status**: CLOS  
**Date**: 2026-05-27  
**Bloc**: B44  

---

## Objectif

Transformer Pierre d'un moteur RH générique en un **poste de travail RH personnalisé par client**.  
Après B44, Pierre sait : quelle entreprise il sert, comment elle communique, qui valide quoi, quels risques bloquer, quels workflows RH sont actifs, quels canaux utiliser, quelles règles RH suivre, quels documents préparer (B45), quel niveau d'autonomie est autorisé, et quelle mémoire initiale injecter dans CloneADN.

---

## Architecture B44

### Deux empreintes distinctes

| Empreinte | Clé mémoire | Contenu |
|-----------|-------------|---------|
| `EnterpriseEmpreinte` | `enterprise_empreinte` | Identité légale, localisation, rôles, gouvernance, canaux |
| `PierreEmpreinte` | `pierre_empreinte` | Config Pierre : scope RH, règles, autonomie, style docs |

Stockage dans `pierre_company_memory.memory_json` — deux clés séparées, jamais croisées.  
CloneADN reste dans `reusable_rh_context_json.clone_adn` — aucune contamination.

### Modules créés

```
src/lib/clonestore/empreinte/
  types.ts                    — Types EnterpriseEmpreinte
  enterprise-defaults.ts      — Valeurs par défaut sécurisées
  enterprise-completion.ts    — Score de complétion (9 sections pondérées)
  enterprise-validation.ts    — Validation champs (email, hex, enums)
  enterprise-normalizer.ts    — Normalizer pur (pas d'async, pas de side effects)
  enterprise-memory-bridge.ts — Read/write depuis memory_json

src/lib/pierre/empreinte/
  types.ts                    — Types PierreEmpreinte
  pierre-defaults.ts          — Valeurs par défaut Pierre
  pierre-completion.ts        — Score de complétion (12 sections pondérées)
  pierre-validation.ts        — Validation Pierre
  pierre-normalizer.ts        — Normalizer Pierre pur
  pierre-memory-bridge.ts     — Read/write depuis memory_json
  pierre-workflow-config.ts   — Config runtime workflows depuis empreinte
  pierre-document-prep.ts     — Handoff B45 : variables de rendu document
  pierre-empreinte-verdict.ts — Verdict global (7 areas, 5 niveaux)

src/app/api/pierre/empreinte/
  snapshot/route.ts           — GET  : snapshot combiné
  save/route.ts               — POST : save avec auth + strip tenant
  validate/route.ts           — POST : validation sans persistance
  reset/route.ts              — POST : reset enterprise | pierre | all
```

---

## Scoring de complétion

### EnterpriseEmpreinte (9 sections)

| Section | Poids |
|---------|-------|
| company_identity | 30% |
| communication | 15% |
| autonomy | 15% |
| data_governance | 10% |
| document_preferences | 10% |
| memory_seed | 5% |
| locations | 5% |
| roles | 5% |
| validation_circuits | 5% |

Seuil `can_activate` : score ≥ 60  
Seuils statut : `not_configured`(0) → `minimal`(<30) → `partial`(<60) → `configured`(<85) → `complete`(≥85)

### PierreEmpreinte (12 sections)

| Section | Poids |
|---------|-------|
| identity | 20% |
| hr_scope | 15% |
| document_rules | 15% |
| workflow_rules | 10% |
| email_rules | 10% |
| sensitive_cases | 10% |
| autonomy | 10% |
| recruitment | 3% |
| onboarding | 3% |
| absences | 2% |
| prepayroll | 1% |
| employee_file | 1% |

---

## Verdict global

5 niveaux : `not_ready` → `minimal_viable` → `production_ready` → `fully_configured` → `locked`

Score overall = `enterprise_completion × 0.4 + pierre_completion × 0.6`

7 areas évaluées : identity, hr_scope, documents, sensitivity, autonomy, email, enterprise

**Blocages automatiques** :
- `email.send` absent de `blocked_task_types`
- Mode email `live_auto` sans supervision
- Score enterprise < 30
- Aucun domaine RH activé

---

## Sécurité & isolation tenant

- Routes : Bearer token obligatoire (snapshot, save, reset)
- `company_id`, `user_id`, `organization_id` strippés du body client avant traitement
- Headers sur toutes les routes : `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`
- Jamais de croisement entre empreintes de clients différents

---

## Contraintes absolues respectées

- Pas d'appel OpenAI live
- Pas d'appel Supabase réel dans les tests
- Pas d'utilisation du mot "Logo" — `brand_mark`, `visual_identity_asset`, `brand_asset_url`
- Pas de stockage de secrets en clair
- Pas de mélange empreintes multi-tenant

---

## Tests B44

| Fichier | Tests |
|---------|-------|
| `empreinte-b44-enterprise.test.ts` | 43 |
| `pierre-empreinte-b44.test.ts` | 49 |
| `pierre-empreinte-routes-b44.test.ts` | 37 |
| **Total** | **129** |

---

## Handoff B45

`pierre-document-prep.ts` expose :
- `buildPierreDocumentRenderConfig({ pierre, enterprise })` → font, couleurs, logo, footer, signature
- `buildDocumentVariablesFromEmpreinte({ pierre, enterprise })` → variables de merge pour templates

B45 importe ces fonctions directement — aucune duplication de logique empreinte.
