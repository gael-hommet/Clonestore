# C1.8 — RÉOUVERT / CLÔTURE DU COMPORTEMENT PRODUIT CLONECHAT

Date : 2026-07-18. Session : C1.8 réouvert (navigation & CTA CloneChat).
Périmètre autorisé respecté : **aucun push, aucun commit, aucun déploiement, aucune migration,
aucune lecture `.env.local`, aucun provider réel, aucun email, aucun paiement, aucune écriture PROD.**

---

## 1. Le défaut (rapporté)

Message : « je veux acheter pierre, je dois me rendre sur quelle page ».
Réponse observée : pages génériques + clarification inutile + CTA **Support/FAQ** + message parasite
« aucune entreprise active » + **aucun lien direct vers Réserver Pierre**.

Attendu : « Pour obtenir Pierre, rendez-vous sur la page **Réserver Pierre**. », CTA **« Réserver
Pierre »**, route canonique **`/reserver/pierre`**, sans clarification / liste / Support / parasite /
route inventée.

## 2. Cause racine (prouvée au niveau routeur)

Le routeur historique `routeCloneChatQuestion` **n'a aucune catégorie d'achat**. « quelle page » ⇒
catégorie `site_navigation` ⇒ `linksFor` renvoie le CTA **`/questions` (Support)**. Preuve
`C18_PURCHASE_PIERRE_BEFORE_PROOF.json` : sur 22 formulations d'achat, le chemin **hérité** n'en mène
qu'**1/22** vers `/reserver/pierre` ; le cas de référence a pour CTA hérité **`/questions`** — le
parasite exact rapporté.

## 3. Le correctif (classe entière, pas une phrase)

Ajouts (purs, déterministes, testables) :

- `src/lib/clonechat/navigation/destination-registry.ts` — **source unique** des destinations
  CloneStore (route + label + CTA + contexte + prérequis), garde anti-invention (`isRealDestinationRoute`).
- `src/lib/clonechat/navigation/intent-taxonomy.ts` — **taxonomie d'intentions** déterministe
  (`resolveNavigationIntent`) : achat/réservation détecté en priorité, distinct de prix/démo/découverte/
  support/annulation ; négation respectée ; ellipse résolue sur le contexte ; une intention commerciale
  n'est **jamais** parasitée par l'absence d'entreprise.
- `src/lib/clonechat/navigation/navigation-answer.ts` — réponse **directe** pour une navigation claire
  (achat/réservation/connexion/inscription) : une phrase utile + un CTA, jamais une liste ni le Support.

Câblage (une seule modification de comportement) :

- `src/lib/clonechat/intelligence/c1-1/parrain-turn-runtime.ts` — court-circuit de navigation (n'agit
  que hors pièce jointe/délégation ⇒ **voie P19 CloneChat→Pierre intacte**) + imposition du CTA canonique
  **dans `relevantLinks`** (ce que le client rend réellement), pas seulement `suggestedCTA`.

## 4. Portes (toutes vertes, mesurées)

| Porte | Résultat |
|---|---|
| Taxonomie (unit) | **49/49** |
| Matrice adverse §9 (240 formulations générées par 8 agents indépendants) | **230/240 = 95,8 %**, **100 %** sur prix/démo/découverte/navigation & « jamais forcer l'achat » ; 10 résidus = ambiguïtés légitimes (allowlist) |
| Reproduction AVANT (chemin hérité) | **1/22** vers reserver ; référence → **Support** |
| APRÈS (pipeline réel `answerPublicQuestion`) | **23/23** direct + `relevantLinks[0]` canonique |
| Référence au niveau ROUTE (`/api/assistant/chat`, connecté **sans entreprise**) | **3/3** : réponse directe, CTA `/reserver/pierre`, 0 parasite, `modelCalled:false` |
| Campagne NAVIGATEUR (webpack, anonyme, 0 provider, 0 écriture PROD) | **37/37 flux**, click-through réels → `/reserver/pierre` & `/demo/pierre`, **0 erreur console** |
| Suite CloneChat complète | **899/899** |
| Non-régression Pierre (moteur) | **5374 / 1 skip** |
| Non-régression technologies/intégration/CloneOS/cockpit (P19) | **7885/7885** |
| Non-régression nav + geo | **80/80** |
| TypeScript | **0 erreur** |
| Build isolé (§21, webpack, heap 6144) | **✓ compilé + type-check OK + 196/196 pages statiques + exit propre** (= baseline P19). 1er essai OOM = fenêtre RAM ; réussi en fenêtre ≥6 Go. Voir `C18_BUILD_PROOF.json` |

## 5. Non-régression P19 (périmètre)

Fichiers **source** modifiés cette session (forensique mtime) : **4**, tous CloneChat —
`intent-taxonomy.ts`, `destination-registry.ts`, `navigation-answer.ts` (nouveaux) et
`parrain-turn-runtime.ts` (court-circuit + câblage CTA + `export linksFor` pour la preuve). **Aucun**
fichier Pierre / technologies / intégration / CloneOS / registre de routes touché. Le court-circuit se
désactive dès qu'il y a délégation ⇒ la voie **CloneChat→Pierre→CloneOS** de la baseline P19 est
inchangée. Baseline P19 revalidée au niveau logique : **7885 + 5374 tests verts**.

## 6. Défauts trouvés & corrigés en cours de route (honnêteté)

1. **Court-circuit trop large** : « C'est quoi Pierre ? » (découverte) était intercepté ⇒ retiré des
   intentions à réponse directe (la découverte garde le chemin groundé, on n'y corrige que le CTA).
2. **Câblage CTA incomplet** (défaut PRODUIT trouvé par le navigateur) : le client rend `relevantLinks`,
   pas `suggestedCTA` ; l'override ne corrigeait que `suggestedCTA` ⇒ la démo pointait `/demo` au lieu
   de `/demo/pierre`. Corrigé : `relevantLinks` mène désormais avec la destination canonique. Preuve
   renforcée (after-proof vérifie `relevantLinks[0]`).
3. **Preuve AVANT faussée** : le test de repro appelait le pipeline déjà corrigé ⇒ réécrit pour mesurer
   le chemin **hérité** intact (1/22, référence → Support).

## 7. Artefacts de preuve (`.c1-8-reopened-proofs/`)

`C18_PURCHASE_PIERRE_BEFORE_PROOF.json` · `C18_PURCHASE_PIERRE_AFTER_PROOF.json` ·
`C18_ADVERSARIAL_240_DIAGNOSTIC.json` · `C18_ROUTE_REFERENCE_PROOF.json` ·
`C18_BROWSER_CAMPAIGN.json` + `C18_BROWSER_CAMPAIGN_SUMMARY.json` · ce rapport.

## 8. Portée / limites (honnête)

Ce bloc certifie le **comportement produit de navigation/CTA de CloneChat**. Il n'autorise ni paiement
réel, ni production (les planchers P10/P14/P15 tiennent). La campagne navigateur tourne en **webpack**,
anonyme, **sans provider réel** (déterministe) et **sans écriture PROD** — le limiteur anonyme réel
(12 msg/5 min) est respecté via un visiteur distinct par lot.
