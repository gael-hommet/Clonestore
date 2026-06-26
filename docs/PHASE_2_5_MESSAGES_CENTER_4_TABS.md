# PHASE 2.5 — Messages Center 4 Tabs

> Généré le : 2026-06-03
> Base : TECH-01 → TECH-11 validés. PHASE 2.1 → 2.4 validées. Moteur Pierre intact.
> Public launch : NO-GO externe.

---

## 1. Objectif PHASE 2.5

Restructurer `/profile/messages/page.tsx` en centre de messages opérationnel avec **exactement 4 onglets** :

| Onglet | Rôle | Source conceptuelle |
|--------|------|---------------------|
| Suivis | Missions, relances, dossiers actifs | CloneOS · CloneTrace |
| Briefings | Synthèses exécutives, résumés quotidiens | CloneBrief TECH-09 |
| Livraisons | Documents préparés, emails brouillons, artefacts | Pierre · CloneTrace |
| Alertes | Validations Guard, blocages, refus, risques | CloneGuard TECH-06 |

Avant PHASE 2.5 : 6 catégories (`preparations`, `suivis`, `briefings`, `livraisons`, `alertes`, `envoyes`).
Après PHASE 2.5 : **4 onglets nets**. `preparations` → fusionné dans `suivis`. `envoyes` → fusionné dans `livraisons`.

---

## 2. Pourquoi 4 onglets

### Avant (6 catégories — trop granulaire)
- `preparations` → redondant avec `suivis`
- `envoyes` → redondant avec `livraisons`

### Après (4 onglets — cohérent avec l'architecture)
| Onglet | Correspond à |
|--------|-------------|
| Suivis | Missions CloneOS + dossiers actifs + relances |
| Briefings | CloneBrief TECH-09 — synthèses executives |
| Livraisons | Artefacts livrés — documents, emails préparés |
| Alertes | Guard decisions — requires_validation, block, refuse |

---

## 3. Rôle de Suivis

**Source conceptuelle** : CloneOS results (`CloneOSCommandCenterResult`) · CloneTrace events

Affiche :
- Plans de mission préparés par CloneOS (non exécutés)
- Dossiers d'absence, onboarding, dossiers ouverts
- Relances en attente d'information

Microcopy : "Missions en cours, demandes CloneOS analysées, tâches planifiées."

**Empty state** : "Soumettez une demande via le centre de commandement. CloneOS créera les suivis de mission ici."

---

## 4. Rôle de Briefings

**Source conceptuelle** : CloneBrief TECH-09 (`CloneBriefExecutiveSummary`, `CloneBriefType`)

Affiche :
- Briefings du jour (`daily`)
- Synthèses des validations en attente (`validation`)
- Résumés hebdomadaires / mensuels
- Activité des employés IA

Microcopy : "Résumés CloneBrief, briefings du jour, synthèses hebdomadaires."

**Empty state** : "Les briefings apparaîtront ici dès que CloneBrief produira des synthèses."

---

## 5. Rôle de Livraisons

**Source conceptuelle** : CloneTrace events (`document_prepared`, `email_prepared`) · Pierre artefacts

Affiche :
- Brouillons de documents RH prêts à validation
- Emails préparés (non envoyés — validation humaine requise)
- Synthèses de mission
- Livrables tracés par CloneTrace

**Invariant** : jamais "email envoyé" ni "document généré" si non validé humainement.

Microcopy : "Documents prêts à validation, emails préparés, livrables Pierre."

---

## 6. Rôle d'Alertes

**Source conceptuelle** : CloneGuard TECH-06 (`GlobalGuardDecision`) · CloneOS status blocked/refused

Affiche :
- `requires_validation` — validation humaine requise
- `block` — action bloquée par Guard
- `refuse` — invariant absolu (paie/licenciement/légal/signature)
- Domaine non couvert (aucun employé actif)

**Bannière `AlertesBanner`** : affichée si urgentCount > 0, avec lien direct vers cockpit Pierre.

Microcopy :
- "CloneGuard bloque cette action en autonomie."
- "Validation humaine nécessaire avant toute exécution."
- "Aucun employé IA actif n'est disponible pour ce domaine."

**Empty state** : "CloneGuard remontera ici les validations, blocages et refus dès qu'une action sera analysée."

---

## 7. Sources CloneOS / CloneTrace / CloneBrief / CloneGuard

### Imports utilisés (lecture locale)

```typescript
import { PIERRE_EMPLOYEE_RUNTIME_CONTRACT } from "@/lib/clonestore/employees/employee-registry";
import type { CloneOSCommandCenterResult } from "@/lib/clonestore/cloneos";
import type { CloneBriefExecutiveSummary, CloneBriefType } from "@/lib/clonestore/brief";
import type { GlobalTraceEventType } from "@/lib/clonestore/trace";
import type { GlobalGuardDecision } from "@/lib/clonestore/guard";
```

### Types TECH sur MessageItem

Chaque `MessageItem` peut porter :
- `traceEventType?: GlobalTraceEventType` — type d'événement CloneTrace associé
- `guardDecision?: GlobalGuardDecision` — décision Guard associée
- `briefType?: CloneBriefType` — type de briefing
- `cloneOSStatus?: CloneOSCommandCenterResult["status"]` — statut CloneOS

Ces champs permettent :
1. Filtres futurs sur type d'événement
2. Affichage badge Guard dans le détail
3. Affichage statut CloneOS dans les alertes
4. Cohérence terminologique avec les libs TECH

### Helpers PHASE 2.5

| Helper | Rôle |
|--------|------|
| `buildMessagesFromCloneOSPreview(result, baseItems)` | Filtre les alertes depuis un résultat CloneOS |
| `buildMessagesFromTracePreview(eventType, baseItems)` | Filtre par type d'événement CloneTrace |
| `buildMessagesFromGuardPreview(decision, baseItems)` | Filtre par décision Guard |
| `buildMessagesFromBriefPreview(briefType, baseItems)` | Filtre par type de briefing |
| `groupMessagesByTab(items)` | Groupe par onglet |
| `filterMessages(items, filter, archivedIds)` | Filtre combiné tab+query |
| `countUnreadByTab(items, readIds, archivedIds)` | Compteur non-lus par onglet |
| `countUrgentAlerts(items, archivedIds)` | Compteur alertes Guard urgentes |

Ces helpers opèrent sur les données mock structurées pour l'instant. Ils préparent l'intégration future.

---

## 8. Données mock structurées vs future persistance

### Actuellement mock (structuré)

Les 10 messages de `buildInitialMessages()` sont :
- Réalistes et honnêtes — jamais "email envoyé si mock"
- Nommés d'après les technologies (source: "CloneOS", "CloneBrief", "CloneGuard", etc.)
- Portent les types TECH (traceEventType, guardDecision, briefType, cloneOSStatus)
- Organisés par les 4 onglets exactement

### Future persistance (PHASE 2.7+)

| Onglet | Source future |
|--------|--------------|
| Suivis | Missions réelles Supabase · CloneOS cloneOSHistory |
| Briefings | CloneBrief engine TECH-09 · API route |
| Livraisons | Pierre artefacts DB · CloneTrace events |
| Alertes | CloneGuard evaluations · CloneOS blocked/refused |

---

## 9. Garde-fous lecture seule

**La messagerie PHASE 2.5 est lecture seule.** Elle n'exécute aucune action.

Microcopy systématique :
- "Lecture seule — aucune action exécutée depuis la messagerie."
- "Utilisez le cockpit Pierre pour agir."
- "Aucun employé IA ne peut agir seul."

Actions `readOnly: true` → désactivées (opacity-55, pointer-events-none).

Lien systématique vers `/agents/pierre/use` pour les actions sensibles.

---

## 10. Ce qui n'a PAS été fait

| Non fait | Raison |
|----------|--------|
| Persistance Supabase messages | PHASE 2.7+ |
| Envoi de notifications réelles | INTERDIT |
| Exécution d'actions depuis la messagerie | INTERDIT |
| Modification Pierre moteur | INTERDIT |
| OpenAI / Anthropic / Stripe | INTERDIT |
| Emma / Lucas / Sophie actifs | INTERDIT |
| Onboarding global | PHASE 2.6 |
| Intégration CloneBrief engine réel | PHASE 2.7+ |

---

## 11. Fichiers modifiés / créés

| Fichier | Action |
|---------|--------|
| `src/app/profile/messages/page.tsx` | Réécrit — 6 catégories → 4 onglets, TECH imports, 10 messages structurés, helpers, AlertesBanner, liens `/agents/pierre/use` + `/profile/technologies` |
| `docs/PHASE_2_5_MESSAGES_CENTER_4_TABS.md` | Créé — ce document |
| `src/app/profile/__tests__/phase-2-5-messages-center-4-tabs.test.ts` | Créé — 45 tests statiques |

---

## 12. Invariants respectés

- `npx tsc --noEmit` : 0 erreur
- Pierre moteur `src/lib/pierre/**` : INTOUCHÉ
- GO-LIVE 01 → GO-LIVE 10 : INTACTS
- TECH-01 → TECH-11 : INTACTS
- PHASE 2.1 → 2.4 tests : TOUJOURS VERTS
- Aucun email envoyé, aucun document réel généré, aucune mission exécutée

---

## 13. Prochain bloc recommandé : PHASE 2.6

**PHASE 2.6 — Global Onboarding Enterprise Foundation**

Objectif : créer le premier flux d'onboarding global pour un nouveau compte CloneStore — configuration initiale, découverte des employés IA, première mission guidée avec Pierre.

```
PHASE 2.1 ✅ Audit verrouillé
PHASE 2.2 ✅ Cockpit shell connecté
PHASE 2.3 ✅ CloneOS Command Bar
PHASE 2.4 ✅ Last Request Panel / Timeline
PHASE 2.5 ✅ Messages Center 4 Tabs (ce bloc)
PHASE 2.6 → Global Onboarding Enterprise Foundation
PHASE 2.7 → Pierre Integration complète
PHASE 2.8 → Responsive Polish
PHASE 2.9 → Final QA Gate
```
