# PHASE 2.7 — Pierre Cockpit Integration Into Global Space

> Généré le : 2026-06-03
> Base : TECH-01 → TECH-11 validés. PHASE 2.1 → 2.6 validées. Moteur Pierre intact.
> Public launch : NO-GO externe.

---

## 1. Objectif PHASE 2.7

Intégrer visuellement et fonctionnellement le cockpit Pierre dans l'espace global CloneStore.

**Pierre n'est pas une page isolée.** Il est le premier employé IA branché sur le socle CloneStore :
- CloneOS orchestre ses missions
- CloneADN lui donne le contexte entreprise
- CloneGuard gouverne ses validations
- CloneTrace trace ses actions
- CloneBrief synthétise son activité

PHASE 2.7 ajoute les **liens et le contexte global** sans modifier le moteur Pierre, sans réécrire le cockpit, sans aucune DB write.

---

## 2. Pourquoi Pierre doit être intégré au global

Avant PHASE 2.7 :
- Pierre cockpit = page isolée, aucun lien vers l'espace global
- Mon espace = lien vers Pierre mais pas vers Onboarding
- Utilisateur doit deviner la navigation

Après PHASE 2.7 :
- Pierre cockpit rail gauche = liens Mon espace, Messages, Onboarding, Technologies
- Pierre cockpit panel droit = section "Pierre dans CloneStore" avec tech stack + liens
- NoAccessGate Pierre = navigation globale complète + stack tech affichée
- Mon espace = lien "Configurer l'entreprise" (→ /profile/onboarding)

---

## 3. Ce qui a été ajouté dans /agents/pierre/use/page.tsx

### Constantes PHASE 2.7

```typescript
const PIERRE_GLOBAL_LINKS = [
  { href: "/profile/agents",      label: "Mon espace CloneStore",    icon: LayoutDashboard },
  { href: "/profile/messages",    label: "Messages",                  icon: MessagesSquare },
  { href: "/profile/onboarding",  label: "Onboarding entreprise",     icon: Fingerprint },
  { href: "/profile/technologies", label: "Technologies CloneStore",  icon: Network },
  { href: "/agents/pierre/setup", label: "Configuration Pierre",      icon: Settings2 },
];

const PIERRE_CLONESTORE_TECH_STACK = [
  { key: "cloneos",    label: "CloneOS",    desc: "Orchestration des missions et demandes globales" },
  { key: "cloneadn",   label: "CloneADN",   desc: "Mémoire entreprise et contexte RH" },
  { key: "cloneguard", label: "CloneGuard", desc: "Validation humaine et gouvernance des risques" },
  { key: "clonetrace", label: "CloneTrace", desc: "Historique et audit de traçabilité" },
  { key: "clonebrief", label: "CloneBrief", desc: "Synthèses exécutives et briefings" },
];
```

### NoAccessGate enrichi

3 sections :
1. Accès non activé (existant) + `PIERRE_SEUL_ACTIF` + `PIERRE_VALIDATION_HUMAINE`
2. Stack technologique Pierre (5 technologies + descriptions)
3. Navigation globale (5 liens vers l'espace CloneStore)

### CloneOS history reader (Option A)

```typescript
const CLONEOS_HISTORY_KEY = "clonestore.cloneos.commandHistory.v1";

function usePierreCloneOSHistory() {
  // Lit localStorage, filtre domain hr / route Pierre, retourne 3 max
}

function PierreCloneOSHistoryPreview() {
  // Affiche les 3 derniers plans CloneOS routés vers Pierre
  // Plan préparé — non exécuté. Lecture seule.
}
```

Rendu dans `NoAccessGate` — visible pour les utilisateurs sans accès actif.

---

## 4. Ce qui a été ajouté dans /agents/pierre/use/components/PierreCockpitShell.tsx

### LeftRail — Navigation globale

Ajoutée au bas du rail gauche, après la RC status bar :

- Titre "CloneStore" (masqué si rail replié)
- 4 liens : Mon espace · Messages · Onboarding · Technologies
- Icônes : LayoutDashboard · MessagesSquare · Fingerprint · Network
- Comportement collapse préservé (icônes seulement si replié)

### RightPanel — Section "Pierre dans CloneStore"

Ajoutée au bas du panneau droit (xl screens) :

- Titre "Pierre dans CloneStore"
- Liste des 5 technologies : CloneOS · CloneADN · CloneGuard · CloneTrace · CloneBrief
- Microcopy : "Validation humaine obligatoire sur les actions sensibles."
- 2 liens : Mon espace CloneStore → et Onboarding entreprise →

---

## 5. Liens ajoutés

| Depuis | Vers | Méthode |
|--------|------|---------|
| `/agents/pierre/use` (NoAccessGate) | `/profile/agents` | Bouton CTA + nav globale |
| `/agents/pierre/use` (NoAccessGate) | `/profile/messages` | Nav globale |
| `/agents/pierre/use` (NoAccessGate) | `/profile/onboarding` | Nav globale |
| `/agents/pierre/use` (NoAccessGate) | `/profile/technologies` | Nav globale |
| `/agents/pierre/use` (NoAccessGate) | `/agents/pierre/setup` | Nav globale |
| `PierreCockpitShell` (LeftRail) | `/profile/agents` | Rail nav |
| `PierreCockpitShell` (LeftRail) | `/profile/messages` | Rail nav |
| `PierreCockpitShell` (LeftRail) | `/profile/onboarding` | Rail nav |
| `PierreCockpitShell` (LeftRail) | `/profile/technologies` | Rail nav |
| `PierreCockpitShell` (RightPanel) | `/profile/agents` | Section Pierre |
| `PierreCockpitShell` (RightPanel) | `/profile/onboarding` | Section Pierre |
| `/profile/agents` (accès rapides) | `/profile/onboarding` | Bouton "Configurer l'entreprise" |

---

## 6. Technologies Pierre affichées

Dans `NoAccessGate` (page.tsx) et `RightPanel` (PierreCockpitShell.tsx) :

| Technologie | Description |
|-------------|-------------|
| CloneOS | Orchestration des missions et demandes globales |
| CloneADN | Mémoire entreprise et contexte RH |
| CloneGuard | Validation humaine et gouvernance des risques |
| CloneTrace | Historique et audit de traçabilité |
| CloneBrief | Synthèses exécutives et briefings |

---

## 7. Lecture de cloneOSHistory

`usePierreCloneOSHistory()` :
- Lit `localStorage.getItem("clonestore.cloneos.commandHistory.v1")` (clé PHASE 2.4)
- Filtre : `domain === "hr"` OU `employee_slug === "pierre"`
- Retourne les 3 derniers résultats Pierre
- try/catch obligatoire — localStorage peut être absent

`PierreCloneOSHistoryPreview` :
- Affiche seulement si history.length > 0
- Chaque entrée : résumé CloneOS + statut + "Plan préparé — non exécuté."
- Lien retour Mon espace
- **Aucune écriture localStorage**. **Aucune exécution**.

---

## 8. Garde-fous

- `PIERRE_VALIDATION_HUMAINE` = "Validation humaine obligatoire sur les actions sensibles."
- `PIERRE_PLAN_ONLY_NOTE` = "Plan préparé — non exécuté."
- `PIERRE_LECTURE_SEULE` = "Lecture seule — aucune action exécutée depuis les résultats globaux."
- `PIERRE_SEUL_ACTIF` = "Pierre est le seul employé IA actif en V1 — domaine RH."
- Aucune modification moteur Pierre (`src/lib/pierre/**`)
- Aucune modification API Pierre (`src/app/api/pierre/**`)
- Layout `PierreCockpitShell` inchangé (`calc(100dvh - 70px)`)
- Hooks métier cockpit inchangés
- Appels API cockpit inchangés

---

## 9. Ce qui n'a PAS été fait

| Non fait | Raison |
|----------|--------|
| Réécriture PierreCockpitShell | Interdit |
| Modification moteur Pierre | Interdit |
| Modification hooks métier | Interdit |
| DB write depuis intégration globale | Interdit |
| Exécution CloneOS depuis Pierre cockpit | PHASE 2.7 = intégration UI only |
| Emma / Lucas / Sophie actifs | Interdit |
| Persistance cloneOSHistory depuis Pierre | Interdit — lecture seule |

---

## 10. Fichiers modifiés / créés

| Fichier | Modification |
|---------|-------------|
| `src/app/agents/pierre/use/page.tsx` | +constantes TECH, +NoAccessGate enrichi, +usePierreCloneOSHistory, +PierreCloneOSHistoryPreview |
| `src/app/agents/pierre/use/components/PierreCockpitShell.tsx` | +global nav dans LeftRail, +section Pierre dans RightPanel |
| `src/app/profile/agents/page.tsx` | +lien /profile/onboarding (accès rapides) |
| `docs/PHASE_2_7_PIERRE_COCKPIT_GLOBAL_INTEGRATION.md` | Ce document |
| `src/app/profile/__tests__/phase-2-7-pierre-global-integration.test.ts` | 43 tests statiques |

---

## 11. Invariants respectés

- `npx tsc --noEmit` : 0 erreur
- Pierre moteur `src/lib/pierre/**` : INTOUCHÉ
- Pierre API `src/app/api/pierre/**` : INTOUCHÉ
- Layout PierreCockpitShell : INCHANGÉ
- GO-LIVE 01 → GO-LIVE 10 : INTACTS
- TECH-01 → TECH-11 : INTACTS
- PHASE 2.1 → 2.6 tests : TOUJOURS VERTS
- Aucune écriture Supabase, aucune exécution

---

## 12. Prochain bloc recommandé : PHASE 2.8

**PHASE 2.8 — Responsive Premium Polish**

Objectif : auditer et corriger tous les problèmes de responsive sur les pages PHASE 2.2 → 2.7. Vérifier mobile/tablette/desktop. Corriger les layouts cassés, les textes trop longs, les tabs débordantes.

```
PHASE 2.1 ✅ Audit verrouillé
PHASE 2.2 ✅ Cockpit shell connecté
PHASE 2.3 ✅ CloneOS Command Bar
PHASE 2.4 ✅ Last Request Panel / Timeline
PHASE 2.5 ✅ Messages Center 4 Tabs
PHASE 2.6 ✅ Global Onboarding
PHASE 2.7 ✅ Pierre Cockpit Global Integration (ce bloc)
PHASE 2.8 → Responsive Premium Polish
PHASE 2.9 → Final QA Gate
```
