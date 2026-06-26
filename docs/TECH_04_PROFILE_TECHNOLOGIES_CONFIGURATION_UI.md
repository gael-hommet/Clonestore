# TECH-04 — Profile Technologies Configuration UI

## 1. Objectif

TECH-04 transforme `/profile/technologies` en un **centre de contrôle premium** de toutes les
technologies CloneStore. La page utilise désormais le modèle `GlobalTechnologyConfig` (TECH-03)
comme source de vérité unique — plus de données statiques contradictoires.

**Avant TECH-04 :** page statique avec 3 erreurs factuelles importantes.  
**Après TECH-04 :** centre de contrôle dynamique, basé sur TECH-03, corrigeant les 3 erreurs.

---

## 2. Architecture

```
GlobalTechnologyConfig (TECH-03)
  ├── DEFAULT_GLOBAL_TECH_CONFIG_LIST → stats/filtres/sections configurables
  ├── buildGlobalTechnologyConfigSnapshot() → résumé des 13 technologies
  └── PIERRE_EMPLOYEE_RUNTIME_CONTRACT (TECH-02) → section Pierre

profile-tech-ui.ts (couche UI TECH-04)
  ├── buildProfileTechPageData() → 4 sections + counts
  └── TechUICardData → données de chaque carte

page.tsx (TECH-04 — "use client")
  ├── Hero — couches système vs employés IA
  ├── Stats (8 métriques depuis SNAPSHOT.summary)
  ├── Filtres (8 filtres, client-side useState)
  ├── Grille technologies (4 sections ou vue filtrée)
  ├── Section Pierre (hard/soft requirements)
  ├── Technologies configurables (configurable_by_customer=true)
  ├── Technologies verrouillées (locked_by_platform=true)
  ├── Roadmap technologies
  └── Points importants (CloneVoice, CloneTrust, ClonePolicy)
```

---

## 3. Comment `/profile/technologies` utilise GlobalTechConfig

### Imports TECH-03

```typescript
import { DEFAULT_GLOBAL_TECH_CONFIG_LIST } from ".../global-tech-defaults";
import { buildGlobalTechnologyConfigSnapshot } from ".../global-tech-snapshot";
```

- `DEFAULT_GLOBAL_TECH_CONFIG_LIST` → filtre les technologies configurables et verrouillées
- `buildGlobalTechnologyConfigSnapshot()` → génère les 8 métriques du résumé

### Imports TECH-04

```typescript
import { buildProfileTechPageData } from ".../profile-tech-ui";
```

- Génère les 4 sections (essential, complementary, development, internal_engines)
- Génère les `TechUICardData` avec statuts corrects

### Imports TECH-02

```typescript
import { PIERRE_EMPLOYEE_RUNTIME_CONTRACT } from ".../employee-registry";
```

- Source de vérité des technologies requises par Pierre
- Distingue hard requirements (4) et soft requirements (4)

---

## 4. Statuts corrects des 13 technologies

| Technologie     | Status   | Mode        | Score | Section         |
|-----------------|----------|-------------|-------|-----------------|
| CloneOS         | active   | supervised  | 85    | Essentielle     |
| CloneADN        | active   | supervised  | 80    | Essentielle     |
| CloneGuard      | active   | supervised  | 85    | Essentielle     |
| CloneTrace      | active   | supervised  | 80    | Essentielle     |
| CloneChat       | partial  | supervised  | 50    | Interface       |
| CloneContinuum  | partial  | supervised  | 65    | Interface       |
| CloneVoice      | partial  | disabled    | 15    | Interface       |
| ClonePolicy     | active   | production  | 85    | Moteur interne  |
| CloneTrust      | partial  | supervised  | 60    | En développement|
| CloneReview     | roadmap  | roadmap     | 10    | En développement|
| CloneSignals    | roadmap  | roadmap     | 5     | En développement|
| CloneLearn      | roadmap  | roadmap     | 5     | En développement|
| CloneBrief      | roadmap  | roadmap     | 5     | En développement|

---

## 5. Correction CloneVoice [FIX-1]

**Avant :** Badge "Actif", présenté comme pipeline voix opérationnel.

**Après :**
- `status=partial`, `mode=disabled`, `readiness_score=15`
- Aucun badge "Actif"
- Section Points importants : _"CloneVoice prépare l'entrée vocale naturelle, mais le pipeline
  voix complet n'est pas activé en production. Ce n'est pas un pipeline vocal opérationnel —
  statut : non actif en production."_
- `active_now = undefined` dans TECH_UI_META → pas de bloc "Actif maintenant"

**Règle de badge** : le badge "Actif" est généré UNIQUEMENT si `status=active` ET
`control_level !== internal_only` ET `mode !== disabled`.

---

## 6. Correction CloneTrust [FIX-2]

**Avant :** Décrit comme "zero-trust" ou "zéro-confiance".

**Après :**
- `settings.trust_model = "gradual_autonomy"` dans GlobalTechnologyConfig
- Section Points importants : _"CloneTrust est un moteur d'autonomie graduelle — la confiance
  est accordée progressivement à l'employé IA au fur et à mesure que des comportements validés
  sont démontrés."_
- Aucune occurrence de "zero-trust", "zéro-confiance", "zero-confiance" dans page.tsx
  ou profile-tech-ui.ts

---

## 7. Traitement ClonePolicy [FIX-3]

**Avant :** Dans la roadmap avec badge "Bientôt" et date Q3 2026.

**Après :**
- `status=active`, `mode=production`, `readiness_score=85`
- `control_level=internal_only`, `visible_to_customer=false`
- Section : **Moteurs internes** (pas roadmap, pas essentiels)
- Badge "Interne" (pas "Bientôt", pas "Actif" public)
- Section Points importants : _"ClonePolicy est un moteur interne exécuté dans le pipeline
  CloneGuard → ClonePolicy → CloneTrust."_

---

## 8. Ce qui est configurable maintenant

Les technologies avec `configurable_by_customer=true` sont affichées dans la section
"Technologies configurables" :

- **CloneADN** — mémoire entreprise, ton, règles
- **CloneChat** — interface conversationnelle
- **CloneContinuum** — continuité de session
- **CloneTrust** — calibration d'autonomie

Les contrôles sont en **lecture seule** pour l'instant (aucune persistance Supabase branchée
dans TECH-04). Le message "Configuration avancée disponible prochainement" est affiché.

---

## 9. Ce qui est verrouillé par la plateforme

Les technologies avec `locked_by_platform=true` :

- **CloneOS** — orchestration centrale
- **CloneGuard** — gouvernance et pipeline de sécurité
- **CloneTrace** — traçabilité immuable
- **CloneLearn** — apprentissage gouverné (roadmap, locked)
- **ClonePolicy** — moteur interne (locked + internal_only)

Ces technologies ne peuvent pas être désactivées par le client. Elles garantissent la
gouvernance, l'audit et la sécurité de l'ensemble de la plateforme.

---

## 10. Section Pierre — Employee Runtime Contract

La section "Pierre utilise ces technologies" utilise `PIERRE_EMPLOYEE_RUNTIME_CONTRACT`
(TECH-02) et distingue :

**Indispensables (hard requirements)** — Pierre ne peut pas fonctionner sans :
- CloneOS (minimum_readiness: 60)
- CloneADN (minimum_readiness: 50)
- CloneGuard (minimum_readiness: 60)
- CloneTrace (minimum_readiness: 60)

**Recommandées (soft requirements)** — enrichissent l'expérience :
- CloneContinuum (continuité de session)
- CloneTrust (calibration d'autonomie)
- CloneReview (contrôle qualité, roadmap)
- CloneBrief (briefings RH, roadmap)

**Note** : Les futurs employés IA (Emma, Lucas, Sophie) n'ont pas encore été créés.
Ils déclareront leurs technologies via le même mécanisme de contrat de runtime.

---

## 11. Filtres disponibles (côté client)

| Filtre            | Critère                                           |
|-------------------|---------------------------------------------------|
| Toutes            | toutes les 13 technologies                        |
| Actives           | `status_variant = "active"`                       |
| Partielles        | `status_variant = "partial"`                      |
| Roadmap           | `status_variant = "roadmap"`                      |
| Visibles client   | `!is_internal`                                    |
| Internes          | `is_internal`                                     |
| Verrouillées      | `is_locked`                                       |
| Requises par Pierre | clé dans `PIERRE.required_technologies`         |

---

## 12. Ce qui N'A PAS été fait dans TECH-04

| Ce qui n'a PAS été fait | Pourquoi |
|-------------------------|----------|
| Écriture en Supabase | Pas de backend branché — lecture seule |
| Vraie persistance des configs | TECH-06+ branchera le storage |
| Nouveau pipeline voix | CloneVoice n'est pas activé |
| Création Emma/Lucas/Sophie | Hors périmètre TECH-04 |
| Modification moteur Pierre | Pierre (B38-B48) est clos |
| Modification checkout/Stripe | Hors périmètre |
| Auto-validation de preuves | Interdit |
| Route API nouvelle | Pas nécessaire — tout est statique |
| Modification go-live-proofs.local.json | Interdit |

---

## 13. Fichiers créés / modifiés dans TECH-04

```
Modifié :
  src/app/profile/technologies/page.tsx
    — réécriture complète : Hero, Stats, Filtres, Pierre, Configurables, Verrouillées, Roadmap, Important

Créés :
  src/app/profile/__tests__/profile-technologies-config-tech04.test.ts — 50 tests
  docs/TECH_04_PROFILE_TECHNOLOGIES_CONFIGURATION_UI.md — cette documentation

Non modifiés (stables) :
  src/lib/clonestore/technologies/profile-tech-ui.ts — couche UI pure TECH-04
  src/lib/clonestore/technologies/global-tech-config.ts — TECH-03 inchangé
  src/lib/clonestore/technologies/global-tech-defaults.ts — TECH-03 inchangé
  src/lib/clonestore/employees/employee-registry.ts — TECH-02 inchangé
  src/lib/pierre/ — moteur Pierre inchangé
  docs/TECH_04_PROFILE_TECHNOLOGIES_UI.md — doc précédente conservée
```

---

## 14. Prochain bloc recommandé : TECH-05

**TECH-05 — CloneADN Global / Enterprise Memory**

Objectif : créer la couche globale CloneADN au niveau plateforme CloneStore.
Aujourd'hui CloneADN est partiellement implémenté dans Pierre (`src/lib/pierre/adn/`).
TECH-05 extrait la couche enterprise-memory pour qu'elle soit partageable entre tous les
employés IA enregistrés.

```
TECH-04 — Profile Technologies Configuration UI (ce bloc) ✅
TECH-05 — CloneADN Global / Enterprise Memory
TECH-06 — CloneGuard + ClonePolicy Global Rules
TECH-07 — CloneTrace Global Audit Timeline
TECH-08 — CloneOS Command Center Alignment
TECH-09 — CloneBrief Executive Summaries
TECH-10 — CloneVoice Readiness Layer
TECH-11 — Technology Readiness Final Gate
```
