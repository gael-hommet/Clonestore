# C1.6 — CloneChat universel / porte d'entrée zéro

> ## Verdict : **C1.6 — PARTIAL / ENTRY GATE OR REPOSITORY BLOCKER REMAINS**
>
> **La porte d'entrée est supprimée et prouvée en navigateur incognito réel.** Le verdict reste
> `PARTIAL` **non pas à cause de CloneChat**, mais parce que **deux fichiers étrangers**
> (chantier partner/Stripe) contiennent encore des **marqueurs de conflit non résolus** : le
> dépôt ne peut donc être déclaré ni globalement typé, ni constructible. Je n'y ai pas touché.

Preuves : [.c1-6-proofs/](.c1-6-proofs/) · QA navigateur : [browser-qa.json](.c1-6-proofs/browser-qa.json)

---

## 1. Pourquoi CloneChat était-il encore verrouillé ?

Deux portes, dont une invisible.

**Porte 1 — l'API refusait la parole.** `/api/assistant/chat` renvoyait **401 `AUTH_REQUIRED`** à
tout visiteur anonyme. Reproduit avant correction :

```
POST /api/assistant/chat   (aucun cookie)
→ HTTP 401  {"ok":false,"code":"AUTH_REQUIRED","error":"Connexion requise."}
```

**Porte 2 — le client répondait avec un AUTRE assistant.** Le hook faisait répondre les visiteurs
publics par un **moteur déterministe LOCAL** (`runCloneChatTurn`) : la requête **n'atteignait
jamais le serveur**. Ce n'était pas « CloneChat en mode réduit » — c'était **un second assistant**,
avec une autre personnalité et une autre qualité de réponse. C'était la porte la plus sournoise :
invisible dans les logs, invisible dans les tests d'API.

La doctrine de C1.3/C1.4/C1.5 traitait l'authentification, l'entreprise et le droit Pierre comme
des **conditions pour parler**. C1.6 les rétrograde à ce qu'elles sont : des **conditions pour
agir**.

> **LA CONVERSATION EST UN DROIT. LE CONTEXTE PRIVÉ ET L'ACTION SONT DES PRIVILÈGES.**

---

## 2. Portes supprimées

| Porte | Avant | Après |
|---|---|---|
| `AUTH_REQUIRED` (401) sur le chat | bloquait toute conversation anonyme | **supprimée** — 0 occurrence dans la route |
| Second assistant local (`runCloneChatTurn`) | répondait à la place du serveur | **supprimé** — 0 appel dans le client |
| Blocage « Aucune entreprise active » | à l'entrée | **supprimé** — devient un prérequis d'ACTION |
| Blocage « droit Pierre requis » | à l'entrée | **supprimé** — devient un prérequis d'ACTION |
| Bannière permanente « Mode découverte » | en-tête permanent | **supprimée** — 0 référence |
| Libellé « mode dégradé » | « Assistant d'orientation » | **« Conversation générale »** (neutre) |
| Barrière de prêt **infinie** (C1.5) | un blocage d'auth figeait le composer | **bornée** (4 s) |

**Ce qui reste verrouillé — et le reste :** `/api/assistant/conversations` → **401**,
`/api/assistant/execute` → **401** (vérifié en navigateur anonyme).

---

## 3. Comment fonctionne la conversation anonyme

- **Aucun utilisateur Supabase requis.** Le lecteur est modélisé : `{ kind: "anonymous" }` — on ne
  **fabrique aucun identifiant**.
- **Aucune requête tenant.** Sans identité, ni `resolveCloneChatCompany` ni `hasPierreAccess` ne
  sont même appelés.
- **Budget** : portée `{ userId: null, companyId: null }` ⇒ seuls les plafonds **globaux**
  s'appliquent. Pas de faux compteur, pas de fausse identité.
- **Fil** : local au navigateur. Aucune conversation durable (elle exigerait un tenant).
- **Abus** : fenêtre glissante **12 messages / 5 min** par client, clé = **empreinte SHA-256
  tronquée** de (IP | user-agent) — **jamais stockée, jamais journalisée, jamais une identité**.
  À la limite, le message reste honnête (« reprenons dans N minutes ») et **ne prétend jamais que
  CloneChat est indisponible**.

---

## 4. Le geste central : le refus s'attache à la DEMANDE

Chaque message est classé — `CONVERSATIONAL_OR_PUBLIC` · `PRIVATE_CONTEXT_REQUIRED` ·
`GOVERNED_ACTION_REQUIRED` — puis `resolveCloneChatPlan()` calcule **ce qui manque pour satisfaire
la demande**, jamais « le droit de parler » (`chatAvailable: true` est un invariant de type).

| Profil | Question publique | Donnée privée | Action gouvernée |
|---|---|---|---|
| **Anonyme** | réponse normale | 200 + `["authentication","active_company"]` | 200 + `["authentication","active_company","pierre_entitlement"]` |
| **Compte sans entreprise** | **même chemin** | 200 + `["active_company"]` *(on ne redemande pas de se connecter)* | + `["pierre_entitlement"]` |
| **Entreprise sans Pierre** | réponse normale | autorisée | 200 + `["pierre_entitlement"]` seulement |
| **Entreprise + Pierre** | réponse normale | autorisée | **chemin gouverné intact** |

Dans **tous** les cas sans prérequis satisfaits : `tool_call = null`, **aucune proposition**,
**aucune mission**, **aucun effet externe**.

---

## 5. Réponses aux 10 questions

| # | Question | Réponse |
|---|---|---|
| 1 | Pourquoi CloneChat était-il encore verrouillé ? | 401 anonyme **+** un second assistant local qui court-circuitait le serveur (§1). |
| 2 | Quelles portes d'entrée ont été supprimées ? | §2 — auth, entreprise, droit Pierre, bannière, second assistant, barrière infinie. |
| 3 | Comment marche le chat anonyme ? | §3 — aucun ID fabriqué, aucune requête tenant, budget global, fil navigateur, limite d'abus. |
| 4 | Les requêtes publiques anonymes sont-elles en HTTP 200 ? | **Oui** — mesuré en navigateur incognito : `200`, `source: openai_public`, `anonymous: true`. |
| 5 | Un anonyme peut-il accéder aux données tenant ? | **Non.** Aucune requête tenant n'est même émise ; l'anonyme ne peut pas atteindre la voie entreprise. |
| 6 | Un anonyme peut-il exécuter une action ? | **Non.** `tool_call = null`, `proposal = null`, 0 mission. Routes privées **401**. |
| 7 | Le composer est-il identique dans tous les modes ? | **Oui** — mêmes `clonechat-entry` / `clonechat-header` / `clonechat-input`, mêmes bulles de marque. |
| 8 | Un refus contextuel préserve-t-il la conversation ? | **Oui** — question publique **juste après** un refus : 200, réponse normale, composer actif. |
| 9 | Les parcours sans compte / sans entreprise / sans Pierre sont-ils visuellement identiques ? | **Oui** — même page, même en-tête, même personnalité. Statut neutre « Conversation générale ». |
| 10 | Qu'est-ce qui le prouve ? | §6 — navigateur incognito réel + 20/20 + 10/10 + 515/515 + 7 891/0. |

---

## 6. Preuves

### QA navigateur **incognito** (contexte neuf, aucun cookie, aucun compte) — 14/14

Toutes lues dans **`.c1-6-proofs/browser-qa.json`** (pas depuis stdout), écran par écran :

| Contrôle | Résultat |
|---|---|
| `/assistant` s'ouvre | **200**, URL finale `/assistant`, **aucune redirection** |
| Mur de connexion / avertissement entreprise | **aucun** · en-tête **« Conversation générale »** |
| Composer | **actif** |
| Question publique | **200** · `openai_public` · `anonymous: true` · provider **openai** · **jamais 401** |
| Demande de donnée privée | **200** + `["authentication","active_company"]` · `tool_call: null` · `proposal: null` |
| Action gouvernée | **200** + les 3 prérequis exacts · **rien de créé** |
| Question publique **après** le refus | **200**, réponse normale, **aucun état mort** |
| Mêmes composants UI | `clonechat-entry` · `clonechat-header` · `clonechat-input` · `cc-bubble-user` · `cc-bubble-assistant` |
| Routes privées anonymes | `conversations` **401** · `execute` **401** |

**Capture inspectée** ([anon-B-private.png](.c1-6-proofs/anon-B-private.png)) : la barre de navigation
affiche « Créer un compte / Connexion » (donc bien anonyme), l'en-tête dit « CloneChat —
Conversation générale », les deux questions reçoivent de **vraies réponses**, et la demande privée
est suivie d'une ligne de prérequis + d'un CTA **« Se connecter »**. **La capture confirme le JSON.**

### Authentifié **sans entreprise**

Même chemin public que l'anonyme (`sameSourceAsAnonymous: true`), demande privée →
**`["active_company"]` uniquement** — on ne lui redemande pas de se connecter. Aucun blocage dur,
composer actif, **aucun libellé d'entreprise fabriqué**.

### Barrière de prêt bornée (le défaut trouvé *pendant* C1.6)

En pilotant le navigateur, la résolution d'identité Supabase s'est **figée** — et la barrière de
C1.5 gelait alors le composer **pour toujours**. Une barrière était redevenue une porte.
Corrigée : module **pur** `readiness-barrier.ts`, attente **bornée** (4 s), et **10/10 tests
réels** (pas de simples lectures de source) prouvent : on attend l'identité · l'attente est bornée
· le délai libère l'envoi · **le délai ne fabrique ni utilisateur ni entreprise** · la requête part
quand même · le composer se réarme · **une résolution tardive ne rejoue rien** · aucun second
assistant.

### Tests

| Suite | Résultat |
|---|---|
| Matrice universelle C1.6 | **20 / 20** |
| Barrière de prêt | **10 / 10** |
| Surface CloneChat complète (31 fichiers) | **515 / 515** |
| Non-régression canonique | **7 891 / 0** (1 ignoré) |
| Suite complète du projet | **17 515 passés · 17 échoués** — **les 17 dans 5 fichiers ÉTRANGERS** (§7) |

### TypeScript

**12 erreurs — les 12 dans les 2 fichiers étrangers. 0 dans le périmètre C1.6.**

### Build

**NON LANCÉ** — et **aucun résultat de build n'est revendiqué**. La règle §9 l'interdit tant que
des marqueurs de conflit subsistent : le build échouerait sur du code étranger, pas sur C1.6.

---

## 7. Le bloqueur — étranger à C1.6, et intact

```
src/app/api/webhooks/stripe/route.ts        2 marqueurs
src/lib/partner-program/server/payouts.ts   6 marqueurs
<<<<<<< Updated upstream … >>>>>>> Stashed changes      (mtime : 2026-07-12 14:07)
```

Un **`git stash pop` inachevé** du chantier partner/Stripe. **Zéro marqueur dans le périmètre C1.6.**

**Je n'y ai pas touché** : on ne choisit pas un côté à l'aveugle dans le travail d'autrui.
Conséquence assumée : TypeScript global rouge, build impossible, 5 fichiers de tests étrangers
rouges — **et donc un verdict `PARTIAL`**, même si CloneChat, lui, est vert.

Ces conflits résolus par leur propriétaire, il suffit de relancer `npx tsc --noEmit`,
la suite complète et un build : **aucune ligne de C1.6 n'a besoin de changer**.

---

## 8. Limite déclarée honnêtement (§7)

Les deux comptes de test (`RLS_TEST_USER_A/B`) n'ont **ni entreprise ni Pierre** — vérifié par une
**sonde en lecture seule** ([fixtures-probe.json](.c1-6-proofs/fixtures-probe.json)).

Il **n'existe donc aucun fixture navigateur sûr** pour « entreprise sans Pierre » et « entreprise
avec Pierre ». **Je n'ai fabriqué ni entreprise ni droit.** Ces deux profils sont prouvés
**au niveau route** (matrice C1.6, cas 8/9/10 : question publique normale · action → prérequis
`pierre_entitlement` seul · budget scopé sur la VRAIE entreprise, chemin gouverné intact).

**Profils pilotés au navigateur :** anonyme (incognito) · authentifié sans entreprise.
**Profils non pilotés au navigateur :** entreprise sans Pierre · entreprise avec Pierre.

---

## 9. Périmètre

**Nouveaux :** `clonechat/server/universal-access.ts` · `clonechat/server/anonymous-rate-limit.ts` ·
`clonechat/readiness-barrier.ts` · tests C1.6 · `scripts/c1-6-*.mjs`.

**Modifiés :** `api/assistant/chat/route.ts` · `assistant/useCloneChat.ts` ·
`clonechat/CloneChatWorkspace.tsx` · sondes supplantées de C1.2/C1.3/C1.4/C1.5/P16C/E1.1
(mises à jour vers la doctrine C1.6 — **aucune assertion de sécurité affaiblie**).

| Verrou | État |
|---|---|
| Isolation tenant | **intacte** |
| Routes privées authentifiées | **intactes** (401) |
| Droit Pierre pour EXÉCUTER | **intact** |
| Confirmation humaine / permissions | **intactes** |
| Faux tenant / faux utilisateur | **aucun** |
| Effet de bord anonyme | **aucun** |
| Kill switch · anti-injection | **intacts** |
| Déploiement · base distante · commit | **aucun** |

---

## 10. Verdict

> ## **C1.6 — PARTIAL / ENTRY GATE OR REPOSITORY BLOCKER REMAINS**

**La porte d'entrée, elle, n'existe plus** : un navigateur **incognito, sans compte et sans
cookie**, converse réellement avec CloneChat via `/assistant` — même page, même assistant, même
qualité — pendant que les données privées et les actions restent **intégralement protégées**.

Le `PARTIAL` ne dit rien de CloneChat : il dit qu'**un dépôt porteur de marqueurs de conflit
non résolus ne peut pas être certifié**, et je refuse de certifier autour d'eux.
