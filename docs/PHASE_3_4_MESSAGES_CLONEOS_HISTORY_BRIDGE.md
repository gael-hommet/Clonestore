# PHASE 3.4 — Messages CloneOS History Bridge

> Généré le : 2026-06-04
> Base : PHASE 3.1 → 3.3 validées. Moteur Pierre intact.
> Public launch : NO-GO externe.

---

## 1. Objectif PHASE 3.4

Brancher réellement le bridge CloneOS History dans `/profile/messages` en lecture seule.

**Objectifs :**
- `/profile/messages` charge Pierre data (PHASE 3.1) + CloneOS History (PHASE 3.4) en read-only.
- Les commandes CloneOS soumises par l'utilisateur dans `/profile/agents` apparaissent dans la messagerie.
- Les commandes normales → onglet **Suivis**.
- Les commandes bloquées/refusées/requérant validation → onglet **Alertes**.
- Garder les 4 onglets exacts : Suivis / Briefings / Livraisons / Alertes.
- Fallback démo si aucune donnée réelle disponible.
- **Jamais d'écriture en DB depuis `/profile/messages`.**

---

## 2. État avant PHASE 3.4

**PHASE 3.3** avait créé :
- `src/lib/clonestore/messages/message-center-cloneos-history-bridge.ts`
- `loadCloneOSHistoryMessageItemsReadOnly()` — charge CloneOS history en read-only
- `mergePierreAndCloneOSMessageItems()` — fusionne Pierre + CloneOS

Mais `loadMessageCenterReadOnlyItems` dans `message-center-readonly-client.ts` ne l'appelait pas encore.

---

## 3. Ce qui est branché maintenant

### `message-center-readonly-client.ts` (mis à jour)

La fonction `loadMessageCenterReadOnlyItems` appelle maintenant :
1. `loadPierreMessageCenterRows` — tables pierre_* (PHASE 3.1)
2. `loadCloneOSHistoryMessageItemsReadOnly` — table clonestore_cloneos_history (PHASE 3.4)
3. `mergePierreAndCloneOSMessageItems` — fusion + dédoublonnage

### `/profile/messages/page.tsx` (mis à jour)

Ajout de :
- Import `hasCloneOSHistoryMessageItems`, `countCloneOSHistoryMessageItems`
- Badge discret "CloneOS History connecté — N commandes — lecture seule" si données présentes

### `message-center-validation.ts` (mis à jour)

Ajout de :
- `countCloneOSHistoryMessageItems(items)` — compte les items source "cloneos"
- `hasCloneOSHistoryMessageItems(items)` — vérifie la présence
- `assertMessageCenterNoWriteActions(items)` — vérifie aucune action d'écriture

---

## 4. Flux de chargement

```
loadMessageCenterReadOnlyItems(supabase, userId)
  │
  ├─ Pierre read-only ─────────────────────────────────────────────
  │    pierre_missions → Suivis (ou Alertes si blocked)
  │    pierre_tasks → Suivis (ou Alertes si blocked/requires_validation)
  │    pierre_documents → Livraisons (ou Alertes si bloqué)
  │    pierre_outbound_emails → Livraisons (ou Alertes si bloqué)
  │
  ├─ CloneOS History read-only (best-effort, silencieux si absent) ─
  │    clonestore_cloneos_history → mapHistoryItemToMessageCenterItem
  │    source = "cloneos", read_only = true
  │
  ├─ Fusion ────────────────────────────────────────────────────────
  │    mergePierreAndCloneOSMessageItems
  │    dédoublonnage par id
  │    tri par date décroissante + priorité
  │
  └─ Résultat ──────────────────────────────────────────────────────
       mode = "real_readonly" si des items existent
       mode = "demo_fallback" si vide
       mode = "auth_required" si non connecté
       mode = "error" si erreur Pierre
```

---

## 5. Mapping vers Suivis

| Source | Condition | Onglet |
|--------|-----------|--------|
| `pierre_missions` | status normal | **Suivis** |
| `pierre_tasks` | status normal | **Suivis** |
| CloneOS History | domain hr, status normal, plan préparé | **Suivis** |
| CloneOS History | `source = "cloneos"`, plan-only | **Suivis** |

---

## 6. Mapping vers Alertes

| Source | Condition | Onglet |
|--------|-----------|--------|
| `pierre_missions` | status blocked/failed/refused | **Alertes** |
| `pierre_tasks` | status blocked/requires_validation | **Alertes** |
| CloneOS History | `blocked = true` | **Alertes** |
| CloneOS History | `refused = true` | **Alertes** |
| CloneOS History | `human_validation_required = true` | **Alertes** |
| CloneOS History | `status = requires_validation` | **Alertes** |
| CloneOS History | `risk_level = critical` | **Alertes** |

---

## 7. Comportement si table CloneOS absente

La table `clonestore_cloneos_history` peut ne pas encore exister (SQL draft non appliqué).

- La fonction `loadCloneOSHistoryMessageItemsReadOnly` attrape silencieusement l'erreur "table non trouvée".
- Aucune erreur UI.
- Les items Pierre restent affichés normalement.
- Mode `real_readonly` si Pierre data disponible.

---

## 8. Comportement si flag false

Si `NEXT_PUBLIC_CLONEOS_HISTORY_SERVER_PERSISTENCE_ENABLED=false` (default) :
- Aucune écriture DB depuis `/profile/agents`.
- La table `clonestore_cloneos_history` peut être vide.
- `loadCloneOSHistoryMessageItemsReadOnly` retourne `[]` silencieusement.
- `/profile/messages` affiche Pierre data uniquement.
- Pas d'erreur UI.

Même si le flag est `true` et la table existe, `/profile/messages` reste **toujours en lecture seule**.

---

## 9. Garde-fous no write / no execution

- `loadMessageCenterReadOnlyItems` : **aucun** `insert / update / delete / upsert`.
- `loadCloneOSHistoryMessageItemsReadOnly` : **read-only** — `loadCloneOSHistoryReadOnly` avec `fallbackToLocalStorage: false`.
- Aucun appel à `persistCloneOSHistoryWithFallback` depuis `/profile/messages`.
- Aucun appel à `persistCloneOSHistoryItemSafely` depuis `/profile/messages`.
- `assertMessageCenterNoWriteActions` vérifie `read_only: true` sur tous les items CloneOS.
- `detectUnsafeMessageCenterWording` détecte les wordings d'exécution interdits.

---

## 10. Ce qui n'a PAS été fait

- Aucune écriture en DB depuis `/profile/messages`.
- Moteur Pierre intact (`src/lib/pierre/**` non modifié).
- APIs Pierre intactes (`src/app/api/pierre/**` non modifié).
- Aucune migration SQL appliquée automatiquement.
- Aucun appel OpenAI, Anthropic, Stripe live.
- Aucun email envoyé, document généré, mission exécutée.
- CloneVoice reste non-production.
- Emma, Lucas, Sophie restent non activées.
- Public launch reste NO-GO externe.

---

## 11. Prochain bloc recommandé

**PHASE 3.5 — CloneOS History Manual Activation QA**

Vérification complète après activation manuelle du SQL draft par Gael :
1. Appliquer `supabase/sql/PHASE_3_2_CLONEOS_HISTORY.sql`.
2. Activer `NEXT_PUBLIC_CLONEOS_HISTORY_SERVER_PERSISTENCE_ENABLED=true`.
3. Vérifier E2E : soumettre commande → apparaît dans `/profile/messages` Suivis/Alertes.
4. Vérifier RLS : aucune donnée cross-user.
5. Vérifier performance : chargement < 500ms.

Ou si priorité différente :
**PHASE 3.5 — Global Onboarding Persistence Draft** — persister les données CloneADN du wizard onboarding.

---

*PHASE 3.4 — Messages CloneOS History Bridge — Implémentée.*
*Moteur Pierre intact. APIs intactes. Aucune migration appliquée.*
*Lecture seule — aucune action exécutée depuis la messagerie.*
