# PHASE 3.1 — Messages Real Data Read-Only Hook

> Généré le : 2026-06-03
> Base : PHASE 2.1 → 2.9 validées. TECH-01 → TECH-11 validés. Moteur Pierre intact.
> Public launch : NO-GO externe.

---

## 1. Objectif PHASE 3.1

Brancher `/profile/messages` à de vraies données existantes en lecture seule, sans remplacer toute l'UI.

**Objectifs précis :**
- Conserver les 4 onglets PHASE 2.5 (Suivis / Briefings / Livraisons / Alertes).
- Ajouter une couche de lecture réelle read-only via Supabase.
- Récupérer les données existantes liées à Pierre depuis les tables pierre_*.
- Transformer ces données en `MessageCenterItem`.
- Conserver un fallback démo structuré si aucune donnée réelle n'est disponible.
- Afficher clairement la source : données réelles vs démo locale.
- **Jamais écrire en DB. Jamais exécuter une action. Jamais modifier Pierre moteur.**

---

## 2. Pourquoi read-only

**PHASE 3.1 = lecture uniquement.** Les raisons sont multiples :

1. **Pierre moteur intact** : toute écriture doit passer par le moteur Pierre (`/api/pierre/**`), pas par le frontend direct.
2. **Gouvernance CloneGuard** : les actions sensibles (documents, emails, missions) exigent une validation humaine — jamais depuis la messagerie.
3. **Supabase avec RLS** : le client anon respecte les politiques RLS. Seules les données de l'utilisateur connecté sont visibles.
4. **Progressif** : PHASE 3.1 = lecture. PHASE 3.2+ = persistence d'autres couches si nécessaire.

---

## 3. Tables lues

| Table | Onglet cible | Colonnes sélectionnées |
|-------|-------------|----------------------|
| `pierre_missions` | Suivis (ou Alertes si bloqué/failed) | `id, title, request_text, summary, status, created_at, updated_at` |
| `pierre_tasks` | Suivis (ou Alertes si bloqué/requires_validation) | `id, mission_id, title, type, status, created_at, updated_at` |
| `pierre_documents` | Livraisons (ou Alertes si bloqué) | `id, mission_id, task_id, title, type, status, created_at, updated_at` |
| `pierre_outbound_emails` | Livraisons (ou Alertes si bloqué/failed) | `id, mission_id, task_id, subject, status, created_at, updated_at` |

**Tables non lues dans PHASE 3.1 :**
- `pierre_task_logs` : optionnelle, mapper créé mais query non activée
- `agent_runs` : table non confirmée dans le schéma actuel
- `pierre_company_memory` : hors scope messagerie
- `orders` : déjà lu pour les noms d'employés (existant PHASE 2.5)

---

## 4. Filtres user_id + agent_slug

**Filtre user_id :**
```typescript
.eq("user_id", userId)
```
Ce filtre est appliqué explicitement **et** RLS l'applique automatiquement côté Supabase. Double sécurité.

**Filtre agent_slug :**
Les tables `pierre_missions`, `pierre_tasks`, `pierre_documents`, `pierre_outbound_emails` sont Pierre-spécifiques par leur nommage. Pas de colonne `agent_slug` dans ces tables — le scope Pierre est implicite.

Pour une future table générique (`agent_runs`), le filtre `.eq("agent_slug", "pierre")` sera appliqué.

---

## 5. Mapping vers 4 onglets

| Source DB | Onglet par défaut | Condition basculement Alertes |
|-----------|------------------|-------------------------------|
| `pierre_missions` | Suivis | status = blocked / failed / error / refused |
| `pierre_tasks` | Suivis | status = blocked / requires_validation |
| `pierre_documents` | Livraisons | status = blocked / refused / requires_validation |
| `pierre_outbound_emails` | Livraisons | status = blocked / failed |
| *(CloneBrief local)* | Briefings | Données démo — non persistées |
| Alertes Guard | Alertes | Tous les blocked / requires_validation / refused |

---

## 6. Fallback démo/local

**3 conditions de fallback :**

| Condition | Mode | Message badge |
|-----------|------|---------------|
| Supabase non configuré | `demo_fallback` | "Démo locale — aucune donnée réelle chargée" |
| Non connecté | `auth_required` | "Connexion requise pour charger vos données" |
| Tables vides (aucun item réel) | `demo_fallback` | "Démo locale — aucune donnée réelle chargée" |
| Erreur query | `error` | "Aperçu démo — données réelles non disponibles" |
| Données réelles disponibles | `real_readonly` | "Données réelles — lecture seule" |

Le fallback utilise `buildDemoMessageCenterItems()` — données structurées honnêtes issues de PHASE 2.5 avec `is_real_data: false`.

---

## 7. États UI

```
Chargement → dataMode = "demo_fallback" (initial)
             ↓
Auth check  → si non connecté : "auth_required"
             ↓
Real data load → si données : "real_readonly"
                → si vide   : "demo_fallback"
                → si erreur : "error"
```

**Badge visible en permanence :**
- Mode `real_readonly` → badge vert "Données réelles — lecture seule"
- Mode `demo_fallback` → badge neutre "Démo locale — aucune donnée réelle chargée"
- Mode `auth_required` → badge bleu "Connexion requise pour charger vos données"
- Mode `error` → badge orange "Aperçu démo — données réelles non disponibles"

---

## 8. Garde-fous no write / no execution

### Côté code

Le module `message-center-readonly-client.ts` ne contient **aucune** de ces méthodes :
- `insert(` — interdit
- `update(` — interdit
- `delete(` — interdit
- `upsert(` — interdit
- `service_role` — interdit

Les actions dans la messagerie restent `read_only: true` — les boutons désactivés via `pointer-events-none opacity-50`.

### Côté données

Les items réels ont `read_only: true` **invariant absolu**.

La validation `assertMessageCenterReadOnly()` vérifie que tous les items réels ont `read_only: true`.

### Côté wording

`detectUnsafeMessageCenterWording()` détecte les phrases interdites :
- "public launch go"
- "zéro erreur" / "zero erreur"
- "conformité garantie"
- "clonevoice actif production"
- "mission exécutée avec succès"
- "document généré avec succès"
- "email envoyé avec succès"

---

## 9. Ce qui n'a PAS été fait

- Aucune écriture en DB — ni insert, ni update, ni delete, ni upsert.
- Aucun appel à Pierre moteur (`src/lib/pierre/**` intact).
- Aucune modification des APIs `src/app/api/pierre/**`.
- Aucune modification des politiques RLS.
- Aucun appel OpenAI, Anthropic, Stripe live.
- Aucun email envoyé.
- Aucun document réellement généré.
- Aucune mission exécutée.
- Aucune persistence de l'onboarding ou du cloneOSHistory en DB.
- Aucun go-live proof auto-validé.
- Aucun flag public launch modifié.
- Les 4 onglets (Suivis / Briefings / Livraisons / Alertes) sont conservés exactement.
- Emma, Lucas, Sophie ne sont pas activés.
- CloneVoice reste non-production.

---

## 10. Architecture de la couche messages

```
src/lib/clonestore/messages/
├── message-center-types.ts        Types partagés (tabs, statuts, modes, item)
├── message-center-demo-data.ts    Données de démonstration structurées
├── message-center-mappers.ts      DB row → MessageCenterItem
├── message-center-readonly-client.ts  Chargement Supabase read-only
├── message-center-validation.ts   Validation items + wording interdit
└── index.ts                       Exports publics
```

---

## 11. Prochain bloc recommandé

**PHASE 3.2 — CloneOS History Server Persistence Design**

Pourquoi ce choix :
- `cloneOSHistory` est actuellement en localStorage uniquement.
- PHASE 3.2 concevrait (et potentiellement implémenterait) la persistence server-side de l'historique CloneOS, permettant à la messagerie de charger aussi l'historique des commandes CloneOS depuis la DB.
- Cela enrichirait naturellement les onglets Suivis et Alertes avec les vraies commandes soumises.
- Alternative possible : **PHASE 3.2 — Global Onboarding Persistence Draft** si la priorité est de persister les données d'onboarding.

---

*PHASE 3.1 — Messages Real Data Read-Only Hook — Implémentée.*
*Moteur Pierre intact. APIs intactes. DB read-only uniquement.*
*Lecture seule — aucune action exécutée depuis la messagerie.*
