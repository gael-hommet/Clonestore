# C1.4 — CloneChat : porte d'accès & clôture du runtime OpenAI réel

**Verdict — voir §12.** Deux défauts étaient signalés. **Les deux étaient réels. Aucun n'est masqué.**

---

## 1. Les deux défauts, tels qu'ils étaient réellement

### Défaut A — la porte d'accès Pierre ne se fermait jamais

`src/app/api/assistant/chat/route.ts` (ancienne ligne ~115) :

```ts
const access = await hasPierreAccess(supabase, userId);
if (!access) { /* refus « no_pierre » */ }
```

`hasPierreAccess` renvoyait un **objet** `{ ok, error }`. En JavaScript, **`!objet` vaut toujours
`false`** — y compris `!{ ok: false }`. **La branche de refus était structurellement morte.**
Un utilisateur authentifié **sans aucun droit Pierre** franchissait la porte et atteignait les
chemins opérationnels de CloneChat. Ce n'était pas une porte trop permissive : **il n'y avait pas de porte.**

### Défaut B — le rôle base de données `clonechat_app` n'existait pas

```
error: role "clonechat_app" does not exist
```

`src/lib/clonechat/durable/pg.ts` ouvre chaque transaction durable par
`set local role clonechat_app`. Sans le rôle, **toute réservation de budget échouait**, et
comme la réservation était attendue **hors `try`**, la route **plantait en 500** (constaté en QA C1.3).

**Cause racine — ce n'est PAS un code manquant.** La migration canonique
`supabase/migrations-p941/2026-07-07__p941_clonechat_durable.sql` **crée déjà le rôle,
idempotemment** (`if not exists (...) then create role clonechat_app nologin`). Elle n'avait
simplement **jamais été appliquée** à la base ciblée. C'est un **défaut de provisioning**.
→ Runbook opérateur : **`C1_4_CLONECHAT_DATABASE_ROLE_RUNBOOK.md`**.

---

## 2. Correction du défaut A — un contrat typé, pas une rustine

Une comparaison corrigée à un seul endroit aurait laissé la même classe de bug revenir. J'ai
donc changé le **type de retour** en **union discriminée**, de sorte que le compilateur
refuse la faute (`src/lib/pierre/access.ts`) :

```ts
export type PierreAccessResult =
  | { ok: true;  status: PierreEntitlementStatus; orderId: string; error: null }
  | { ok: false; reason: "NO_ENTITLEMENT";        error: null }
  | { ok: false; reason: "LOOKUP_FAILED";         error: typeof PIERRE_ACCESS_LOOKUP_FAILED };
```

- Le statut est **revalidé côté serveur** (`active` | `trialing`) — défense en profondeur.
- **Ne lève jamais** : une panne DB devient `LOOKUP_FAILED`, jamais une exception.
- `error` reste présent sur **toutes** les branches (les 3 autres routes qui testent
  `if (access.error)` compilent sans modification) mais ne porte plus **qu'un code sûr** —
  **jamais le message brut de la base** (voir §6, fuite d'information secondaire).

**Audit de tous les appelants.** Distinction essentielle trouvée à l'audit : les routes
`/api/pierre/use/**` définissent leur **propre** `hasPierreAccess` **local** renvoyant
`Promise<boolean>` — elles ne sont pas concernées. **9 fichiers** importent le contrat partagé ;
**un seul** utilisait `if (!access)` : la route CloneChat. Les 8 autres testaient déjà `.ok`.
→ `C1_4_ACCESS_AND_OPENAI_GAP_MATRIX.md`, preuve `has-pierre-access-call-sites.json`.

**Le bug ne peut pas revenir** : un test parcourt le système de fichiers, trouve tout importateur
de `lib/pierre/access` qui fait `await hasPierreAccess(`, et **échoue** si l'un teste la
véracité de l'objet (`if (!access)` / `if (access)`).

---

## 3. La matrice d'accès (le cœur de C1.4)

Module **pur** `src/lib/clonechat/server/access-mode.ts`. **Trois autorités, jamais confondues :**

> · l'**intention** choisit une voie — elle **n'autorise rien** ;
> · le **droit Pierre** débloque l'opérationnel — il **ne fabrique jamais une entreprise** ;
> · l'**entreprise** identifie un tenant — elle **ne fabrique jamais un droit**.

| Intention | Droit Pierre | Entreprise | Mode | Modèle appelé ? |
|---|---|---|---|---|
| publique | absent | absente | `AUTHENTICATED_DISCOVERY` | **oui** (sources publiques) |
| publique | absent | **active** | `AUTHENTICATED_DISCOVERY` | oui — **budget jamais scopé sur l'entreprise** |
| opérationnelle | absent | absente | `ENTITLEMENT_REQUIRED` | **non** |
| opérationnelle | absent | **active** | `ENTITLEMENT_REQUIRED` | **non** — *une entreprise seule ne contourne jamais le droit* |
| ambiguë | absent | absente | `CLARIFICATION_REQUIRED` | non |
| opérationnelle | **OK** | absente | `COMPANY_REQUIRED` | non — *jamais de fausse entreprise* |
| publique | **OK** | absente | `AUTHENTICATED_DISCOVERY` | oui |
| opérationnelle | **OK** | **active** | `COMPANY_MODE` | oui (chemin entreprise inchangé) |
| *toutes* | *toutes* | **suspendue / indisponible** | `TENANT_FAIL_CLOSED` | **non — pour tout le monde** |
| opérationnelle | **panne de vérif.** | — | `ACCESS_CHECK_UNAVAILABLE` → **503** | **non** |
| publique | **panne de vérif.** | — | `AUTHENTICATED_DISCOVERY` | oui — *une panne n'accorde rien, elle n'ouvre que le public* |

Une boucle triple exhaustive prouve que **`COMPANY_MODE` exige simultanément le droit ET l'entreprise**.
Le blocage `TENANT_FAIL_CLOSED` s'applique **même à une question publique** : un membership
suspendu est un état de **sécurité**, pas un état de découverte. C'est un choix assumé.

**C1.3 n'est pas régressé** : la découverte publique authentifiée reste ouverte **sans droit et
sans entreprise**. Aucune question générale (produit, prix, fonctionnement) n'exige un achat.

---

## 4. Correction du défaut B — sans jamais toucher une base de production

Ordre de résolution réel : `CLONECHAT_DB_URL || DATABASE_URL`.
`scripts/c1-4-db-safety-check.mjs` classe la cible **par catégorie, jamais en affichant l'URL** :

> **`DATABASE_URL` → `managed_supabase_remote` → production non exclue ⇒ AUCUNE migration ne lui a été appliquée.**

Le provisioning a donc été prouvé sur une **base jetable** (embedded-postgres, `scripts/c1-4-local-budget-db.mjs`),
en appliquant **la migration canonique** — aucun SQL réécrit à la main.

Prouvé **dans la base** (`database-role-privileges.json`) :

| Contrôle | Résultat |
|---|---|
| `clonechat_app` existe | ✅ |
| Moindre privilège (ni superuser, ni createdb, ni createrole, ni **login**, ni réplication) | ✅ |
| **`NOBYPASSRLS`** — ne peut pas contourner l'isolation tenant | ✅ |
| RLS active sur les **10** tables `clonechat_*` | ✅ |
| Droits **uniquement** sur `clonechat_*` (lecture d'une table étrangère refusée) | ✅ |
| **Réservation de budget durable réellement accordée** | ✅ |
| Commit enregistré · plafond appliqué | ✅ |

---

## 5. La preuve OpenAI réelle (et pourquoi elle est réfutable)

Exécutée dans un **vrai navigateur**, avec une **vraie session Supabase**, contre la **vraie route**,
sur la base durable locale. **Borne : 3 appels provider maximum, questions publiques uniquement.**

| Preuve | Valeur observée |
|---|---|
| `source` | `openai_public` |
| `runtime.provider` | `openai` |
| **modèle rapporté par le provider** | **`gpt-4o-mini-2024-07-18`** (≠ modèle *demandé* `gpt-4o-mini`) |
| Tokens entrée / sortie | 1377/50 · 1481/165 · 1447/165 — **non nuls** |
| Réservation accordée **avant** le provider | **oui (mesuré)** |
| Budget engagé **en base** | **4688 tokens**, `reserved_tokens = 0` (aucune réservation fuitée) |
| `company_id` des événements d'usage | **NULL** — aucune fausse entreprise |
| Requête **opérationnelle** sans droit | `pierre_access_required` — **aucun appel provider** |
| Anonyme | **401** |
| Mobile 390×844 | workspace réel, OpenAI réel, pas de débordement |
| Clé en clair dans une réponse | **jamais** |

### Ce que la revue adverse a trouvé — et cassé

**Constat (réel, corrigé) : `reservedBeforeProvider` était écrit en dur `true`.**
Une preuve qui **ne peut jamais être fausse ne prouve rien** — c'est exactement le « vert
auto-certifié » que la doctrine interdit. Idem pour `model`, qui recopiait le modèle **configuré**.

**Correction — la preuve devient mesurée et réfutable :**

```ts
let seq = 0;
const reservedSeq = pubReservation.granted ? ++seq : 0;   // horloge logique
let providerSeq = 0;
// … dans le décorateur, AVANT le franchissement réseau :
providerSeq = ++seq;

reservedBeforeProvider: providerSeq === 0 ? null : reservedSeq > 0 && reservedSeq < providerSeq,
model: viaProvider ? (usage?.model ?? null) : null,   // rapporté PAR le provider
```

Trois tests de régression verrouillent la **réfutabilité** : sans appel provider, le champ vaut
**`null`, jamais `true`** ; le modèle reste **`null`** sous responder simulé (il **ne peut pas**
emprunter la config) — **seul un vrai provider peut le remplir**. C'est pourquoi
`gpt-4o-mini-2024-07-18` en base **est** la preuve : cette chaîne n'existe nulle part dans le code.

**Invariant : AUCUNE RÉSERVATION ⇒ AUCUN APPEL OPENAI.** Le responder n'est **construit** que si
`pubReservation.granted && key && cfg.enabled`. Budget refusé → **repli déterministe, zéro appel**.
Budget indisponible (rôle absent) → **repli déterministe, jamais un 500** — c'est la correction
durable du crash observé en C1.3. Un repli **n'est jamais étiqueté OpenAI**.

---

## 6. Fuite d'information secondaire (trouvée en chemin, corrigée)

L'ancien contrat renvoyait le **message brut de Postgres** dans `error`. Une panne DB pouvait
donc exposer `role "clonechat_app" does not exist` à un client HTTP. Désormais : **code sûr**
(`PIERRE_ACCESS_LOOKUP_FAILED`), réponse **503** neutre, et un test interdit explicitement toute
occurrence de `clonechat_app|does not exist|pg_|role "` dans le corps renvoyé.

---

## 7. Tests

| Suite | Résultat |
|---|---|
| Contrat d'accès + audit mécanique des appelants | ✅ |
| Matrice d'accès (dont boucle triple exhaustive) | ✅ |
| Route `/api/assistant/chat` (porte, budget, repli, réfutabilité) | ✅ |
| **Total périmètre C1.4 + CloneChat + accès** | **143 / 143** |
| `tsc` **dans le périmètre C1.4** | **0 erreur** |

**Non-régression complète : 17 149 passés / 5 échecs / 1 ignoré.** Les 5 échecs sont **attribués
avec preuves**, et **aucun n'est imputable à C1.4** :

- **4 × `premium-document-system`** — **pré-existants** : échouent **aussi en isolation**,
  **n'importent pas** `lib/pierre/access`, fichier daté du **19/05/2026** (≈ 2 mois avant la session).
  Ils ne sont apparus que parce que le scope de test exigé par C1.4 est plus large que les
  précédents. **Non corrigés : hors périmètre.**
- **1 × `fair-claim`** — test d'**intégration embedded-postgres** sensible à la charge :
  **vert 3 fois sur 3 en isolation**, rouge uniquement dans la suite parallèle complète.
  N'importe **aucune** surface C1.4.

**Deux assertions périmées corrigées** dans `site-polish-prospection.test.ts` : elles exigeaient
encore « CloneChat désactivé par défaut » — politique **délibérément inversée par C1.2**
(révélation, approuvée). Elles étaient **rouges depuis C1.2, avant C1.4**. La couverture du
**kill switch est conservée et renforcée** (chaque valeur d'arrêt testée, et l'API doit répondre
503 **seulement** quand l'arrêt est armé).

---

## 8. Un autre chantier écrivait dans le dépôt pendant la session

**À signaler explicitement.** Entre 16:10 et 16:41, **18 fichiers `partner-program`** ont été
modifiés dans ce dépôt — **aucun par C1.4** (horodatages à l'appui). Conséquences observées :

- **7 erreurs `tsc`**, **toutes** dans `src/lib/partner-program` / `src/app/api/partners` — **0 dans le périmètre C1.4** ;
- **`npm run build` échoue** : la compilation réussit (`✓ Compiled successfully`), puis la
  validation de type des routes Next rejette `src/app/api/partners/contract/accept/route.ts`
  (écrit à 16:19:17 par cet autre chantier).

**Je n'y ai pas touché** : ce n'est pas mon périmètre, et le code y est en cours d'édition —
intervenir provoquerait une collision. C1.4 compilait proprement avant que ces fichiers ne changent.

---

## 9. Périmètre — ce que C1.4 a modifié, et rien d'autre

**Modifié :** `src/lib/pierre/access.ts` (contrat typé) · `src/lib/clonechat/server/access-mode.ts` (nouveau, pur) ·
`src/lib/clonechat/server/c1-4-command-center.ts` (nouveau) · `src/app/api/assistant/chat/route.ts` (matrice + instrumentation) ·
`scripts/c1-4-*.mjs` · tests C1.4 · 2 assertions périmées (§7).

**Intact :** C1 · C1.1 · C1.2 · **C1.3 (préservé et testé)** · P16A · P16C · E1 · Pierre V1 · T1 · T2 ·
isolation tenant · planchers human-only.

**Aucun second client OpenAI** — le responder **existant** est enveloppé d'un simple décorateur.
**Aucun second système d'accès. Aucune fausse entreprise. Aucun bypass service-role.**

| Garde | État |
|---|---|
| `PRODUCTION_AUTHORIZED` | **false** |
| Mode de paiement | **`disabled`** |
| Providers live (voix, téléphonie, signature, e-mail) | **bloqués** |
| Déploiement / push / commit | **aucun** |
| Migration appliquée à une base distante | **aucune** |
| Secrets imprimés | **aucun** |

---

## 10. Ce qu'il faut faire avant le déploiement contrôlé

1. **Appliquer la migration canonique P9.4.1** à la base de déploiement (elle crée
   `clonechat_app` idempotemment) — **`C1_4_CLONECHAT_DATABASE_ROLE_RUNBOOK.md`**, §3.
2. Exécuter la **requête de préparation** (runbook §4) : les 4 colonnes doivent être `true`,
   et **aucune table hors `clonechat_*`** ne doit apparaître dans les droits du rôle.
3. Fournir `OPENAI_API_KEY` à l'environnement (jamais au dépôt).
4. Laisser `CLONECHAT_ENABLED` **non défini** (actif) ; l'arrêt d'urgence reste `CLONECHAT_ENABLED=false`.

**Sans l'étape 1**, CloneChat **ne plante pas** : il répond en **repli déterministe** — mais **sans
budget durable et sans OpenAI**.

---

## 11. Limites honnêtes

- Les scénarios navigateur **B** (droit sans entreprise) et **C** (droit + entreprise) **n'ont pas été
  pilotés au navigateur** : aucun compte de test **entitlé** n'existe. Ils sont prouvés **au niveau route**.
- La preuve OpenAI réelle porte sur le **chemin public** (le seul atteignable par un compte non entitlé).
  Le chemin **entreprise** est inchangé et couvert par ses tests d'origine.
- `readyForControlledDeployment` **ne signifie pas** que la production est autorisée.

---

## 12. Verdict

> ## **C1.4 — ACCESS GATE AND REAL OPENAI RUNTIME VERIFIED / READY FOR CONTROLLED DEPLOYMENT**

Les deux défauts étaient réels ; les deux sont corrigés et prouvés. La porte d'accès est
**typée, auditée et fail-closed** ; le rôle base de données est **provisionné et prouvé au moindre
privilège, sans RLS contournable** ; un **appel OpenAI réel** a été exécuté dans un **vrai navigateur
authentifié** après une **réservation de budget durable réelle**, avec **engagement du budget vérifié
en base** — et la preuve elle-même a été rendue **réfutable**. La découverte publique **C1.3 reste
ouverte sans achat**. `PRODUCTION_AUTHORIZED` reste **`false`**, le paiement reste **`disabled`**,
les providers live restent **bloqués**, et **rien n'a été déployé**.

**Bloqueurs : aucun.** Reste **une action opérateur** avant déploiement : appliquer la migration
canonique à la base cible (§10).
