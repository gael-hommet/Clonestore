# PHASE 3.9 — Empreinte Entreprise Cockpit Integration

## 1. Objectif

PHASE 3.9 intègre l'Empreinte Entreprise dans le cockpit global `/profile/agents`.

Le cockpit doit afficher le socle entreprise réel (company, humains, approbateurs, règles, documents) depuis la couche EnterpriseFootprint créée en PHASE 3.8, et préparer le handoff vers Pierre.

**Lancement public externe non validé.**

## 2. État avant PHASE 3.9

- PHASE 3.8 : couche `enterprise-footprint/` complète, snapshot localStorage `clonestore.enterpriseFootprint.snapshot.v1`
- `/profile/onboarding` calcule et sauvegarde le snapshot
- `/profile/agents` : aucune référence à l'Empreinte Entreprise

## 3. Couche Cockpit Bridge

`enterprise-footprint-cockpit.ts` — localStorage uniquement, pas de Supabase, pas de DB write.

### Types exposés

- `EnterpriseFootprintCockpitStatus` : ready / incomplete / draft / needs_review / empty / loading
- `EnterpriseFootprintCockpitSource` : enterprise_footprint_snapshot / onboarding_draft_fallback / empty
- `EnterpriseFootprintCockpitSummary` : résumé complet pour l'affichage
- `EnterpriseFootprintCockpitCard` : carte indicateur (readiness, coverage, humans, rules)
- `EnterpriseFootprintCockpitAction` : CTA avec href

### Fonctions

- `loadEnterpriseFootprintForCockpit()` — lecture localStorage avec fallback
- `buildEnterpriseFootprintCockpitSummary(footprint)` — résumé cockpit
- `buildEnterpriseFootprintCockpitCards(footprint)` — cartes indicateurs
- `buildEnterpriseFootprintCockpitActions(footprint)` — CTAs selon readiness

## 4. Fallback Snapshot → Onboarding Draft → Empty State

Flux de `loadEnterpriseFootprintForCockpit()` :

```
1. loadEnterpriseFootprintFromLocalStorage()
   → clé : clonestore.enterpriseFootprint.snapshot.v1
   → source : enterprise_footprint_snapshot

2. Si absent → loadGlobalOnboardingDraftFromLocalStorage()
   → clé : clonestore.globalOnboarding.draft.v1
   → mapGlobalOnboardingDraftToEnterpriseFootprint(draft)
   → saveEnterpriseFootprintToLocalStorage(footprint)  [pour éviter recalcul]
   → source : onboarding_draft_fallback

3. Si absent → empty state
   → CTA /profile/onboarding
   → source : empty
```

Toutes les étapes sont client-safe (`typeof window`), try/catch, jamais de throw brut.

## 5. Intégration /profile/agents

### État ajouté

```typescript
const [footprintSummary, setFootprintSummary] = useState<EnterpriseFootprintCockpitSummary | null>(null);
const [footprintCards, setFootprintCards] = useState<EnterpriseFootprintCockpitCard[]>([]);
const [footprintActions, setFootprintActions] = useState<EnterpriseFootprintCockpitAction[]>([]);
const [footprintHasData, setFootprintHasData] = useState(false);
```

### useEffect au montage

```typescript
useEffect(() => {
  const cockpitResult = loadEnterpriseFootprintForCockpit();
  setFootprintHasData(cockpitResult.has_footprint);
  setFootprintSummary(cockpitResult.summary);
  setFootprintCards(cockpitResult.cards);
  setFootprintActions(cockpitResult.actions);
}, []);
```

### Section ajoutée

`<section id="empreinte-entreprise">` — après la section "technologies".

## 6. Indicateurs affichés

| Indicateur | Valeur |
|-----------|--------|
| Statut | Prête / Incomplète / Brouillon / À revoir |
| Source | Snapshot local / Brouillon onboarding / Aucune donnée |
| Readiness | score + niveau |
| Coverage CloneADN | score/100 |
| Humains / Approbateurs | count |
| Règles / Documents | count |
| Éléments manquants | top 2 affichés |
| Badge | "Lecture seule" + "Aucune action exécutée" |

## 7. CTAs

| CTA | href |
|-----|------|
| Compléter / Vérifier l'empreinte | `/profile/onboarding` |
| Voir messages | `/profile/messages` |
| Technologies | `/profile/technologies` |
| Ouvrir Pierre | `/agents/pierre/use` |
| Configurer Pierre | `/agents/pierre/setup` |
| Créer l'Empreinte (si vide) | `/profile/onboarding` |

## 8. Read-only invariant

- `read_only: true` dans tous les summary objects
- Aucun `.insert()`, `.update()`, `.delete()`, `.upsert()` dans le cockpit bridge
- Aucun import Supabase ajouté pour l'empreinte
- Aucun call `persistEnterpriseFootprintSafely` depuis la page

## 9. Pierre Handoff Design

`enterprise-footprint-pierre-handoff.ts` — design uniquement pour PHASE 3.9. Pierre sera branché en PHASE 3.10+.

```typescript
type PierreEnterpriseFootprintContext = {
  company_name: string;
  industry: string;
  language: string;
  timezone: string;
  approvers: [...];
  approval_rules: [...];
  document_references: [...];
  missing_items: string[];
  warnings: string[];
  readiness_score: number;
  can_operate_hr_basic: boolean;
  requires_human_validation: boolean;
  risk: "low" | "medium" | "high" | "unknown";
  readiness: "can_operate" | "can_operate_limited" | "requires_setup" | "not_ready";
};
```

**Ne pas importer `src/lib/pierre/**` dans ce fichier.**

## 10. QA Cockpit

`enterprise-footprint-cockpit-qa.ts` — 12 étapes (module pur) :

| Étape | Type |
|-------|------|
| footprint_snapshot_available_or_empty_state | blocking |
| onboarding_fallback_available | blocking |
| cockpit_summary_builds | blocking |
| cockpit_cards_build | warning |
| cockpit_actions_build | warning |
| cockpit_preview_visible | blocking |
| read_only_badge_visible | blocking |
| no_db_write | blocking |
| no_supabase_import_in_page | blocking |
| no_pierre_engine_change | blocking |
| pierre_handoff_design_ready | info |
| rollback_localstorage_available | blocking |

## 11. Ce qui est activé maintenant

| Élément | Activé |
|---------|--------|
| Cockpit bridge localStorage-only | ✅ |
| Fallback snapshot → draft → empty | ✅ |
| Section empreinte dans /profile/agents | ✅ |
| Pierre handoff design | ✅ (design only) |
| QA cockpit module | ✅ |
| Badges "Lecture seule" + "Aucune action exécutée" | ✅ |
| CTAs onboarding/messages/technologies/pierre | ✅ |

## 12. Ce qui reste non activé

| Élément | Raison |
|---------|--------|
| Persistence serveur Empreinte | Table non créée, flag false |
| Pierre lit l'Empreinte directement | Design ready, branchement PHASE 3.10+ |
| /agents/pierre/setup lit l'Empreinte | Différé PHASE 3.10 |

## 13. Ce qui n'a PAS été fait

- ❌ Migration SQL automatique
- ❌ Modification moteur Pierre
- ❌ Modification APIs Pierre
- ❌ DB write depuis le cockpit
- ❌ Service role côté client
- ❌ Email envoyé / Mission exécutée / Document généré
- ❌ Proof auto-validé

## 14. Prochain bloc recommandé

### PHASE 3.10 — Pierre Setup Reads Enterprise Footprint

Brancher `/agents/pierre/setup` pour lire l'Empreinte :
- Pierre reçoit `PierreEnterpriseFootprintContext` depuis le handoff design
- Contexte RH enrichi depuis l'Empreinte
- Plan-only invariant respecté

### PHASE 3.10 — Enterprise Footprint Server Persistence Design

Préparer la table SQL `clonestore_enterprise_footprints` :
- Créer le SQL draft
- RLS design
- Feature flag activation

### PHASE 3.10 — CloneOS History Manual Activation QA

Activer la persistence CloneOS History (PHASE 3.3) :
- SQL PHASE_3_2 déjà créé
- Tester flag CLONEOS_HISTORY_SERVER_PERSISTENCE_ENABLED
- Vérifier intégration /profile/messages

---

*PHASE 3.9 validée. Lancement public externe non validé. Moteur Pierre intact.*
