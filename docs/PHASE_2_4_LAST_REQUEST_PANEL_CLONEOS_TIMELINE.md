# PHASE 2.4 — Last Request Panel / CloneOS Result Timeline

> Généré le : 2026-06-03
> Base : TECH-01 → TECH-11 validés. PHASE 2.1 + 2.2 + 2.3 validées. Moteur Pierre intact.
> Public launch : NO-GO externe.

---

## 1. Objectif PHASE 2.4

Créer un suivi local et persistant des commandes CloneOS dans le cockpit global.

PHASE 2.3 affichait uniquement la **dernière** commande via `CloneOSResultCard`.
PHASE 2.4 ajoute :
- un historique de 20 commandes (local state + localStorage)
- un panneau opérationnel "À propos de votre dernière demande" (`LastRequestPanel`)
- une timeline filtrable (`CloneOSCommandTimeline`)
- un helper commun `runCloneOSCommand()` partagé entre la command bar et le salon

Tout reste **plan-only**. Aucune exécution réelle, aucune DB, aucun appel Pierre.

---

## 2. commandHistory local state

### Nommage

⚠️ `commandHistory: SalonMessage[]` existait déjà (PHASE 2.3 / messages chat UI).
Le history CloneOS utilise un nom distinct : **`cloneOSHistory: CloneOSCommandCenterResult[]`**.

### Taille maximale

`CLONEOS_HISTORY_MAX = 20` — les entrées les plus anciennes sont éliminées au-delà.

### Dédoublonnage

Par `command_id` — un même résultat ne peut pas figurer deux fois.

---

## 3. localStorage

### Clé

`"clonestore.cloneos.commandHistory.v1"`

### Hydratation

Au montage client (useEffect) :
```typescript
useEffect(() => {
  try {
    const raw = localStorage.getItem(CLONEOS_HISTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CloneOSCommandCenterResult[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        setCloneOSHistory(parsed.slice(0, CLONEOS_HISTORY_MAX));
      }
    }
  } catch (_e) { /* skip — localStorage indisponible ou JSON corrompu */ }
}, []);
```

### Écriture

Dans `addToCloneOSHistory()` après chaque résultat CloneOS.

### Effacement

`clearCloneOSHistory()` → `localStorage.removeItem(CLONEOS_HISTORY_KEY)` + `setCloneOSHistory([])`.

---

## 4. LastRequestPanel

Composant affiché en permanence dans la section `id="last-request"` du cockpit.

### État sans commande

Texte pédagogique : "Envoyez une demande via le centre de commandement pour voir ici la compréhension, le routage, les validations et le plan préparé."

### État avec résultat

6 blocs visuels :

| Bloc | Contenu |
|------|---------|
| En-tête | `CLONEOS_PLAN_ONLY_LABEL` · status · heure |
| Compréhension | summary · domaine · risque · intention |
| Employé mobilisé | Pierre (RH) si domaine=hr, sinon `CLONEOS_NO_EMPLOYEE_LABEL` |
| Plan de mission | titre · nombre tâches · tâches (max 4) · validation_required |
| CloneGuard | décision globale · has_validation · has_refused (invariants absolus) |
| CloneTrace | event_count · timeline_id · `CLONEOS_TRACE_PREVIEW_LABEL` |

---

## 5. CloneOSCommandTimeline

Composant affiché à droite de `LastRequestPanel` (layout `xl:grid-cols-[1fr_320px]`).

### Affichage par entrée

- Status (badge coloré)
- Domaine
- "Pierre" si route disponible
- Risque élevé/critique en rouge
- Résumé (2 lignes max)
- Heure

### Interaction

Cliquer sur une entrée → `onSelectResult(entry)` → `setLastCloneOSResult(r)` → LastRequestPanel se met à jour.

---

## 6. Filtres

| Filtre | Comportement |
|--------|-------------|
| `all` | Tout l'historique |
| `hr` | `classified_command.domain === "hr"` |
| `blocked` | `status === "blocked"` |
| `requires_validation` | `status === "requires_validation"` |
| `refused` | `status === "refused"` |
| `no_employee` | `selected_route.is_available === false` |
| `high_risk` | `risk_level === "high"` ou `"critical"` |

Implémenté par `filterCloneOSHistory(history, filter)` — pure function, hors composant.

---

## 7. Connexion sendSalonMessage

Avant PHASE 2.4, `sendSalonMessage()` utilisait une simulation locale (detectRecipients, isStop/isRule/isBrief/isApproval).

Après PHASE 2.4 :
- Comportement visuel du salon **inchangé**
- À la fin de `sendSalonMessage()`, si `!isStop` → appel `runCloneOSCommand(text)`
- Le résultat est ajouté à `cloneOSHistory` et visible dans `LastRequestPanel`

### runCloneOSCommand — helper commun

```typescript
function runCloneOSCommand(text: string): CloneOSCommandCenterResult {
  const input: CloneOSCommandInput = {
    company_id: userId ?? "demo_company",
    source: "profile_command_center",
    raw_request: text,
    attached_file_refs: [],
    metadata: {},
    is_demo: !userId,
  };
  const result = processCloneOSCommand(input);
  setLastCloneOSResult(result);
  addToCloneOSHistory(result);
  return result;
}
```

Utilisé par `submitCommand()` ET `sendSalonMessage()`.

---

## 8. Ce qui reste plan-only

| Donnée | État |
|--------|------|
| cloneOSHistory | Local state + localStorage — plan-only, jamais persisté Supabase |
| LastRequestPanel | Lecture seule — affiche plan, jamais exécute |
| CloneOSCommandTimeline | Navigation dans l'historique local |
| missions board | Local state mock |
| validations board | Local state mock |
| messages center | Local state mock |
| briefings / alertes / règles | Local state mock |

---

## 9. Ce qui n'a PAS été fait

| Non fait | Raison |
|----------|--------|
| Messages center réel | PHASE 2.5 |
| Onboarding global | PHASE 2.6 |
| Pierre runtime exécuté | INTERDIT |
| DB Supabase | INTERDIT |
| OpenAI / Anthropic / Stripe | INTERDIT |
| Emma / Lucas / Sophie actifs | INTERDIT |
| Modifier moteur Pierre | INTERDIT |
| Modifier GO-LIVE 01-10 | INTERDIT |

---

## 10. Fichiers modifiés / créés

| Fichier | Action |
|---------|--------|
| `src/app/profile/agents/page.tsx` | Modifié — constantes, filterCloneOSHistory, CloneOSCommandTimeline, LastRequestPanel, states cloneOSHistory + cloneOSHistoryFilter, useEffect localStorage, helpers addToCloneOSHistory + clearCloneOSHistory + runCloneOSCommand, submitCommand refactorisé, sendSalonMessage aligné, JSX section last-request + rail button |
| `docs/PHASE_2_4_LAST_REQUEST_PANEL_CLONEOS_TIMELINE.md` | Créé — ce document |
| `src/app/profile/__tests__/phase-2-4-last-request-panel.test.ts` | Créé — 45 tests statiques |

---

## 11. Invariants respectés

- `npx tsc --noEmit` : 0 erreur
- Pierre moteur `src/lib/pierre/**` : INTOUCHÉ
- Pierre cockpit `src/app/agents/pierre/**` : INTOUCHÉ
- GO-LIVE 01 → GO-LIVE 10 : INTACTS
- TECH-01 → TECH-11 : INTACTS
- PHASE 2.1 + 2.2 + 2.3 tests : TOUJOURS VERTS
- Public launch : NO-GO externe
- Aucun proof auto-validé
- `processCloneOSCommand` = pure function, zéro side effect

---

## 12. Prochain bloc recommandé : PHASE 2.5

**PHASE 2.5 — Messages Center 4 Tabs**

Objectif : restructurer `/profile/messages/page.tsx` en 4 onglets réels :
- **Suivis** (mission follow-ups)
- **Briefings** (CloneBrief TECH-09)
- **Livraisons** (artefacts livrés)
- **Alertes** (Guard + risques)

Connecter à l'opérationnel CloneOS. Données mock → données structurées.

```
PHASE 2.1 ✅ Audit verrouillé
PHASE 2.2 ✅ Cockpit shell connecté
PHASE 2.3 ✅ CloneOS Command Bar
PHASE 2.4 ✅ Last Request Panel / CloneOS Timeline (ce bloc)
PHASE 2.5 → Messages Center 4 Tabs
PHASE 2.6 → Global Onboarding
PHASE 2.7 → Pierre Integration
PHASE 2.8 → Responsive Polish
PHASE 2.9 → Final QA Gate
```
