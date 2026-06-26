# PHASE 3.12 — Pierre Use Mission Composer Footprint Prefill QA

## Objectif

Permettre à l'utilisateur de cliquer sur une suggestion plan-only issue de l'Empreinte
Entreprise pour **préremplir le champ texte du composer Pierre** — sans auto-submit,
sans exécution, sans appel API. La décision d'envoyer reste 100% manuelle.

---

## État avant PHASE 3.12

- PHASE 3.11 : `/agents/pierre/use` lit l'Empreinte Entreprise en read-only.
  5 suggestions `plan_only: true` affichées en mode lecture (aucun bouton "Utiliser").
  Strip compact au-dessus du cockpit actif.
  `usePierreCockpit` expose `setInputDraft` mais le strip ne l'utilisait pas.

---

## Fichiers créés / modifiés en PHASE 3.12

### Créés

| Fichier | Rôle |
|---|---|
| `src/lib/clonestore/enterprise-footprint/enterprise-footprint-pierre-prefill.ts` | Module prefill pur — helpers, validation, sanitisation |
| `src/lib/clonestore/enterprise-footprint/enterprise-footprint-pierre-prefill-qa.ts` | QA module PHASE 3.12 (15 étapes) |
| `src/lib/clonestore/enterprise-footprint/__tests__/enterprise-footprint-pierre-prefill-phase3-12.test.ts` | Tests QA |
| `docs/PHASE_3_12_PIERRE_USE_MISSION_COMPOSER_FOOTPRINT_PREFILL_QA.md` | Cette documentation |

### Modifiés

| Fichier | Modification |
|---|---|
| `src/lib/clonestore/enterprise-footprint/index.ts` | Exports prefill module + QA |
| `src/app/agents/pierre/use/page.tsx` | `CockpitWrapper` reçoit `footprintResult`, callback prefill, strip enrichi avec boutons |
| `package.json` | Ajout `test:phase3-12` |

---

## Modèle `PierreFootprintPrefillPayload`

```ts
type PierreFootprintPrefillPayload = {
  prompt: string;
  suggestion_id: string;
  title: string;
  source: "enterprise_footprint_suggestion";
  plan_only: true;             // invariant absolu
  requires_user_submit: true;  // invariant absolu — jamais d'auto-submit
  created_at: string;
};
```

Les deux invariants `plan_only: true` et `requires_user_submit: true` sont obligatoires.
`validatePierreFootprintPrefillPayload` refuse tout payload qui ne les respecte pas.

---

## Validation et sanitisation

### Règles de validation

- `plan_only` doit être `true`.
- `requires_user_submit` doit être `true`.
- `source` doit être `"enterprise_footprint_suggestion"`.
- Prompt ne doit pas être vide.
- Prompt ne doit pas contenir de patterns interdits.

### Patterns interdits dans les prompts

Voir `UNSAFE_PATTERNS` dans `enterprise-footprint-pierre-prefill.ts` pour la liste complète.
Catégories bloquées :

| Catégorie | Exemples de patterns |
|---|---|
| Clés Stripe live | `sk_live_*`, `whsec_*` |
| Clés API externes | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` |
| Phrases de lancement non validées | formulations de lancement public externe |
| Formulations interdites | expressions absolues d'absence d'erreur ou de garantie |

### Sanitisation

`sanitizePierreFootprintPrefillPrompt(prompt)` : trim, réduction des newlines
excessifs (`\n\n\n` → `\n\n`), normalisation des espaces multiples.

---

## Intégration `/agents/pierre/use`

### Architecture PHASE 3.12

```
CockpitContent
  └── CockpitWrapper (reçoit footprintResult)
        ├── usePierreCockpit()                    → cockpit (avec setInputDraft)
        ├── handleUseFootprintSuggestion(payload) → setInputDraft uniquement, jamais submitMission
        ├── PierreUseFootprintStrip               → boutons "Utiliser" + confirmation
        └── PierreCockpitShell                    → inchangé
```

### Comment le préremplissage fonctionne

1. L'utilisateur clique sur un bouton "Utiliser" sur une suggestion plan-only.
2. `handleSuggestionClick(sg)` est appelé dans le strip.
3. `buildPierreFootprintPrefillPayload(sg)` construit le payload (retourne `null` si disabled).
4. `onUseSuggestion(payload)` est appelé dans `CockpitWrapper`.
5. `validatePierreFootprintPrefillPayload(payload)` valide le payload.
6. `sanitizePierreFootprintPrefillPrompt(payload.prompt)` sanitise le prompt.
7. **`cockpit.setInputDraft(sanitized)`** prérempli le composer.
8. `buildPierreFootprintPrefillConfirmation(payload)` construit la confirmation.
9. La confirmation s'affiche 4 secondes dans le strip.
10. L'utilisateur relit le prompt dans le textarea et **décide lui-même d'envoyer**.

### Garantie no auto-submit

- `handleUseFootprintSuggestion` n'appelle **jamais** `cockpit.submitMission`.
- `handleUseFootprintSuggestion` n'appelle **jamais** `form.submit()`.
- `handleUseFootprintSuggestion` n'appelle **jamais** `fetch`.
- `handleUseFootprintSuggestion` n'appelle **jamais** une API.
- `PierreCockpitShell` et `PierreCommandCenter` **ne sont pas modifiés**.
- Le submit existant (Enter ou bouton Envoyer) reste 100% sous contrôle de l'utilisateur.

---

## Comportement NoAccessGate

- Les suggestions sont affichées en lecture seule dans le panel `NoAccessGate`.
- Pas de bouton "Utiliser" car il n'y a pas de cockpit actif → `onUseSuggestion` n'est pas passé.
- L'utilisateur voit les prompts mais ne peut pas préremplir un composer inexistant.

---

## Confirmation UI

Après clic sur "Utiliser" :

```
✓ Suggestion ajoutée au composer — relisez puis envoyez manuellement.
  — Préremplit uniquement le composer · Relisez puis envoyez manuellement · Aucune action exécutée
```

Affichée pendant 4 secondes dans le strip, puis disparaît automatiquement.

---

## QA Module (`enterprise-footprint-pierre-prefill-qa.ts`)

15 étapes :

1. `suggestion_plan_only_available`
2. `prefill_payload_builds`
3. `prefill_payload_validates`
4. `prompt_sanitized`
5. `disabled_suggestion_not_prefilled`
6. `composer_setter_available`
7. `prefill_button_visible`
8. `prefill_sets_input_only`
9. `no_auto_submit`
10. `no_api_call`
11. `no_db_write`
12. `no_pierre_engine_import`
13. `confirmation_visible`
14. `existing_submit_preserved`
15. `rollback_no_footprint_safe`

---

## Ce qui est activé maintenant

✅ Boutons "Utiliser" sur les suggestions plan-only non-disabled (cockpit actif).  
✅ `cockpit.setInputDraft(prompt)` appelé uniquement — jamais `submitMission`.  
✅ Validation + sanitisation du payload avant préremplissage.  
✅ Patterns interdits bloqués (clés API, phrases interdites).  
✅ Confirmation "Suggestion ajoutée au composer" visible 4 secondes.  
✅ Microcopy : "Préremplit uniquement le composer. Aucun envoi automatique."  
✅ Suggestions disabled → bouton absent (pas de préremplissage).  
✅ `PierreCockpitShell` et `PierreCommandCenter` non modifiés.  
✅ NoAccessGate : suggestions en lecture seule, pas de bouton "Utiliser".  
✅ Guard SSR. Aucun Supabase. Aucun DB write. Aucun import `src/lib/pierre`.

---

## Ce qui reste non activé

- Persistance du prompt prérempli entre sessions.
- Historique des suggestions utilisées.
- Suggestions contextualisées en temps réel selon la conversation en cours.

---

## Ce qui n'a PAS été fait en PHASE 3.12

- Modification du moteur Pierre (`src/lib/pierre/**` — intact).
- Modification des API Pierre (`src/app/api/pierre/**` — intactes).
- Modification de `PierreCockpitShell` ou `PierreCommandCenter`.
- Modification de `usePierreCockpit` (le hook reste intact, on utilise `setInputDraft` déjà exposé).
- Auto-submit depuis les suggestions.
- Appel réseau.
- DB write.

**Lancement public externe : toujours non validé.**

---

## Tests

Script : `npm run test:phase3-12`

Assertions couvrant :
- Existence et contenu du module prefill
- Tests fonctionnels (validation, sanitisation, payload, confirmation)
- QA module (15 étapes)
- Intégration page `/agents/pierre/use`
- Exports index
- Documentation
- Régression PHASE 3.11

---

## Prochain bloc recommandé

**PHASE 3.13 — Enterprise Footprint Server Persistence Design**

Concevoir et implémenter le schéma de persistance serveur de l'Empreinte Entreprise :
- table SQL `enterprise_footprints` (design + migration) ;
- API route `POST /api/profile/enterprise-footprint` ;
- synchronisation localStorage ↔ serveur ;
- RLS appropriée ;
- flag d'activation progressif.

Alternatives possibles :
- PHASE 3.13 — Pierre Use Footprint Prefill Manual QA
- PHASE 3.13 — CloneOS History Manual Activation QA
