# PHASE 3.2 — CloneOS History Server Persistence Design

> Généré le : 2026-06-04
> Base : PHASE 2.1 → 2.9, PHASE 3.1 validées. Moteur Pierre intact.
> Public launch : NO-GO externe.

---

## 1. Objectif PHASE 3.2

Concevoir et préparer la persistence serveur pour l'historique CloneOS, actuellement stocké uniquement en localStorage.

**Objectifs précis :**
- Formaliser le modèle `CloneOSHistoryItem` (forme persistable, compacte, sécurisée).
- Définir le schéma SQL de la table `clonestore_cloneos_history`.
- Créer les types, mappers, validations et couches read/write.
- Créer une abstraction localStorage centralisée (plus de logique inline dans les pages).
- Préparer l'intégration future avec `/profile/messages`.
- **Ne pas activer l'écriture DB dans l'UI — PHASE 3.3.**
- **Ne pas appliquer la migration automatiquement.**

---

## 2. État actuel localStorage

**Avant PHASE 3.2** :
- `cloneOSHistory` est stocké dans `localStorage` sous la clé `clonestore.cloneos.commandHistory.v1`.
- Logique de lecture/écriture inline dans `/profile/agents/page.tsx` (PHASE 2.4).
- Max 20 items. Dédoublonnage par `command_id`.
- Données perdues si l'utilisateur change de navigateur/device.
- `/profile/messages` ne peut pas lire cet historique.

**Après PHASE 3.2** :
- Clé localStorage exportée depuis `cloneos-history/cloneos-history-localstorage.ts` (source de vérité unique).
- `/profile/agents/page.tsx` importe `CLONEOS_HISTORY_LOCALSTORAGE_KEY` au lieu de la définir inline.
- Schéma SQL draft créé dans `supabase/sql/PHASE_3_2_CLONEOS_HISTORY.sql`.
- Couche readonly client prête pour PHASE 3.3.
- Écriture DB conçue mais non activée.

---

## 3. Pourquoi persister côté serveur

| Problème localStorage | Solution server persistence |
|----------------------|----------------------------|
| Perdu si changement navigateur/device | Disponible sur tous les devices |
| Non accessible par `/profile/messages` | Intégrable dans les 4 onglets messages |
| Non synchronisé entre onglets | Synchronisé via Supabase |
| Limité à 20 items | Limitable à 100 avec index |
| Pas d'audit trail cross-session | Audit trail immuable (pas de delete) |

---

## 4. Modèle CloneOSHistoryItem

```typescript
type CloneOSHistoryItem = {
  id: string;
  command_id: string;                // clé unique
  user_id?: string;                  // optionnel en localStorage
  company_id: string;
  raw_request_summary: string;       // ≤ 280 chars — jamais prompt complet
  domain: CloneOSHistoryDomain;
  intent: string;
  status: CloneOSHistoryStatus;
  risk_level: CloneOSHistoryRiskLevel;
  employee_slug?: string;
  employee_display_name?: string;
  mission_title?: string;
  mission_summary?: string;
  task_count: number;
  guard_decision?: string;
  human_validation_required: boolean;
  blocked: boolean;
  refused: boolean;
  trace_event_count: number;
  next_action?: string;
  source: "localstorage" | "server" | "imported";
  created_at: string;
  updated_at: string;
  read_only: true;                   // invariant absolu
  metadata: Record<string, unknown>; // toujours redacted
};
```

**Contraintes clés :**
- `raw_request_summary` ≤ 280 chars (recommandé) / 500 chars (max DB)
- `read_only: true` **invariant absolu** — jamais false
- `metadata` **toujours redacted** avant persistence

---

## 5. Mapping CloneOSCommandCenterResult → CloneOSHistoryItem

La fonction `mapCloneOSResultToHistoryItem(result, options)` :
1. Extrait `classified_command.summary` comme `raw_request_summary` (tronqué à 280 chars).
2. Mappe `classified_command.domain`, `intent`, `risk_level`.
3. Résume `mission_plan` : title + task_count (pas les tâches complètes).
4. Résume `guard_result` : overall_decision + flags boolean.
5. Résume `trace_result` : event_count uniquement.
6. Redacte `metadata` (secrets potentiels).

---

## 6. Mapping CloneOSHistoryItem → MessageCenterItem

La fonction `mapHistoryItemToMessageCenterItem(item)` :

| Condition | Onglet cible |
|-----------|-------------|
| `blocked` ou `refused` ou `human_validation_required` | **Alertes** |
| `status = requires_validation` | **Alertes** |
| `domain = hr` + statut normal | **Suivis** |
| Autre domaine | **Suivis** |
| Futur : expected_outputs = document | **Livraisons** |
| Futur : brief-like | **Briefings** |

---

## 7. Sécurité / Redaction

### Clés redactées dans metadata

```
password, token, secret, api_key, authorization,
stripe, supabase, openai, anthropic, private_key,
webhook_secret, sk_live_, whsec_, OPENAI_API_KEY,
ANTHROPIC_API_KEY, bearer
```

### Validation (21 règles V01 → V21)

- V01: command_id non vide
- V07: raw_request_summary ≤ 500 chars
- V10: pas de sk_live_
- V11: pas de whsec_
- V12: pas de OPENAI_API_KEY
- V13: pas de ANTHROPIC_API_KEY
- V15: pas de "public launch go"
- V16: pas de "zéro erreur"
- V17: pas de "conformité garantie"
- V18: pas de "CloneVoice actif production"
- V19–V21: pas de fausses exécutions

---

## 8. Schéma SQL proposé

Table : `clonestore_cloneos_history`

```sql
create table if not exists public.clonestore_cloneos_history (
  id                         uuid        primary key default gen_random_uuid(),
  user_id                    uuid        not null references auth.users(id),
  company_id                 text        not null,
  command_id                 text        not null,
  employee_slug              text,
  domain                     text        not null,
  intent                     text        not null,
  status                     text        not null,
  risk_level                 text        not null,
  raw_request_summary        text        not null,  -- ≤ 500 chars
  mission_title              text,
  task_count                 integer     not null default 0,
  guard_decision             text,
  human_validation_required  boolean     not null default false,
  blocked                    boolean     not null default false,
  refused                    boolean     not null default false,
  trace_event_count          integer     not null default 0,
  metadata                   jsonb       not null default '{}',
  created_at                 timestamptz not null default now(),
  unique (user_id, command_id)
);
```

Fichier SQL draft : `supabase/sql/PHASE_3_2_CLONEOS_HISTORY.sql`

---

## 9. RLS proposée

```sql
-- RLS activée
alter table public.clonestore_cloneos_history enable row level security;

-- SELECT : uniquement ses propres commandes
create policy "cloneos_history_select_own"
  using (auth.uid() = user_id);

-- INSERT : uniquement ses propres commandes
create policy "cloneos_history_insert_own"
  with check (auth.uid() = user_id);

-- UPDATE : désactivé (audit trail immuable)
-- DELETE : désactivé (audit trail immuable)
```

---

## 10. Pourquoi migration non appliquée automatiquement

La migration **ne doit pas être appliquée automatiquement** pour les raisons suivantes :

1. **Validation RLS en environnement réel** : les politiques doivent être testées avec de vrais utilisateurs avant d'être appliquées en production.
2. **Test E2E obligatoire** : vérifier que l'insert respecte bien `user_id = auth.uid()` et que les données cross-user sont impossibles.
3. **Décision humaine** : le fondateur doit valider la migration manuellement (cohérence avec le process GO-LIVE).
4. **Pas de régression sur les tables existantes** : la migration est additive (nouvelle table) mais doit être vérifiée indépendamment.
5. **Protection PHASE 3.2** : la couche write est conçue mais le flag `CLONEOS_HISTORY_SERVER_PERSISTENCE_ENABLED = false` empêche toute écriture DB non souhaitée.

---

## 11. Ce qui est activé maintenant (PHASE 3.2)

| Composant | Statut |
|-----------|--------|
| Types `CloneOSHistoryItem` | ✅ Disponible |
| Mappers `CloneOSResult → HistoryItem` | ✅ Disponible |
| Mapper `HistoryItem → MessageCenterItem` | ✅ Disponible |
| Validation 21 règles | ✅ Disponible |
| localStorage abstraction centralisée | ✅ Disponible |
| `CLONEOS_HISTORY_LOCALSTORAGE_KEY` importée dans agents/page.tsx | ✅ Activé |
| Readonly client (fallback localStorage) | ✅ Disponible |
| Schéma SQL draft | ✅ Créé |
| RLS design | ✅ Documenté |

---

## 12. Ce qui reste pour PHASE 3.3

| Étape | Prérequis |
|-------|----------|
| Appliquer `supabase/sql/PHASE_3_2_CLONEOS_HISTORY.sql` | Validation humaine |
| Tester RLS en environnement de test | Migration appliquée |
| Passer `CLONEOS_HISTORY_SERVER_PERSISTENCE_ENABLED = true` | RLS validée |
| Brancher `persistCloneOSHistoryItemSafely` dans `runCloneOSCommand()` | Flag activé |
| Lire depuis `/profile/messages` via `mapHistoryItemToMessageCenterItem` | Persistence active |

---

## 13. Ce qui n'a PAS été fait

- Aucune migration appliquée.
- Aucune écriture DB depuis l'UI (agents page, messages page).
- Aucune modification du moteur Pierre.
- Aucune API route créée.
- Aucune modification des APIs existantes.
- Aucune modification de la RLS existante.
- Aucun appel OpenAI, Anthropic, Stripe live.
- Aucun email envoyé.
- Aucun document généré.
- Aucune mission exécutée.
- Emma, Lucas, Sophie restent non activées.
- CloneVoice reste non-production.

---

## 14. Prochain bloc recommandé

**PHASE 3.3 — Apply CloneOS History Persistence Safely**

Étapes :
1. Appliquer le SQL draft après validation humaine.
2. Tester les politiques RLS avec un vrai client Supabase.
3. Activer `CLONEOS_HISTORY_SERVER_PERSISTENCE_ENABLED = true`.
4. Brancher la persistence dans `runCloneOSCommand()`.
5. Intégrer l'historique server dans `/profile/messages` via `loadCloneOSHistoryReadOnly`.

Alternative : **PHASE 3.3 — Global Onboarding Persistence Draft** si la priorité est la persistence de l'onboarding CloneADN.

---

*PHASE 3.2 — CloneOS History Server Persistence Design — Implémentée.*
*Moteur Pierre intact. APIs intactes. Aucune migration appliquée.*
*localStorage reste le fallback actif. Server persistence : PHASE 3.3.*
