# PHASE 3.8 — Empreinte Entreprise Read/Write QA

## 1. Objectif

PHASE 3.8 crée la couche Empreinte Entreprise : une transformation structurée, validée et exploitable du `GlobalOnboardingDraft` vers `GlobalEnterpriseMemory` (CloneADN).

Ce bloc :
- crée un modèle `EnterpriseFootprint` riche et exploitable ;
- crée les mappers bidirectionnels `GlobalOnboardingDraft ↔ EnterpriseFootprint ↔ GlobalEnterpriseMemory` ;
- crée la validation/redaction de l'Empreinte ;
- prépare un snapshot localStorage de l'Empreinte ;
- crée le module QA read/write ;
- affiche un aperçu read-only dans `/profile/onboarding` ;
- prépare le safe storage design (non activé en PHASE 3.8).

**Lancement public externe non validé.**

## 2. Définition Empreinte Entreprise

L'Empreinte Entreprise n'est **pas** juste un formulaire rempli. C'est la version :
- **structurée** : tous les champs validés et normalisés
- **scorée** : coverage_score (CloneADN) + readiness_score (produit)
- **annotée** : missing_items, warnings, statut
- **exploitable** : prête pour CloneADN Global, /profile/agents, Pierre

Elle devient la base de `GlobalEnterpriseMemory` (TECH-05).

## 3. Différences entre les modèles

| Modèle | Rôle | Source | Persistence |
|--------|------|--------|-------------|
| `GlobalOnboardingDraft` | Brouillon wizard onboarding | LocalStorage + DB | PHASE 3.5+ |
| `EnterpriseFootprint` | Vue structurée + scorée | Calculée depuis draft | LocalStorage snapshot |
| `GlobalEnterpriseMemory` | Mémoire CloneADN complète | Calculée depuis Footprint | In-memory (TECH-05) |

Flux :
```
GlobalOnboardingDraft
  → mapGlobalOnboardingDraftToEnterpriseFootprint
  → EnterpriseFootprint
  → mapEnterpriseFootprintToGlobalEnterpriseMemory
  → GlobalEnterpriseMemory (CloneADN)
```

## 4. Modèle EnterpriseFootprint

```typescript
type EnterpriseFootprint = {
  id: string;
  user_id?: string;
  company_id: string;
  status: "draft" | "ready" | "incomplete" | "needs_review" | "archived";
  source: "onboarding_local" | "onboarding_server" | "cloneadn" | "demo";
  company: EnterpriseFootprintCompanyIdentity;
  humans: EnterpriseFootprintHumanRole[];
  approval_rules: EnterpriseFootprintApprovalRule[];
  documents: EnterpriseFootprintDocumentReference[];
  technologies: EnterpriseFootprintTechnologyStatus[];
  cloneadn_summary: EnterpriseFootprintCloneADNSummary;
  coverage_score: number;         // 0–100 (CloneADN)
  readiness_score: EnterpriseFootprintReadinessScore;  // (produit)
  missing_items: string[];
  warnings: string[];
  created_at: string;
  updated_at: string;
  read_only: boolean;
  metadata: Record<string, unknown>;
};
```

### Score readiness

Le readiness_score mesure la complétude "produit" (différent du coverage_score CloneADN) :

| Critère | Poids |
|---------|-------|
| Identité entreprise complète | 30% |
| Au moins un approbateur | 20% |
| Au moins une règle d'approbation | 20% |
| Au moins un document | 15% |
| Première mission Pierre définie | 15% |

Niveaux : `low` (< 30%) / `medium` (30–60%) / `high` (60–90%) / `complete` (>= 90%)

## 5. Mapping GlobalOnboardingDraft → EnterpriseFootprint

`mapGlobalOnboardingDraftToEnterpriseFootprint(draft)` :

1. Company identity depuis `draft.company`
2. Humans depuis `draft.humans` (sans email — PII)
3. Approval rules depuis `draft.rules`
4. Documents depuis `draft.documents`
5. Technologies depuis `draft.technologies`
6. Compute `readiness_score` via `computeEnterpriseFootprintReadiness`
7. Compute `coverage_score` via `mapGlobalOnboardingDraftToEnterpriseMemory` + `computeCoverageScore`
8. Compute `missing_items` via `computeEnterpriseFootprintMissingItems`
9. Status : `ready` si readiness ≥ 85%, `incomplete` si ≥ 50%, `draft` sinon

## 6. Mapping EnterpriseFootprint → GlobalEnterpriseMemory

`mapEnterpriseFootprintToGlobalEnterpriseMemory(footprint)` :

- identity ← footprint.company
- humans ← footprint.humans (email=null, PII excluded)
- documents ← footprint.documents (document_type normalisé)
- rules ← footprint.approval_rules (severity mappé)
- tone, communication → defaults (non modifiés)

## 7. QA Read/Write

`buildEnterpriseFootprintReadWriteQaChecklist()` — 12 étapes :

| Étape | Type |
|-------|------|
| onboarding_draft_available | blocking |
| onboarding_maps_to_footprint | blocking |
| footprint_maps_to_cloneadn | blocking |
| cloneadn_maps_back_to_footprint | warning |
| validation_passes_or_warns | warning |
| localstorage_snapshot_saved | blocking |
| localstorage_snapshot_restored | blocking |
| server_write_not_forced | blocking |
| server_flag_default_false | blocking |
| no_sensitive_leak | blocking |
| cockpit_preview_available | warning |
| rollback_localstorage_available | blocking |

Verdicts : `ready_for_qa` / `blocked` / `passed` / `needs_review`

## 8. LocalStorage Snapshot

Clé : `clonestore.enterpriseFootprint.snapshot.v1`

Fonctions :
- `saveEnterpriseFootprintToLocalStorage(footprint)` — sanitize avant save
- `loadEnterpriseFootprintFromLocalStorage()` — typeof window, try/catch
- `clearEnterpriseFootprintLocalStorage()`

Le snapshot est calculé automatiquement depuis l'état de `/profile/onboarding` à chaque update et sauvegardé en localStorage.

## 9. Safe Storage Design (PHASE 3.9+)

`persistEnterpriseFootprintSafely(supabase, userId, footprint)` — design uniquement en PHASE 3.8.

Note : En PHASE 3.8, aucune table SQL dédiée `clonestore_enterprise_footprints` n'est créée. La persistence de l'Empreinte Entreprise réutilise le mécanisme du `GlobalOnboardingDraft` (PHASE 3.5–3.7). La table dédiée est différée à PHASE 3.9+.

Feature flag : `NEXT_PUBLIC_ENTERPRISE_FOOTPRINT_SERVER_PERSISTENCE_ENABLED` — default false.

## 10. UI Preview

Dans `/profile/onboarding` — section "Aperçu CloneADN Global" :

Ajout d'un encart compact "Empreinte Entreprise" montrant :
- Statut (Brouillon / Incomplète / Prête)
- Readiness score
- Nombre d'éléments manquants
- Badge "Aperçu local · Non persisté"

L'aperçu est calculé via `useMemo` à chaque update de state. Il est read-only. Aucun DB write.

## 11. Ce qui est activé maintenant

| Élément | Activé |
|---------|--------|
| Types EnterpriseFootprint | ✅ |
| Mappers onboarding ↔ footprint ↔ CloneADN | ✅ |
| Validation/redaction | ✅ |
| LocalStorage snapshot | ✅ |
| QA module read/write | ✅ |
| Flags (default false) | ✅ |
| Safe storage design | ✅ (non activé UI) |
| UI preview /profile/onboarding | ✅ (read-only) |

## 12. Ce qui reste non activé

| Élément | Raison |
|---------|--------|
| Table SQL clonestore_enterprise_footprints | Différée PHASE 3.9+ |
| Persistence serveur Empreinte | Flag = false, table non créée |
| Write DB depuis /profile/onboarding | Non branché |
| Connexion /profile/agents ← Empreinte | Différée PHASE 3.9 |
| Pierre lit l'Empreinte directement | PHASE 3.9+ |

## 13. Ce qui n'a PAS été fait

- ❌ Migration SQL automatique
- ❌ Modification moteur Pierre
- ❌ Modification APIs Pierre
- ❌ Activation public launch
- ❌ Service role côté client
- ❌ Write forcé depuis /profile/onboarding
- ❌ Email envoyé
- ❌ Mission exécutée
- ❌ Document généré
- ❌ Proof auto-validé

## 14. Prochain bloc recommandé

### PHASE 3.9 — Empreinte Entreprise Cockpit Integration

Connecter l'Empreinte Entreprise au cockpit `/profile/agents` :
- Lire le snapshot depuis localStorage
- Afficher dans le cockpit agents (section empreinte)
- Préparer `clonestore_enterprise_footprints` table SQL
- Connecter Pierre via `pierre-adn-bridge.ts`

### PHASE 3.9 — CloneOS History Manual Activation QA

Activer la persistence CloneOS History (PHASE 3.3) :
- Appliquer SQL PHASE_3_2
- Tester `CLONEOS_HISTORY_SERVER_PERSISTENCE_ENABLED=true`
- Vérifier intégration /profile/messages

### PHASE 3.9 — Pierre Setup Reads Enterprise Footprint

Brancher `/agents/pierre/setup` pour lire l'Empreinte Entreprise :
- Pierre lit company, humains, règles depuis footprint
- Contexte RH enrichi depuis l'Empreinte
- Plan-only invariant respecté

---

*PHASE 3.8 validée. Lancement public externe non validé. Moteur Pierre intact.*
