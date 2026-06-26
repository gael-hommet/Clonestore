# PHASE 2.2 — Global Cockpit Shell / Mon espace Premium

> Généré le : 2026-06-02
> Base : TECH-01 → TECH-11 validés. PHASE 2.1 audit verrouillé. Moteur Pierre B38-B48 intact.
> Public launch : NO-GO externe.

---

## 1. Objectif PHASE 2.2

Transformer `/profile/agents/page.tsx` en cockpit global connecté aux données réelles de base.

**Ce n'est pas une reconstruction.** C'est une connexion ciblée :
- Employés : données Employee Runtime Contract (TECH-02) au lieu de données locales mock
- Technologies : données GlobalTechnologyConfig (TECH-03) au lieu de 5 items hardcodés
- Pierre : seul employé actif réel — affiché avec son contrat complet
- Futurs employés : roadmap clair, jamais présentés comme actifs
- Navigation : liens directs vers cockpit Pierre + technologies

---

## 2. Ce qui a été connecté

### Employee Runtime Contract (TECH-02)

Import ajouté :
```typescript
import {
  EMPLOYEE_RUNTIME_REGISTRY,
  PIERRE_EMPLOYEE_RUNTIME_CONTRACT,
} from "@/lib/clonestore/employees/employee-registry";
```

**Utilisations** :
- Badge héro : `EMPLOYEE_RUNTIME_REGISTRY.some(e => e.slug === "pierre")` → badge "Pierre actif — HR" affiché dynamiquement
- `PierreContractBanner` : nouveau composant qui lit `PIERRE_EMPLOYEE_RUNTIME_CONTRACT` directement
  - Statut réel : `launch_candidate`
  - Technologies requises : liste réelle des `required_technologies.filter(t => t.required)`
  - Liens directs : `/agents/pierre/use` et `/agents/pierre/setup`
- Guard banner : gouvernance réelle depuis le contrat

### GlobalTechnologyConfig (TECH-03)

Import ajouté :
```typescript
import {
  DEFAULT_GLOBAL_TECH_CONFIGS,
  DEFAULT_GLOBAL_TECH_CONFIG_LIST,
} from "@/lib/clonestore/technologies/global-tech-defaults";
```

**Utilisations** :
- `technologies` useMemo remplacé : lit `DEFAULT_GLOBAL_TECH_CONFIGS[key]` pour chaque technologie visible
- `techSummary` useMemo nouveau : compte actives / partielles / roadmap depuis `DEFAULT_GLOBAL_TECH_CONFIG_LIST`
- Badge héro : `{techSummary.active} technologies actives` (réel)
- Section technologies : description avec vrais comptes
- CloneVoice : état `watching` avec mention "Préparation uniquement — non actif en production."
- Readiness scores affichés par technologie

---

## 3. Employee Runtime dans le cockpit

**Pierre est le seul employé IA actif réel dans `EMPLOYEE_RUNTIME_REGISTRY` (V1).**

### PierreContractBanner (nouveau composant)

Affiché si et seulement si `EMPLOYEE_RUNTIME_REGISTRY.some(e => e.slug === "pierre")`.

Affiche :
- Badge "Actif — launch candidate"
- Domaine : HR
- "Premier employé IA CloneStore"
- Description depuis `PIERRE_EMPLOYEE_RUNTIME_CONTRACT.public_positioning`
- Technologies requises (hard required) : CloneOS, CloneADN, CloneGuard, CloneTrace
- Gouvernance : CloneGuard actif, validation humaine obligatoire, ClonePolicy + CloneTrust
- Liens : cockpit Pierre (`/agents/pierre/use`) + configuration (`/agents/pierre/setup`)

### ActiveAgentMetas

Inchangé — toujours piloté par Supabase `orders`. Si le client a Pierre actif dans sa commande, il apparaît dans `EmployeeCard`.

---

## 4. Pierre seul actif V1

Règle respectée : `EMPLOYEE_RUNTIME_REGISTRY` ne contient que `PIERRE_EMPLOYEE_RUNTIME_CONTRACT`.

Emma, Lucas, Sophie, Clara ne sont **pas** dans le registre. Ils apparaissent uniquement dans `ROADMAP_EMPLOYEES` (données statiques dans le composant — pas dans le registre).

Les futurs employés ne peuvent PAS :
- Avoir un badge "Actif"
- Avoir un lien cockpit actif
- Apparaître dans `activeAgentMetas`
- Être mobilisés par CloneOS dans le plan

---

## 5. Futurs employés — roadmap

Type `RoadmapEmployeeStub` :
```typescript
type RoadmapEmployeeStub = {
  slug: string;
  name: string;
  domain: string;
  description: string;
  stage: "soon" | "roadmap" | "concept";
};
```

Employés affichés :
| Nom | Domaine | Stage |
|-----|---------|-------|
| Emma | Support client | soon |
| Lucas | Finance | soon |
| Sophie | Administratif | roadmap |
| Clara | Recrutement | roadmap |

**Affichage `RoadmapEmployeeCard` :**
- Badge "Bientôt disponible" (soon) ou "En développement" (roadmap)
- Badge "Non activé dans votre espace" — toujours visible
- Texte de pied : "Disponible bientôt — non activé dans votre espace."
- Aucun bouton "Ouvrir" ou "Cockpit"
- Aucun statut "Actif"

---

## 6. Technologies GlobalTechnologyConfig dans le cockpit

### Technologies cockpit visibles (5)

| Key | Nom | Statut réel | Score repo | Affiché |
|-----|-----|-------------|------------|---------|
| cloneos | CloneOS | active | 85/100 | ✅ |
| cloneguard | CloneGuard | active | 85/100 | ✅ (needs_attention si validations pending) |
| clonetrace | CloneTrace | active | 80/100 | ✅ |
| cloneadn | CloneADN | active | 80/100 | ✅ |
| clonevoice | CloneVoice | partial / disabled | 15/100 | ✅ (watching) |

### Résumé techSummary (côté héro + section)

Calculé depuis `DEFAULT_GLOBAL_TECH_CONFIG_LIST` (13 technologies) :
- total : 13
- active : 4 (cloneos, cloneadn, cloneguard, clonetrace)
- partial : 3 (clonevoice, clonechat, clonecontinuum)
- roadmap : 4+ (clonebrief, clonereview, etc.)

### CloneVoice

State toujours `watching`. LastEvent : "Préparation uniquement — non actif en production."

Respect de TECH-10 : CloneVoice non vendu comme actif production.

### Lien technologies

La section Technologies du cockpit pointe maintenant sur `/profile/technologies` (TECH-04 complet).

---

## 7. Ce qui reste mock jusqu'aux phases suivantes

| Donnée | État | Phase cible |
|--------|------|-------------|
| Missions (kanban) | Mock hardcodé | PHASE 2.3+ (CloneOS réel) |
| Validations | Mock hardcodé | PHASE 2.3+ |
| Messages (dans cockpit) | Mock hardcodé | PHASE 2.5 (Messages Center) |
| Salon/CloneOS command | Simulation locale | PHASE 2.3 (CloneOS Command Bar) |
| Trace timeline | Mock TraceItem | PHASE 2.3+ |
| Briefings | Mock BriefingItem | PHASE 2.5+ (CloneBrief) |
| Alertes (cockpit) | Mock AlertItem | PHASE 2.5+ (Guard) |
| Règles ADN | Mock RuleItem | PHASE 2.5+ |

**Ces données mock restent volontairement mock.** Elles seront branchées progressivement.

---

## 8. Ce qui n'a PAS été fait

| Non fait | Raison |
|----------|--------|
| Brancher CloneOS command | PHASE 2.3 |
| Créer Last Request Panel | PHASE 2.4 |
| Refaire Messages Center | PHASE 2.5 |
| Créer onboarding global | PHASE 2.6 |
| Modification moteur Pierre | INTERDIT |
| Écriture Supabase | INTERDIT |
| Appel OpenAI/Anthropic | INTERDIT |
| Appel Stripe live | INTERDIT |
| Créer Emma/Lucas/Sophie actifs | INTERDIT |
| Modifier GO-LIVE flags | INTERDIT |
| Modifier go-live-proofs.local.json | INTERDIT |
| CloneVoice comme actif production | INTERDIT |

---

## 9. Fichiers modifiés / créés

| Fichier | Action |
|---------|--------|
| `src/app/profile/agents/page.tsx` | Modifié — connexions TECH-02/03, nouveaux composants, roadmap |
| `docs/PHASE_2_2_GLOBAL_COCKPIT_SHELL.md` | Créé — ce document |
| `src/app/profile/__tests__/phase-2-2-global-cockpit-shell.test.ts` | Créé — 35 tests statiques |

---

## 10. Invariants respectés

- `npx tsc --noEmit` : 0 erreur
- Pierre moteur `src/lib/pierre/**` : INTOUCHÉ
- Pierre cockpit `src/app/agents/pierre/**` : INTOUCHÉ
- GO-LIVE 01 → GO-LIVE 10 : INTACTS
- TECH-01 → TECH-11 : INTACTS
- PHASE 2.1 tests : TOUJOURS VERTS
- Public launch : NO-GO externe
- Aucun proof auto-validé

---

## 11. Prochain bloc recommandé : PHASE 2.3

**PHASE 2.3 — CloneOS Global Command Bar**

Objectif : connecter le salon (command center) existant au pipeline CloneOS TECH-08.

Actions :
- Connecter input salon → `classifyCloneOSCommand()` (TECH-08)
- Connecter → `buildCloneOSCommandContext()` (TECH-08)
- Connecter → `buildCloneOSCommandPlan()` (TECH-08)
- Mode plan-only : afficher le plan sans exécuter
- Afficher : compréhension, routage, employé sélectionné, Guard result
- Trace event créé (préparation, pas exécution)

**Contrainte clé :** Pas d'exécution réelle, pas d'écriture Supabase, plan-only.

```
PHASE 2.1 ✅ Audit verrouillé
PHASE 2.2 ✅ Cockpit shell connecté (ce bloc)
PHASE 2.3 → CloneOS Global Command Bar (prochain)
PHASE 2.4 → Last Request Panel
PHASE 2.5 → Messages Center 4 Onglets
PHASE 2.6 → Global Onboarding
PHASE 2.7 → Pierre Integration
PHASE 2.8 → Responsive Polish
PHASE 2.9 → Final QA Gate
```
