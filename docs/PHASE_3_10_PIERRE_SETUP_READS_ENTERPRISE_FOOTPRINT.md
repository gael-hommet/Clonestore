# PHASE 3.10 — Pierre Setup Reads Enterprise Footprint

## Objectif

Brancher `/agents/pierre/setup` en **lecture seule** sur l'Empreinte Entreprise
construite lors de PHASE 3.8/3.9. Pierre Setup peut désormais afficher le contexte
entreprise détecté depuis localStorage, et contextualiser sa configuration en
conséquence — sans modifier le moteur Pierre, sans écriture DB, sans exécution de mission.

---

## État avant PHASE 3.10

- PHASE 3.8 : création de `src/lib/clonestore/enterprise-footprint/`.
  `GlobalOnboardingDraft → EnterpriseFootprint → GlobalEnterpriseMemory`.
  Snapshot localStorage `clonestore.enterpriseFootprint.snapshot.v1`.
- PHASE 3.9 : bridge cockpit (`enterprise-footprint-cockpit.ts`) et bridge handoff
  Pierre (`enterprise-footprint-pierre-handoff.ts`). `PierreEnterpriseFootprintContext`
  en design-only. Aucun import `src/lib/pierre`.
- `/agents/pierre/setup` avait son propre formulaire multi-section, appel API
  `/api/pierre/onboarding`, sans connaissance de l'Empreinte Entreprise.

---

## Fichiers créés / modifiés en PHASE 3.10

### Créés

| Fichier | Rôle |
|---|---|
| `src/lib/clonestore/enterprise-footprint/enterprise-footprint-pierre-setup.ts` | Bridge Setup — charge l'Empreinte et construit les objets UI |
| `src/lib/clonestore/enterprise-footprint/enterprise-footprint-pierre-setup-qa.ts` | QA module PHASE 3.10 |
| `src/lib/clonestore/enterprise-footprint/__tests__/enterprise-footprint-pierre-setup-phase3-10.test.ts` | Tests QA (54 assertions) |
| `docs/PHASE_3_10_PIERRE_SETUP_READS_ENTERPRISE_FOOTPRINT.md` | Cette documentation |

### Modifiés

| Fichier | Modification |
|---|---|
| `src/lib/clonestore/enterprise-footprint/index.ts` | Ajout des exports PHASE 3.10 |
| `src/app/agents/pierre/setup/page.tsx` | Ajout panneau Empreinte Entreprise read-only |
| `package.json` | Ajout `test:phase3-10` |

---

## Bridge Pierre Setup (`enterprise-footprint-pierre-setup.ts`)

### Types exposés

```ts
PierreSetupFootprintStatus        // ready | partial | setup_required | not_ready | empty
PierreSetupFootprintSource        // enterprise_footprint_snapshot | onboarding_draft_fallback | empty
PierreSetupFootprintSummary       // résumé UI (company_name, readiness_score, risk, …)
PierreSetupFootprintCard          // carte indicateur (readiness, risque, validations, contexte RH)
PierreSetupFootprintRecommendation // recommandation (blocking / warning / info)
PierreSetupFootprintAction        // CTA (href, primary)
PierreSetupFootprintReadResult    // résultat complet
```

### Fonctions exposées

| Fonction | Description |
|---|---|
| `loadPierreSetupEnterpriseFootprint()` | Point d'entrée principal — charge et structure le résultat |
| `buildPierreSetupFootprintSummary(fp, ctx)` | Construit le résumé UI |
| `buildPierreSetupFootprintCards(fp, ctx)` | Construit les 4 cartes indicateurs |
| `buildPierreSetupFootprintRecommendations(fp, ctx)` | Construit les recommandations |
| `buildPierreSetupFootprintActions(result)` | Construit les CTAs |
| `buildEmptyPierreSetupFootprintState()` | État vide propre (empty state) |
| `getPierreSetupFootprintStatusLabel(status)` | Label lisible du statut |
| `getPierreSetupFootprintRiskLabel(risk)` | Label lisible du risque |
| `getPierreSetupFootprintReadinessLabel(readiness)` | Label lisible du readiness |

---

## Fallback snapshot → onboarding → empty

```
loadPierreSetupEnterpriseFootprint()
  └── loadEnterpriseFootprintForCockpit()   [PHASE 3.9 cockpit bridge]
        ├── clonestore.enterpriseFootprint.snapshot.v1   → has_footprint: true
        ├── clonestore.globalOnboardingDraft.v1 (fallback) → source: onboarding_draft_fallback
        └── rien → buildEmptyPierreSetupFootprintState() → has_footprint: false
```

- Si snapshot disponible → source `enterprise_footprint_snapshot`.
- Si snapshot absent mais draft onboarding disponible → source `onboarding_draft_fallback`.
- Si rien → état vide propre, CTA `/profile/onboarding`.

---

## `PierreEnterpriseFootprintContext`

Construit via `buildPierreEnterpriseFootprintContext(footprint)` (PHASE 3.9 handoff bridge).

Champs clés :

```ts
{
  company_name: string
  industry: string
  language: string
  timezone: string
  readiness: "can_operate" | "can_operate_limited" | "requires_setup" | "not_ready"
  readiness_score: number   // 0-100
  risk: "low" | "medium" | "high" | "unknown"
  can_operate_hr_basic: boolean
  requires_human_validation: boolean
  approvers: EnterpriseFootprintHumanRole[]
  approval_rules: EnterpriseFootprintApprovalRule[]
  document_references: EnterpriseFootprintDocumentReference[]
  missing_items: string[]
  warnings: string[]
}
```

Validé via `validatePierreEnterpriseFootprintContext(context)` qui retourne
`{ valid: boolean; issues: string[] }`.

---

## Intégration `/agents/pierre/setup`

### Emplacement du panneau

Colonne droite du `cs-command-surface`, après la carte "Avancement de l'empreinte"
et la carte "État du chargement initial".

### État si footprint présente (`has_footprint: true`)

- Titre : **Empreinte Entreprise**
- Sous-titre : "Contexte lu par Pierre en lecture seule · Aucune action exécutée"
- Badge : **Lecture seule**
- Bloc entreprise + readiness score
- 4 cartes compactes : Readiness Pierre, Risque RH, Validations humaines, Contexte RH
- Top recommandation (blocking ou warning)
- CTAs : "Modifier l'empreinte" → `/profile/onboarding` · "Voir dans cockpit" → `/profile/agents#empreinte-entreprise`

### État vide (`has_footprint: false`)

- Message : "Empreinte Entreprise manquante — Pierre peut être configuré, mais le contexte entreprise global n'est pas encore disponible."
- CTA : "Créer l'Empreinte Entreprise →" → `/profile/onboarding`

---

## Indicateurs affichés

| Indicateur | Source |
|---|---|
| Nom entreprise | `summary.company_name` |
| Readiness score | `summary.readiness_score` (%) |
| Risque RH | `cards[1].value` |
| Approbateurs | `cards[2].value` |
| Règles RH | `cards[3].value` |
| Documents référencés | `summary.document_references_count` |
| Éléments manquants | `summary.missing_items_count` |
| Warnings | `summary.warnings_count` |
| Source | `summary.source_label` |

---

## Recommandations

Le bridge génère des recommandations contextuelles :

- **blocking** : approbateur manquant, règle de validation manquante, readiness `not_ready`.
- **warning** : documents RH manquants.
- **info** : Pierre peut opérer en plan-only, rappel lecture seule.

---

## CTAs

| CTA | Destination |
|---|---|
| Compléter / modifier l'empreinte | `/profile/onboarding` |
| Voir l'empreinte dans cockpit | `/profile/agents#empreinte-entreprise` |
| Mon espace | `/profile/agents` |
| Messages | `/profile/messages` |
| Technologies | `/profile/technologies` |

---

## QA Module (`enterprise-footprint-pierre-setup-qa.ts`)

Checklist 14 étapes :

1. `footprint_snapshot_or_empty_state`
2. `onboarding_fallback_available`
3. `pierre_context_builds`
4. `pierre_context_validates`
5. `setup_summary_builds`
6. `setup_cards_build`
7. `setup_recommendations_build`
8. `setup_panel_visible`
9. `read_only_badge_visible`
10. `no_db_write`
11. `no_supabase_import`
12. `no_pierre_engine_import`
13. `no_runtime_execution`
14. `rollback_empty_state_available`

Fonctions : `buildPierreSetupFootprintQaChecklist()`, `buildPierreSetupFootprintQaVerdict(steps)`,
`getPierreSetupFootprintBlockingSteps()`, `summarizePierreSetupFootprintQaVerdict(verdict)`.

---

## Invariant lecture seule — ce qui est activé

✅ Lecture localStorage via `loadEnterpriseFootprintForCockpit()`.  
✅ Affichage panneau Empreinte Entreprise dans Pierre Setup.  
✅ Fallback snapshot → draft → empty.  
✅ `PierreEnterpriseFootprintContext` utilisé pour construire les indicateurs.  
✅ Badges "Lecture seule" et "Aucune action exécutée".  
✅ CTAs vers `/profile/onboarding` et `/profile/agents#empreinte-entreprise`.  
✅ Guard SSR (`typeof window`).  
✅ Aucun Supabase, aucun DB write, aucun import `src/lib/pierre`.

---

## Ce qui reste non activé

- Persistance serveur de l'Empreinte Entreprise (table SQL non encore créée).
- Alimentation automatique du formulaire Setup depuis l'Empreinte.
- Synchronisation bidirectionnelle Setup ↔ Empreinte.
- Pierre Use ne lit pas encore l'Empreinte (prévu en PHASE 3.11).

---

## Ce qui n'a PAS été fait en PHASE 3.10

- Modification du moteur Pierre (`src/lib/pierre/**` — non touché).
- Modification des API Pierre (`src/app/api/pierre/**` — non touchées).
- Écriture en base de données.
- Migration SQL.
- Modification de `.env.local`.
- Appel OpenAI / Anthropic.
- Envoi d'email.
- Exécution de mission.
- Génération de document réel.
- Modification des flags de lancement public externe.

**Lancement public externe : toujours non validé.**

---

## Tests

Script : `npm run test:phase3-10`  
Fichier : `src/lib/clonestore/enterprise-footprint/__tests__/enterprise-footprint-pierre-setup-phase3-10.test.ts`

54 assertions couvrant :
- Existence et contenu du bridge setup
- QA module
- Intégration page `/agents/pierre/setup`
- Exports index
- Documentation
- Régression PHASE 3.8 et 3.9

---

## Prochain bloc recommandé

**PHASE 3.11 — Pierre Use Reads Enterprise Footprint Read-Only**

Même approche que PHASE 3.10, appliquée à `/agents/pierre/use` :
- Lire l'Empreinte Entreprise depuis localStorage.
- Afficher un panneau contextuel compact dans Pierre Use.
- Préremplir la suggestion de mission avec les données Empreinte (UI seulement).
- Invariant identique : pas de moteur Pierre modifié, pas de DB write.

Alternatives possibles :
- PHASE 3.11 — Enterprise Footprint Server Persistence Design
- PHASE 3.11 — CloneOS History Manual Activation QA
