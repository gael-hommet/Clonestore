# C1.4 — Gap Matrix (accès Pierre + runtime OpenAI réel)

## A. Défaut d'accès — truthiness d'objet

`src/lib/pierre/access.ts::hasPierreAccess` renvoie `{ ok, error }` (objet). Un objet est **toujours truthy**.

### Audit EXHAUSTIF des consommateurs de `@/lib/pierre/access`

> Les nombreuses routes `/api/pierre/use/**` définissent leur **propre** `hasPierreAccess` local renvoyant `Promise<boolean>` — elles **n'importent pas** le module partagé et ne sont donc pas concernées par ce défaut.

| # | Call site (importe le module partagé) | Usage actuel | Correct ? | Conséquence |
|---|---|---|---|---|
| 1 | `src/app/api/assistant/chat/route.ts:115` | **`if (!access)`** | ❌ **BUG** | `!objet` = `false` ⇒ la porte `no_pierre` **ne se déclenche jamais** ⇒ un utilisateur authentifié **sans droit Pierre** atteint les chemins opérationnels CloneChat |
| 2 | `src/app/agents/pierre/company-history/route.ts:36,76` | `if (access.error)` → 500 ; `if (!access.ok)` → 403 | ✅ | (fuite : `error: access.error` renvoyé au client) |
| 3 | `src/app/api/pierre/doc/rewrite/route.ts:258` | `access.error` → 500 ; `!access.ok` → refus | ✅ | (même fuite) |
| 4 | `src/app/api/pierre/use/task/[taskId]/route.ts:186` | `access.error` → 500 ; `!access.ok` → refus | ✅ | (même fuite) |
| 5 | `src/app/api/pierre/use/task/[taskId]/run/route.ts:135` | `if (!access.ok)` → 403 | ✅ | — |
| 6 | `src/app/api/checkout/route.ts:150,191` | `res.ok` | ✅ | — |
| 7 | `src/app/api/pierre/cockpit/snapshot/route.ts:124` | `accessResult.ok === true` | ✅ | — |
| 8 | `src/lib/access/operational-access.ts:164` | `if (access.ok)` | ✅ | — |
| 9 | `src/lib/clonestore/cloneos/client-readiness.ts:41` | `!!access?.ok` | ✅ | — |

**Défaut unique confirmé : #1.** Défaut secondaire (fuite d'information) : #2/#3/#4 renvoient le message d'erreur brut de la base au client.

### Correction

- Contrat **typé en union discriminée** (`PierreAccessResult`) : `ok:true` (+ `status`, `orderId`) · `ok:false reason:"NO_ENTITLEMENT"` · `ok:false reason:"LOOKUP_FAILED"`.
- `error` devient un **code sûr et stable** (jamais le message brut du provider) ⇒ la fuite #2/#3/#4 est fermée **sans changer leur flux** (`access.error` reste consultable, `!access.ok` reste valide).
- Helper `isPierreAccessGranted(result)` pour rendre le mauvais usage difficile.
- Échec de requête ≠ absence de droit (`LOOKUP_FAILED` ≠ `NO_ENTITLEMENT`).

### Preuve

- Tests de contrat (active/trialing/aucun/annulé/incomplet/erreur DB).
- Test anti-régression : **aucun call site n'évalue la truthiness de l'objet**.
- Tests de route : sans droit ⇒ requête opérationnelle bloquée ; question publique ⇒ toujours servie (C1.3 préservé).

---

## B. Défaut base de données — rôle `clonechat_app`

Erreur runtime observée en QA navigateur C1.3 : `role "clonechat_app" does not exist`.

| Élément | Statut |
|---|---|
| Référencé par | budget durable (`SET LOCAL ROLE` dans `withInternal`) |
| Migration canonique | *à déterminer* (§9) |
| Conséquence | réservation durable impossible ⇒ pas d'appel OpenAI (invariant respecté) ⇒ repli déterministe |
| Correction | provisionner localement le rôle **moindre privilège**, prouver la réservation réelle, puis prouver un **appel OpenAI réel** en navigateur |

---

## C. Invariant runtime

**AUCUNE RÉSERVATION DE BUDGET RÉUSSIE ⇒ AUCUN APPEL OPENAI.** À préserver dans les deux modes (découverte publique et entreprise).
