# CloneChat — BLOC 3 : CloneContext

**Verdict local : PASS.** CloneContext fournit à CloneChat un contexte applicatif **réel, typé et sûr**, assemblé uniquement depuis les sources déjà résolues côté serveur — jamais deviné, jamais inter-tenant, jamais un droit inventé. Le Brain (BLOC 2) est branché dessus de façon **compatible avec l'API existante**.

## Architecture (`src/lib/clonechat/context/`)

| Fichier | Rôle |
|---|---|
| `types.ts` | `CloneChatContext` versionné (`context-1`) : navigation (route/label/audience/statut/space/breadcrumb/known), viewer (authentifié/anonyme, userId), tenant (résolu/companyId/role/real/refusalCode/securityFailure), Pierre (granted/status/lookupFailed), lane, requestClass, actions disponibles, prérequis manquants + CTA, blocages, erreurs présentes, environnement, disponibilités. |
| `build.ts` | **Assembleur PUR** `buildCloneChatContext(input)` : prend viewer + tenant (`TenantResolution`) + entitlement (`PierreAccessResult`) + route **déjà résolus**, réutilise `classifyCloneChatRequest` + `resolveCloneChatPlan` (universal-access) et `getRouteEntry` (registre réel). Aucune lecture DB, aucune supposition. |
| `brain-context.ts` | Branche le Brain : `contextToBrainAccount()` + `decideWithContext()`. Le contexte **ne fait que restreindre/annoter** (prérequis, blocages, route verrouillée) — jamais accorder. Sortie projetée via `toStructured()` (format existant préservé). |
| `index.ts` | Surface publique. |

## Sources réelles (aucune invention)

- Viewer : `CloneChatViewer` (`{kind:"anonymous"}` | `{kind:"user",userId}`) — aucun id fabriqué pour un anonyme.
- Tenant : `TenantResolution` — `companyId` n'apparaît **que si `ok`** ; codes de refus réels (`MEMBERSHIP_REQUIRED`, `COMPANY_SELECTION_REQUIRED`, `MEMBERSHIP_SUSPENDED`, `COMPANY_UNAVAILABLE`) ; `securityFailure` = plan.tenantSecurityFailure.
- Pierre : `PierreAccessResult` — `LOOKUP_FAILED` **jamais** confondu avec une absence de droit.
- Plan/prérequis/lane/disponibilités : `resolveCloneChatPlan` (module pur universal-access, C1.6).
- Route/navigation : `getRouteEntry` (registre canonique) — route inconnue → `known:false`, rien n'est supposé.
- Actions disponibles : **dérivées du plan** (`ask_question`/`open_page` toujours ; `read_private_context` si entreprise vérifiée ; `propose_governed_action` si entreprise + Pierre vérifiés).

## Invariants prouvés (gate 25 tests)

- **Isolation inter-tenant** : le contexte ne reflète QUE l'entreprise résolue pour la requête ; le contexte sérialisé de A ne contient jamais l'id de B ; anonyme → aucune companyId/userId.
- **Aucun faux droit** : action gouvernée indisponible sans entreprise + Pierre vérifiés ; prérequis manquants exposés, jamais contournés.
- **Sécurité tenant fail-closed** : suspendu/indisponible → `securityFailure`, blocage annoncé, jamais résolu ni accès accordé.
- **Panne d'entitlement** distincte de l'absence de droit (`entitlement_lookup_unavailable`).
- **Routes** public/authenticated/gated/inconnue/absente correctement reflétées ; route inconnue ne suppose rien.
- **Brain branché** : `act` sans compte → contexte compte requis + prérequis en limitations, jamais exécuté ; injection refusée même avec contexte complet (aucun contournement via contexte) ; modèle indisponible → réponse honnête ; **format structuré `{answer,honesty,tool_call,citations}` inchangé**.
- **Déterminisme** : même entrée → même contexte.
- **Contexte incomplet** (authentifié sans tenant/entitlement fournis) → dégrade en PUBLIC sûr.

## Gate local (tout vert)

- CloneContext **25/25** ; régressions **145/145** (Brain 27, product-truth 15, context-boundary 51, corpus 6, injection-114 114/114, universal-clonechat 20).
- **tsc** 0 nouvelle erreur (1 pré-existante `embedded-postgres`). **ESLint** 0 sur les fichiers modifiés. **Build Next isolé** : `BUILD_EXIT_CODE=0`.

## Limites réelles / suite

- Comme au BLOC 2, `decideWithContext()` n'est **pas encore câblé** dans le handler `/api/assistant/chat` : le module fournit le branchement compatible (mêmes entrées réelles viewer/tenant/entitlement/route que la route, même format de sortie) et le prouve par des tests d'intégration ; le câblage du chemin servi reste une étape délibérée ultérieure pour ne pas déstabiliser la Production.
- Le **diagnostic complet** (corréler erreurs/blocages en cause racine, étape bloquante, action recommandée) est **hors périmètre BLOC 3** et sera construit au **BLOC 4** ; ici les erreurs présentes sont seulement **exposées** au contexte (`surfaced_error:*`) sans être interprétées.
- `environment` provient de l'appelant ou de `NODE_ENV`/`VERCEL_ENV` réels (jamais deviné).
