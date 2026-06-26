# PHASE 3.11 — Pierre Use Reads Enterprise Footprint Read-Only

## Objectif

Brancher `/agents/pierre/use` en **lecture seule** sur l'Empreinte Entreprise
construite lors de PHASE 3.8/3.9. Pierre Use peut désormais afficher le contexte
entreprise détecté depuis localStorage, présenter des suggestions de missions
**plan-only** UI-only, et signaler les manques — sans modifier le moteur Pierre,
sans écriture DB, sans auto-submit, sans exécution de mission.

---

## État avant PHASE 3.11

- PHASE 3.8 : localStorage snapshot `clonestore.enterpriseFootprint.snapshot.v1`.
- PHASE 3.9 : `PierreEnterpriseFootprintContext` design-only via handoff bridge.
- PHASE 3.10 : `/agents/pierre/setup` lit l'Empreinte en read-only via
  `enterprise-footprint-pierre-setup.ts`. Bridge pattern établi.
- `/agents/pierre/use` avait son cockpit complet (shell, CommandCenter, WorkBoard…)
  sans connaissance de l'Empreinte Entreprise.

---

## Fichiers créés / modifiés en PHASE 3.11

### Créés

| Fichier | Rôle |
|---|---|
| `src/lib/clonestore/enterprise-footprint/enterprise-footprint-pierre-use.ts` | Bridge Use — charge l'Empreinte et construit les objets UI + suggestions |
| `src/lib/clonestore/enterprise-footprint/enterprise-footprint-pierre-use-qa.ts` | QA module PHASE 3.11 |
| `src/lib/clonestore/enterprise-footprint/__tests__/enterprise-footprint-pierre-use-phase3-11.test.ts` | Tests QA (56 assertions) |
| `docs/PHASE_3_11_PIERRE_USE_READS_ENTERPRISE_FOOTPRINT_READONLY.md` | Cette documentation |

### Modifiés

| Fichier | Modification |
|---|---|
| `src/lib/clonestore/enterprise-footprint/index.ts` | Ajout des exports PHASE 3.11 |
| `src/app/agents/pierre/use/page.tsx` | Ajout strip read-only + panel footprint dans NoAccessGate |
| `package.json` | Ajout `test:phase3-11` |

---

## Bridge Pierre Use (`enterprise-footprint-pierre-use.ts`)

### Types exposés

```ts
PierreUseFootprintStatus         // ready | partial | setup_required | not_ready | empty
PierreUseFootprintSource         // enterprise_footprint_snapshot | onboarding_draft_fallback | empty
PierreUseFootprintSummary        // résumé UI (company_name, readiness_score, risk, …)
PierreUseFootprintCard           // carte indicateur (4 cartes : contexte, readiness, garde-fous, ressources)
PierreUseFootprintWarning        // warning (blocking / warning / info)
PierreUseFootprintMissionSuggestion // suggestion plan-only (plan_only: true invariant)
PierreUseFootprintAction         // CTA (href, primary)
PierreUseFootprintReadResult     // résultat complet
```

### Fonctions exposées

| Fonction | Description |
|---|---|
| `loadPierreUseEnterpriseFootprint()` | Point d'entrée principal |
| `buildPierreUseFootprintSummary(fp, ctx)` | Construit le résumé UI |
| `buildPierreUseFootprintCards(fp, ctx)` | Construit les 4 cartes indicateurs |
| `buildPierreUseFootprintWarnings(fp, ctx)` | Construit les warnings contextuels |
| `buildPierreUseFootprintMissionSuggestions(fp, ctx)` | Construit les 5 suggestions plan-only |
| `buildPierreUseFootprintActions(result)` | Construit les CTAs |
| `buildEmptyPierreUseFootprintState()` | État vide propre |
| `getPierreUseFootprintStatusLabel(status)` | Label lisible du statut |
| `getPierreUseFootprintRiskLabel(risk)` | Label lisible du risque |
| `getPierreUseFootprintReadinessLabel(readiness)` | Label lisible du readiness |

---

## Fallback snapshot → onboarding → empty

```
loadPierreUseEnterpriseFootprint()
  └── loadEnterpriseFootprintForCockpit()   [PHASE 3.9 cockpit bridge]
        ├── clonestore.enterpriseFootprint.snapshot.v1   → has_footprint: true
        ├── clonestore.globalOnboardingDraft.v1 (fallback) → source: onboarding_draft_fallback
        └── rien → buildEmptyPierreUseFootprintState() → has_footprint: false
```

---

## `PierreEnterpriseFootprintContext`

Construit via `buildPierreEnterpriseFootprintContext(footprint)` (PHASE 3.9).
Validé via `validatePierreEnterpriseFootprintContext(context)`.

Champs clés : `company_name`, `readiness`, `readiness_score`, `risk`,
`can_operate_hr_basic`, `requires_human_validation`, `approvers`,
`approval_rules`, `document_references`, `missing_items`, `warnings`.

---

## Intégration `/agents/pierre/use`

### Architecture en deux zones

**Zone 1 — `NoAccessGate` (utilisateurs sans abonnement actif)**

Panel complet Empreinte Entreprise affiché après la navigation globale :
- Badges : Lecture seule · Aucune action exécutée · Plan-only
- Si footprint présente : company name, readiness score, 4 cards, 3 suggestions plan-only, warnings, CTAs
- Si footprint absente : message "Empreinte Entreprise manquante", CTAs `/profile/onboarding` + `/agents/pierre/setup`

**Zone 2 — Cockpit actif (`PierreUseFootprintStrip`)**

Bande compacte au-dessus du shell cockpit (lue si accès actif) :
- Si footprint présente : company · readiness · risk · warning bloquant · badges lecture seule / Plan-only / Aucune action exécutée
- Si footprint absente : bandeau warning + CTAs Créer / Configuration

Le shell `PierreCockpitShell` et son comportement de mission existant **ne sont pas modifiés**.

---

## Indicateurs affichés

| Indicateur | Source |
|---|---|
| Nom entreprise | `summary.company_name` |
| Readiness score | `summary.readiness_score` (%) |
| Risque RH | `cards[2].value` (Garde-fous RH) |
| Approbateurs | `cards[3].value` (Ressources RH) |
| Règles RH | `summary.approval_rules_count` |
| Documents | `summary.document_references_count` |
| Éléments manquants | `summary.missing_items_count` |
| Source | `summary.source_label` |

---

## Warnings

| ID | Déclencheur | Sévérité |
|---|---|---|
| `no_approver` | `approvers.length === 0` | blocking |
| `no_rules` | `approval_rules.length === 0` | blocking |
| `no_documents` | `document_references.length === 0` | warning |
| `not_ready` | `readiness === "not_ready"` | blocking |
| `high_risk` | `risk === "high"` ou `"unknown"` | warning |
| `plan_only_reminder` | Toujours présent | info |

---

## Suggestions UI-only plan-only

**Invariant absolu :** toutes les suggestions ont `plan_only: true`. Aucune n'est
auto-soumise au moteur Pierre. Elles sont affichées en lecture seule ; le prompt
peut être copié manuellement.

| Suggestion | Catégorie | Risque | Désactivée si |
|---|---|---|---|
| Préparer une procédure RH | procédure | medium | readiness not_ready/requires_setup |
| Lister les documents RH manquants | audit | low | jamais |
| Préparer une communication interne | communication | low | jamais |
| Vérifier une action sensible | gouvernance | high | aucun approbateur |
| Créer une mission RH plan-only | planification | medium | jamais |

Si `has_footprint: false`, toutes les suggestions sont désactivées avec
`disabled_reason` explicite.

---

## CTAs

| CTA | Destination |
|---|---|
| Compléter / modifier l'empreinte | `/profile/onboarding` |
| Configuration Pierre | `/agents/pierre/setup` |
| Voir l'empreinte dans cockpit | `/profile/agents#empreinte-entreprise` |
| Mon espace | `/profile/agents` |

---

## Read-only invariant

- Aucun import `src/lib/pierre/**`.
- Aucun Supabase / DB write.
- Aucune API call ajoutée.
- Aucun auto-submit depuis les suggestions.
- Guard SSR (`typeof window === "undefined"`).
- Fallback silencieux sur toute erreur localStorage.
- Le moteur Pierre (`submitMission`, `usePierreCockpit`) n'est pas touché.

---

## QA Module (`enterprise-footprint-pierre-use-qa.ts`)

Checklist 17 étapes :

1. `footprint_snapshot_or_empty_state`
2. `onboarding_fallback_available`
3. `pierre_context_builds`
4. `pierre_context_validates`
5. `use_summary_builds`
6. `use_cards_build`
7. `use_warnings_build`
8. `use_suggestions_build`
9. `use_panel_visible`
10. `read_only_badge_visible`
11. `plan_only_badge_visible`
12. `no_db_write`
13. `no_supabase_import`
14. `no_pierre_engine_import`
15. `no_runtime_execution`
16. `no_auto_submit`
17. `rollback_empty_state_available`

---

## Ce qui est activé maintenant

✅ Lecture localStorage dans `/agents/pierre/use`.  
✅ `PierreUseFootprintStrip` au-dessus du cockpit actif.  
✅ Panel complet dans `NoAccessGate`.  
✅ Fallback snapshot → draft → empty.  
✅ `PierreEnterpriseFootprintContext` utilisé.  
✅ Badges : Lecture seule · Aucune action exécutée · Plan-only.  
✅ 5 suggestions plan-only UI-only.  
✅ Warnings contextuels.  
✅ CTAs vers `/profile/onboarding` et `/agents/pierre/setup`.  
✅ Guard SSR. Aucun Supabase. Aucun DB write. Aucun import `src/lib/pierre`.

---

## Ce qui reste non activé

- Préremplissage automatique du composer Pierre depuis les suggestions.
- Persistance serveur de l'Empreinte (table SQL non créée).
- Synchronisation Setup ↔ Use ↔ Empreinte bidirectionnelle.
- Variante `PierreUseFootprintPanel` standalone pour cockpit actif.

---

## Ce qui n'a PAS été fait en PHASE 3.11

- Modification du moteur Pierre (`src/lib/pierre/**` — non touché).
- Modification des API Pierre (`src/app/api/pierre/**` — non touchées).
- Modification de `PierreCockpitShell`, `usePierreCockpit`, `PierreCommandCenter`.
- Écriture en base de données.
- Migration SQL.
- Modification de `.env.local`.
- Appel OpenAI / Anthropic.
- Envoi d'email.
- Exécution de mission.
- Auto-submit depuis les suggestions.

**Lancement public externe : toujours non validé.**

---

## Tests

Script : `npm run test:phase3-11`  
Fichier : `src/lib/clonestore/enterprise-footprint/__tests__/enterprise-footprint-pierre-use-phase3-11.test.ts`

56 assertions couvrant :
- Existence et contenu du bridge use
- QA module (17 étapes)
- Intégration page `/agents/pierre/use`
- Exports index
- Documentation
- Régression PHASE 3.10

---

## Prochain bloc recommandé

**PHASE 3.12 — Pierre Use Mission Composer Footprint Prefill QA**

Permettre à l'utilisateur de "Utiliser" une suggestion plan-only depuis le cockpit
actif pour préremplir le composer Pierre (`setInputDraft`) — sans submit automatique.
Nécessite de passer `setInputDraft` en prop depuis `CockpitContent` jusqu'au strip.

Alternatives possibles :
- PHASE 3.12 — Enterprise Footprint Server Persistence Design
- PHASE 3.12 — CloneOS History Manual Activation QA
