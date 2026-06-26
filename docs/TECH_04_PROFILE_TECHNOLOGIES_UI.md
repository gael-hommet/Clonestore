# TECH-04 — Profile Technologies Configuration UI

## 1. Pourquoi ce bloc existe

TECH-03 a créé le modèle de configuration unifié pour les 13 technologies CloneStore.
TECH-04 relie ce modèle à la page client `/profile/technologies`.

Avant TECH-04, la page utilisait des données statiques hardcodées (TECH_META + ROADMAP_TECHNOLOGIES)
qui contenaient trois erreurs factuelles importantes.

---

## 2. Les 3 corrections appliquées

### [FIX-1] CloneVoice — "Actif" → "Désactivé"

**Avant :** `TECH_META.clonevoice.badges = ["Actif"]`

**Problème :** CloneVoice a `status=partial`, `mode=disabled`, `readiness_score=15` dans TECH-03.
Afficher "Actif" était factuellement faux et trompeur pour le client.

**Correction :** Le badge est désormais dérivé de `GlobalTechnologyConfig`.
CloneVoice n'a pas de badge "Actif" — son statut correct est "Désactivé" ou "En cours".

### [FIX-2] CloneTrust — "zéro-confiance" → "autonomie graduelle"

**Avant :** `description: "Accès zéro-confiance — authentification forte, permissions granulaires..."`

**Problème :** CloneTrust n'est PAS un système zéro-confiance. C'est un moteur d'**autonomie graduelle**.
`trust_model = "gradual_autonomy"` — la confiance est accordée progressivement à l'IA au fur
et à mesure que des comportements validés sont démontrés.

**Correction :** Toutes les descriptions de CloneTrust mentionnent "autonomie graduelle" ou "progressive trust".
Aucune référence à "zéro-confiance" n'apparaît dans `profile-tech-ui.ts` ou `page.tsx`.

### [FIX-3] ClonePolicy — roadmap "Bientôt" → moteur interne actif

**Avant :** ClonePolicy était listé comme roadmap technology avec `planned: "Q3 2026"` et badge "Bientôt".

**Problème :** ClonePolicy est déjà **actif en production** comme moteur interne de CloneGuard.
`status=active`, `mode=production`, `readiness_score=85`. C'est le moteur de règles exécutables
dans le pipeline `CloneGuard → ClonePolicy → CloneTrust`.

**Correction :** ClonePolicy est dans la section "Moteurs internes" avec statut "Interne".
Aucun badge "Bientôt". Active_now = "Pipeline de gouvernance actif en production".

---

## 3. Architecture TECH-04

```
GlobalTechnologyConfig (TECH-03)
  → profile-tech-ui.ts (couche UI pure, TECH-04)
    → TechUICardData (card display data)
    → TechUISection[] (4 sections organisées)
    → TechUIPageData (données complètes pour la page)
  → page.tsx (rendu React, "use client")
```

### profile-tech-ui.ts

Module pur (no Supabase, no Next, no async, no throw) qui :
- Définit `TECH_UI_META` — descriptions UI riches pour les 13 technologies (avec corrections)
- Définit `SECTION_ASSIGNMENT` — quelle section pour chaque technologie
- Dérive les badges correctement via `buildTechUIBadges(config, meta)`
- Expose `buildProfileTechPageData()` — point d'entrée pour la page

### Règle de génération des badges

Le badge "Actif" est généré UNIQUEMENT si :
- `status === "active"` ET
- `control_level !== "internal_only"` ET
- `mode !== "disabled"`

Cette règle garantit que CloneVoice (disabled) et ClonePolicy (internal) n'affichent pas "Actif".

---

## 4. Structure des sections

| Section | Techs | Critère |
|---|---|---|
| **Systèmes essentiels** | cloneos, cloneadn, cloneguard, clonetrace | required_for_employee_runtime=true |
| **Interfaces et continuité** | clonechat, clonecontinuum, clonevoice | visible, partial/disabled |
| **En développement** | clonetrust, clonereview, clonesignals, clonelearn, clonebrief | partial/roadmap |
| **Moteurs internes** | clonepolicy | control_level=internal_only |

---

## 5. Fichiers créés / modifiés dans TECH-04

```
Créés :
  src/lib/clonestore/technologies/profile-tech-ui.ts  — couche UI pure
  src/lib/clonestore/technologies/__tests__/profile-tech-ui-tech04.test.ts  — 50+ tests
  docs/TECH_04_PROFILE_TECHNOLOGIES_UI.md  — ce fichier

Modifié :
  src/app/profile/technologies/page.tsx  — réécriture avec 3 corrections
```

**Fichiers NON modifiés :**
- `global-tech-config.ts`, `global-tech-defaults.ts` — TECH-03 inchangé
- `technology-b46-types.ts`, `technology-b46-registry.ts` — B46 inchangé
- Pierre moteur (`src/lib/pierre/`) — inchangé

---

## 6. Tests — 3 groupes de correction

```typescript
describe("tech-04 — [FIX-1] CloneVoice is not active", () => {
  it("CloneVoice status_variant is not 'active'")
  it("CloneVoice status_label is not 'Actif'")
  it("CloneVoice has no badge with label 'Actif'")
  it("CloneVoice has no badge with variant 'active'")
});

describe("tech-04 — [FIX-2] CloneTrust autonomie graduelle", () => {
  it("CloneTrust card roadmap_note does not contain zéro-confiance")
  it("CloneTrust card mentions autonomie or graduel")
  it("profile-tech-ui.ts does not contain zéro-confiance")
  it("page.tsx does not contain zéro-confiance")
});

describe("tech-04 — [FIX-3] ClonePolicy is internal engine, not roadmap", () => {
  it("ClonePolicy is in internal_engines section")
  it("ClonePolicy is NOT in development section")
  it("ClonePolicy card is_internal is true")
  it("ClonePolicy has no 'Bientôt' badge")
});
```

---

## 7. Prochain bloc recommandé : TECH-05

**TECH-05 — CloneADN Global / Enterprise Memory**

Objectif : créer la couche globale CloneADN au niveau plateforme CloneStore.
Aujourd'hui CloneADN est partiellement implémenté dans Pierre (src/lib/pierre/adn/).
TECH-05 extrait la couche enterprise-memory pour qu'elle soit partageable entre tous les employés IA.

Cet ordre est verrouillé :
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
