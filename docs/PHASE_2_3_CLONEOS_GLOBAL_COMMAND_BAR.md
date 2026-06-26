# PHASE 2.3 — CloneOS Global Command Bar

> Généré le : 2026-06-03
> Base : TECH-01 → TECH-11 validés. PHASE 2.1 + PHASE 2.2 validées. Moteur Pierre intact.
> Public launch : NO-GO externe.

---

## 1. Objectif PHASE 2.3

Brancher la command bar / salon global de `/profile/agents/page.tsx` sur le pipeline CloneOS TECH-08.

**Ce n'est pas de l'exécution.** C'est une connexion plan-only :
- Chaque requête passe par `processCloneOSCommand()` (TECH-08)
- Le résultat est affiché dans un panneau riche : classification, routage, plan, Guard, trace preview
- Aucune action n'est exécutée, aucune DB écrite, aucun appel réseau

---

## 2. Comment la command bar utilise CloneOS

### Import

```typescript
import type { CloneOSCommandCenterResult, CloneOSCommandInput } from "@/lib/clonestore/cloneos";
import { processCloneOSCommand } from "@/lib/clonestore/cloneos";
```

### Construction de l'input

```typescript
const cloneOSInput: CloneOSCommandInput = {
  company_id: userId ?? "demo_company",
  user_id: userId ?? undefined,
  source: "profile_command_center",
  raw_request: text,
  attached_file_refs: [],
  metadata: {},
  is_demo: !userId,
};
```

### Appel synchrone (pure function — pas d'async)

```typescript
const cloneOSResult = processCloneOSCommand(cloneOSInput);
setLastCloneOSResult(cloneOSResult);
```

### Résultat stocké en local state

```typescript
const [lastCloneOSResult, setLastCloneOSResult] = useState<CloneOSCommandCenterResult | null>(null);
```

---

## 3. Pipeline UI

```
Utilisateur saisit une demande
  ↓
submitCommand() buildInput → processCloneOSCommand() [synchrone, pure]
  ↓
classifyCloneOSCommand()       → domaine / intention / risque / confiance
  ↓
routeCloneOSCommand()          → Pierre (RH) ou no_employee (domaines non couverts)
  ↓
buildCloneOSCommandContext()   → TECH-02 + TECH-05 + TECH-06 + TECH-07
  ↓
buildCloneOSCommandPlan()      → titre mission / tâches / validation_required
  ↓
evaluateCloneOSCommandPlanWithGuard() → TECH-06, par tâche
  ↓
buildCloneOSCommandTraceEvents()     → TECH-07, events en mémoire
  ↓
CloneOSCommandCenterResult
  ↓
setLastCloneOSResult(result)
  ↓
CloneOSResultCard affiché dans le cockpit
```

---

## 4. Pourquoi aucune action n'est exécutée

- `processCloneOSCommand()` est une pure function synchrone — zéro side effect
- Aucun appel réseau, aucune DB, aucun appel Pierre runtime
- La `source: "profile_command_center"` est déclarative — pas d'exécution auto
- Les tâches du plan ont `can_auto_execute: false` pour les actions sensibles
- Les invariants absolus CloneGuard refusent : paie officielle, licenciement, décision légale, signature de contrat
- Le label `CLONEOS_PLAN_ONLY_LABEL = "Plan uniquement — aucune action exécutée."` est affiché partout

---

## 5. Comment Pierre est routé

`routeCloneOSCommand()` (TECH-08) consulte `EMPLOYEE_RUNTIME_REGISTRY` :
- Si domaine = `"hr"` → Pierre est sélectionné (seul employé actif en V1)
- `selected_route.is_available = true`, `selected_route.employee_slug = "pierre"`
- Affiché dans `CloneOSResultCard` : "Pierre (RH) — seul employé actif V1"

---

## 6. Comment les domaines non RH sont traités

Si domaine ≠ `"hr"` (finance, support, admin, legal, sales…) :
- `selected_route.is_available = false`
- `selected_route.readiness_status = "no_employee"`
- Message affiché : "Aucun employé actif disponible pour ce domaine. Pierre est le seul employé IA actif en V1. Les domaines non RH seront activés avec de futurs employés IA."
- **Lucas (Finance) : jamais affiché comme actif**
- **Emma (Support) : jamais affichée comme active**
- **Sophie (Administratif) : jamais affichée comme active**

---

## 7. Composant CloneOSResultCard

Affiché après chaque commande soumise. Sections :

| Section | Contenu |
|---------|---------|
| En-tête | Status (ready_for_execution / requires_validation / blocked / refused) |
| Classification | Domaine · Intention · Risque · Confiance |
| Routage | Pierre (RH) ou "aucun employé actif disponible" |
| Plan | Titre mission + liste des tâches (max 5) avec décision Guard par tâche |
| CloneGuard | Décision globale · raisons bloquantes · mention validation humaine |
| Aperçu de trace | Nombre d'événements préparés · timeline_id · non persisté |
| Action suivante | `next_action` depuis CloneOS |

---

## 8. Ce qui reste mock jusqu'aux phases suivantes

| Donnée | État | Phase cible |
|--------|------|-------------|
| Board missions (kanban) | Local state — enrichi depuis CloneOS plan | PHASE 2.4+ (Last Request Panel) |
| Validations board | Local state — enrichi depuis CloneOS guard | PHASE 2.4+ |
| Messages center | Local state | PHASE 2.5 |
| Salon (sendSalonMessage) | Simulation locale | PHASE 2.4+ |
| TraceItems timeline | Local state — enrichis avec trace preview CloneOS | PHASE 2.4+ |
| Briefings | Local state | PHASE 2.5+ |
| Alertes | Local state | PHASE 2.5+ |
| Règles ADN | Local state | PHASE 2.5+ |

---

## 9. Ce qui n'a PAS été fait

| Non fait | Raison |
|----------|--------|
| Exécution réelle Pierre | INTERDIT — plan-only |
| Appel réseau / Supabase | INTERDIT |
| Appel OpenAI / Anthropic | INTERDIT |
| Brancher salon (sendSalonMessage) | PHASE 2.4+ |
| Last Request Panel complet | PHASE 2.4 |
| Messages center réel | PHASE 2.5 |
| Onboarding global | PHASE 2.6 |
| Emma / Lucas / Sophie actifs | INTERDIT |
| Modifier Pierre moteur | INTERDIT |
| Modifier GO-LIVE 01-10 | INTERDIT |
| Modifier TECH-01-11 | INTERDIT |

---

## 10. Fichiers modifiés / créés

| Fichier | Action |
|---------|--------|
| `src/app/profile/agents/page.tsx` | Modifié — import TECH-08, état lastCloneOSResult, constantes, CloneOSResultCard, submitCommand() rebranché |
| `docs/PHASE_2_3_CLONEOS_GLOBAL_COMMAND_BAR.md` | Créé — ce document |
| `src/app/profile/__tests__/phase-2-3-cloneos-command-bar.test.ts` | Créé — 36 tests statiques |

---

## 11. Invariants respectés

- `npx tsc --noEmit` : 0 erreur
- Pierre moteur `src/lib/pierre/**` : INTOUCHÉ
- Pierre cockpit `src/app/agents/pierre/**` : INTOUCHÉ
- GO-LIVE 01 → GO-LIVE 10 : INTACTS
- TECH-01 → TECH-11 : INTACTS
- PHASE 2.1 + PHASE 2.2 tests : TOUJOURS VERTS
- Public launch : NO-GO externe
- Aucun proof auto-validé
- `processCloneOSCommand` = pure function, zéro side effect

---

## 12. Prochain bloc recommandé : PHASE 2.4

**PHASE 2.4 — Last Request Panel / CloneOS Result Timeline**

Objectif : persister et afficher l'historique des commandes CloneOS en local state.

Actions :
- Conserver toutes les `CloneOSCommandCenterResult` dans un tableau `commandHistory`
- Afficher un panneau "Dernières requêtes" avec timeline
- Filtrer par domaine / statut / risque
- Connecter le salon (`sendSalonMessage`) au pipeline CloneOS
- Afficher les tâches refusées avec explication Guard

```
PHASE 2.1 ✅ Audit verrouillé
PHASE 2.2 ✅ Cockpit shell connecté
PHASE 2.3 ✅ CloneOS Command Bar (ce bloc)
PHASE 2.4 → Last Request Panel / CloneOS Result Timeline
PHASE 2.5 → Messages Center 4 Onglets
PHASE 2.6 → Global Onboarding
PHASE 2.7 → Pierre Integration
PHASE 2.8 → Responsive Polish
PHASE 2.9 → Final QA Gate
```
