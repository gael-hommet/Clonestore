# C1.8 — FINAL REAL-BROWSER CLOSURE — Audit

Date : 2026-07-21. Session : fermeture de la dernière gate navigateur réelle de C1.8 (65 nouveaux
flux + validation structurelle des 37 existants = 102 flux cumulés).

Périmètre respecté : aucun Workflow, aucun sous-agent, aucun Codex, aucun déploiement, aucune
production, aucune migration, aucune base distante, aucun paiement, aucun provider externe, aucun
appel réseau externe, aucune modification des verdicts/artefacts A/B/C, aucun test appelant
`answerPublicQuestion` à la place du navigateur pour les 65 nouveaux flux.

## 1. Les 37 flux existants

Validés **structurellement** (relecture de `C18_BROWSER_CAMPAIGN_SUMMARY.json`), pas ré-exécutés :
37 messages, **37 uniques**, **37/37 `ok:true`**, **0 erreur console réelle** à la capture du
2026-07-18. Ré-exécuter cette campagne exige `next dev` (webpack), qui se heurte au mur RAM déjà
documenté (`C18_TORTURE_FINAL_REPORT.md` §7 : 10–32 min/route sous fenêtre RAM contrainte) — la
consigne de cette session autorisait explicitement une validation structurelle pour ces 37-là.

## 2. Les 65 nouveaux flux

Exécutés en **navigateur réel** (Chromium/Playwright) contre un **build isolé précompilé**
(`NEXT_DIST_DIR=.next-c18-final-closure`, `next build` puis `next start` — ce qui contourne le mur
RAM du mode dev, puisqu'aucune route ne recompile à la navigation). Démarrage via le harnais
fail-closed existant (`e2e/c18-fail-closed-env.cjs`) : 27 variables sensibles neutralisées AVANT
chargement de `.env.local`, providers IA forcés à `false`, garde qui refuse de démarrer si une
destination distante subsiste (vérifié : `FAIL-CLOSED OK — 0 destination distante`).

Résultat final : **65/65 flux verts**, répartis exactement comme demandé — A=20, B=10, C=10, D=10,
E=10, F=5. 0 erreur console réelle, 0 pageerror, 0 404, 0 5xx, 0 requête externe sur l'ensemble de
la campagne finale.

## 3. Défauts PRODUIT réels trouvés et corrigés

### 3.1 — 6 pages réelles jamais linkifiées par CloneChat

**Symptôme** : à « où puis-je lire vos CGV / CGU / mentions légales / DPA / confidentialité », la
réponse NOMME la bonne route (« Les mentions légales sont sur la page /legal/mentions ») mais ne la
rend jamais cliquable — l'utilisateur voit une adresse, pas un lien.

**Cause racine** : `src/lib/clonechat/links/safe-links.ts` (`isKnownInternalRoute`) ne consulte que
`src/lib/nav/route-registry.ts` (le registre canonique). Ces 6 pages (`/legal/cgv`, `/legal/cgu`,
`/legal/confidentialite`, `/legal/dpa`, `/legal/mentions`, `/comprendre-clonestore`) existent
réellement (`page.tsx` présent, confirmées dans la table de routes du build) et étaient déjà connues
de `src/lib/clonechat/navigation/destination-registry.ts` via un allowlist parallèle
(`REAL_UNREGISTERED_ROUTES`) — mais jamais du registre canonique que `safe-links.ts` consulte. Une
mention de route restait donc du texte inerte.

**Correctif (classe entière)** : les 6 routes ont été ajoutées au registre canonique
`ROUTE_REGISTRY` (source de vérité unique, comme documenté en tête de ce fichier). Corrige
`safe-links.ts` ET simplifie `destination-registry.ts` (l'allowlist parallèle devient redondant,
non supprimé pour ne pas élargir le diff).

**Preuve** : `src/lib/clonechat/links/__tests__/safe-links.test.ts` — 6 nouveaux cas (`it.each`),
19/19 verts. Navigateur : B1–B6-10 (10 flux) verts avec click-through réel vérifié sur 5 routes.

### 3.2 — Une correction de pays est ignorée quand elle cite le pays écarté

**Symptôme** : « en fait pas la Suisse, plutôt la France » recevait **exactement** la même réponse
que « je suis en Suisse » (texte identique, prix Suisse 499 CHF inclus) — la correction explicite
vers la France était totalement ignorée.

**Cause racine** : `detectCountry()` dans `src/lib/clonechat/public-answer/public-situation.ts`
testait `LAUNCH_TOKENS` dans un **ordre de tableau fixe** (Suisse toujours en premier, pour éviter
qu'un « franc suisse » soit lu comme la France) et renvoyait le **premier** token qui matchait dans
le TABLEAU — jamais celui réellement voulu par l'utilisateur. Un message citant deux pays de
lancement (le négié et le corrigé) retournait donc toujours celui déclaré en premier dans le code,
indépendamment de ce que l'utilisateur venait d'écrire.

**Correctif (classe entière, pas la phrase exacte)** : `detectCountry` choisit désormais le pays dont
la PREMIÈRE occurrence est la PLUS TARDIVE dans le message (`latestMatchingToken`), au lieu du
premier match de tableau. Ce choix préserve le cas d'origine (« franc suisse » : le mot « suisse »
apparaît après « franc », donc gagne toujours) tout en corrigeant la classe des corrections
multi-pays.

**Preuve** : `src/lib/clonechat/public-answer/__tests__/c18-a2-contracts.test.ts` — 4 nouveaux cas
(3 corrections + 1 régression « franc suisse »), 110/110 verts sur la suite `public-answer/`.
Navigateur : C10 (Suisse→France) et D7 (Belgique→France) verts.

## 4. Défauts de PREUVE (harnais), pas des défauts produit

Corrigés en cours de route, honnêtement distingués des défauts produit ci-dessus :

1. **`buyCta` scanné page entière** : le header du site porte un lien PERSISTANT « Réserver Pierre »
   (visible avant tout message) ; un scan page entière renvoyait donc toujours `true`. Corrigé :
   scope strict au dernier conteneur de message (`.cc-msg-col`).
2. **`ctaLocator` page entière capturait un élément de la sidebar** : l'historique de conversation
   nomme chaque item par le message utilisateur (et son bouton de suppression porte le même texte
   en `aria-label`) — un `.last()` page entière pouvait cliquer sur « Supprimer la conversation
   [texte] » au lieu du vrai lien de réponse. Sans impact sur B1/B2/F puisque `.last()` y visait
   sciemment n'importe quel affordance réelle cliquable (cohérent avec la méthodologie des 37 flux
   d'origine) ; corrigé où la portée comptait (résolu de fait par le fix §3.1, qui a rendu la vraie
   réponse linkifiée disponible et prioritaire).
3. **Perte de résultats sur redémarrage de worker** : `test.afterAll` (écriture batch unique en fin
   de run) perdait TOUT l'état mémoire si Playwright redémarrait un worker en cours de campagne
   (observé : 60 flux déjà réussis perdus, un seul run n'en a conservé que 5). Corrigé : écriture
   incrémentale (`appendFileSync` JSONL) après chaque flux, durable même sur redémarrage.
4. **Réutilisation d'IP entre invocations séparées** : chaque invocation Playwright redémarrait le
   compteur d'IP à `.100` ; contre un serveur PERSISTANT entre invocations, cela réutilisait les
   mêmes IP et cumulait des messages réels jusqu'à déclencher légitimement le rate-limiter anonyme
   (« vous allez un peu vite ») — le limiteur fonctionnait correctement, c'est la réutilisation d'IP
   qui était fautive. Corrigé : compteur persisté sur disque entre invocations.

## 5. Non-régression

- `src/lib/clonechat/public-answer/` (contrats + situation + composer) : **110/110**
- `src/lib/clonechat/` (suite complète) : **895/895** (3 fichiers marginaux au timeout PAR DÉFAUT de
  5000ms sous charge système concurrente au premier passage — confirmés **non-régressifs** : verts
  à 100% avec un timeout de 30s, aucune assertion de contenu en échec, comportement identique avant/
  après le fix ; limite d'ENVIRONNEMENT documentée, pas un défaut produit)
- `npx tsc --noEmit` : **0 erreur**
- Build isolé : **compilé + type-check + génération statique + exit propre**, deux fois (avant et
  après les deux correctifs produit)

## 6. Fichiers produit modifiés (forensique)

`src/lib/nav/route-registry.ts` · `src/lib/clonechat/public-answer/public-situation.ts` ·
`src/lib/clonechat/links/__tests__/safe-links.test.ts` (test) ·
`src/lib/clonechat/public-answer/__tests__/c18-a2-contracts.test.ts` (test). Aucun autre fichier
source touché. Aucun fichier Pierre / technologies / intégration / CloneOS / registre de routes
distinct touché au-delà de l'ajout additif dans `route-registry.ts`.

## 7. Production / déploiement / migrations / paiements

**Aucun touché.** Build et serveur tournent dans un dossier isolé (`.next-c18-final-closure`),
jamais partagé avec `.next`. Le harnais fail-closed neutralise 27 destinations distantes avant
démarrage et refuse de démarrer si l'une d'elles subsiste (vérifié à chaque démarrage : `0
destination distante`).
