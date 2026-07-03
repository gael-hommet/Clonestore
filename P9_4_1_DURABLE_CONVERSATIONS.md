# P9.4.1 — Durable multi-device conversations

**Avant (P9.4)** : `localStorage` mono-navigateur (clé `clonestore.clonechat.thread.v1`),
40 messages, perdu au vidage/autre appareil/restart. Les fichiers `continuity.ts` /
`thread-storage.ts` annoncés n'existaient pas. **Après (P9.4.1)** : vérité SERVEUR
(Postgres), reprise multi-device, survit au restart de l'application.

## Schéma (`supabase/migrations-p941/2026-07-07__p941_clonechat_durable.sql`)
- `clonechat_conversations (id, company_id, user_id, title, rolling_summary, timestamps, archived_at)`
- `clonechat_messages (id, conversation_id, company_id, user_id, seq, role, content jsonb, source_ids, action_proposal, action_result, usage, image_meta, created_at)`
- **RLS** : `company_id::text = current_setting('app.current_company', true)` + `force row level security`. Le client pg **assume le rôle `clonechat_app`** (un superuser bypasserait la RLS) et pose le GUC tenant par transaction (`durable/pg.ts`).

## Sûreté du contenu (`conversations/types.ts` `sanitizeContentForStorage`)
Jamais de base64/data-URL ni de clé/secret persistés — seulement des blocs riches +
`image_meta` (mime/octets/hash). Prouvé : `clonechat-durable.itest.ts` (« l'image brute
n'est jamais persistée »).

## Routes (`src/app/api/assistant/conversations/**`)
`GET /conversations` (liste), `POST /conversations` (créer), `GET /conversations/[id]`
(historique paginé), `PATCH` (renommer/archiver), `DELETE`. Auth serveur + isolation.
La route `POST /chat` accepte `conversation_id` et persiste user + assistant.

## UI (`useCloneChat.ts` + `CloneChatWorkspace.tsx`)
Au montage (connecté) : reprise de la conversation la plus récente depuis le SERVEUR
(localStorage n'est plus qu'un cache offline). Boutons « Nouvelle », historique (chips),
suppression. `newConversation/openConversation/deleteConversation`.

## Honnêteté — persistance best-effort par tour
La persistance du message dans la route `chat` est **best-effort au niveau du tour** : une
erreur DB transitoire est capturée pour **ne pas casser la réponse à l'utilisateur** (le
tour aboutit quand même). La source de vérité reste le store durable ; en cas d'échec DB
transitoire, un message individuel peut ne pas être écrit — c'est un compromis assumé
(disponibilité du tour > garantie d'écriture par message). Les opérations de conversation
explicites (create/list/get/delete) ne sont PAS best-effort et remontent leurs erreurs.

## Preuves
- Repo : `clonechat-durable.itest.ts` — CRUD + isolation tenant A/B + **survie au restart** du serveur PG.
- Full-stack HTTP : `multi-device-continuity.json` — `durable:true`, device B (session indépendante) voit la conversation + 4 messages ; `restart-proof-http.json` — après **restart du dev server** (Postgres resté vivant), conversation + messages toujours présents.
