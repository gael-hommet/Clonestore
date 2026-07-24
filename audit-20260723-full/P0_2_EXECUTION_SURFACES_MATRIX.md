# P0.2 — Matrice des surfaces d'exécution (avant / après)

## `/api/pierre/action` (`src/app/api/pierre/action/route.ts`)

| Action | Auth (avant/après) | Tenant | Entitlement | CloneGuard | Gouvernance | Approbation | Idempotence | Trace | Provider | Effet | Statut final |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `email.send` | Bearer Supabase réel (inchangé) — `getAuthenticatedUser` L309-329 | `user.id` réel (inchangé) — pas de changement, déjà correct | `hasPierreAccess` sur `orders` (inchangé, déjà correct) — L331-353 | **AVANT : absent (0 réf.)** → **APRÈS : `evaluateLegacyExecuteGovernance`, réutilisé de P0.1** | idem | **AVANT : aucune** → **APRÈS : DENY systématique (floor CloneGuard non-contournable)** | **AVANT : absente** (aucun `request_id` client, génération serveur à chaque appel) → **APRÈS : ajoutée** (`request_id` optionnel + vérification `agent_history`) | `agent_history` (préexistant, conservé) + résumé de gouvernance ajouté au log | **AVANT : Make.com direct, atteignable** → **APRÈS : jamais atteint (DENY avant résolution du webhook)** | **AVANT : email réel envoyé** → **APRÈS : aucun** | **FERMÉ — DENY prouvé par test** |
| `doc.generate` | idem | idem | idem | **AVANT : absent** → **APRÈS : `evaluateLegacyExecuteGovernance`** | idem | **AVANT : aucune** → **APRÈS : REQUIRE_APPROVAL en pratique** (CloneTrust "supervised" faute de contexte de confiance réel, même constat qu'en P0.1) | **AVANT : absente** → **APRÈS : ajoutée** | idem | **AVANT : Make.com direct** → **APRÈS : jamais atteint en pratique** | **AVANT : document publié via Make** → **APRÈS : aucun (mis en attente d'approbation)** | **FERMÉ — REQUIRE_APPROVAL prouvé par test** |

**Note produit** : si cette route sert réellement une fonctionnalité self-service (un utilisateur authentifié demande son propre document), ce correctif la bloque désormais systématiquement en l'absence de tout mécanisme d'approbation existant pour ce chemin — c'est un compromis délibéré, pas un oubli (voir P0_2_REMAINING_EXECUTION_RISKS.md, RISQUE-3).

## `/api/router` (`src/app/api/router/route.ts`)

| Élément | Avant | Après |
|---|---|---|
| Méthodes | `POST` (traitement complet) | `POST`/`GET` → **410 Gone inconditionnel** |
| Auth | Token opaque comparé via `.eq()` contre `api_tokens` (table hors migrations suivies) | **Supprimée** — plus aucune lecture DB |
| Tenant | `client_id` résolu depuis le token | **Supprimé** |
| Entitlement | `agents_owned` (`client_id`+`agent_name`) | **Supprimé** |
| CloneGuard/Gouvernance | Absent | **Sans objet — plus aucun chemin d'exécution** |
| Provider | `fetch(MAKE_WEBHOOK_URL)` — URL codée en dur en clair dans le source | **Supprimé du code**, URL retirée entièrement |
| Effet | N'importe quel payload pour n'importe quel "agent" forwardé tel quel | **Aucun — réponse statique 410, aucune branche d'exécution possible** |
| Statut final | — | **FERMÉ (Option A, neutralisation), prouvé par test — 0 appel réseau possible par construction** |

## Actions non-Pierre (cas particulier `/api/router`)

Le routeur n'a jamais été strictement mono-agent dans son code (`agent: string` générique), mais confirmé sans aucun appelant réel (voir P0_2_CALLER_INVENTORY.md) — sa neutralisation ne "casse" donc aucun flux non-Pierre actif : il n'y avait aucun flux actif du tout, Pierre ou non. Aucune séparation Pierre/non-Pierre n'a été nécessaire.
