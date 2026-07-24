# CLONESTORE — AUDIT COMPLET

**Date** : 2026-07-23. **Portée** : audit factuel complet, aucune modification produit, aucune refonte proposée. **Méthode** : lecture de code exhaustive (11 agents parallèles + lecture manuelle), exécution réelle de validations (tsc, eslint, build, dev server), navigation réelle en navigateur (Playwright, desktop + 3 largeurs mobiles/tablette), simulations de parcours utilisateurs.

Documents compagnons : `CLONESTORE_ROUTE_INVENTORY.md`, `CLONESTORE_FUNNEL_AUDIT.md`, `CLONESTORE_MOBILE_AUDIT.md`, `CLONESTORE_TECHNICAL_AUDIT.md`, `CLONESTORE_PIERRE_AUDIT.md`, `CLONESTORE_LAUNCH_READINESS.md`, `CLONESTORE_ISSUE_REGISTER.md`, `CLONESTORE_OPTIMIZATION_BACKLOG.md`, `CLONESTORE_AUDIT_EVIDENCE/`.

**Note de continuité** : cet audit a été mené en deux temps dans la même session. Entre les deux, le serveur d'automatisation navigateur (Playwright MCP) s'est déconnecté sans reconnexion possible — les vérifications navigateur restantes (viewport Android, tests d'interaction : double-clic, retour, rafraîchissement) ont donc été remplacées par des vérifications HTTP brutes (curl) quand c'était possible, et marquées explicitement **NON TESTÉ** sinon, plutôt que supposées bonnes. Le build de production, lui, a pu être re-testé en isolation et **a réussi intégralement** (voir §9).

---

## 1. Résumé exécutif

CloneStore est un produit **beaucoup plus construit que ce que son état de préparation au lancement laisse penser**. Le cœur technique — moteur RH Pierre (missions, documents, Employee 360), pipeline de paiement Stripe, RLS multi-tenant, CloneChat avec vrais appels OpenAI — est réel, substantiel, et pour l'essentiel fail-closed par construction. Ce n'est pas un prototype qui simule.

Mais l'audit a trouvé, **en conditions réelles** (pas seulement en lecture de code) :
- Un **bouton d'achat mort** sur la page produit Pierre pour les visiteurs suisses (`ISSUE-02`).
- Une **erreur 500 reproduite en direct** sur la page de paiement (`ISSUE-03`).
- Un **bug d'hydratation React confirmé** sur l'outil interactif central de la démo (`ISSUE-04`) — **investigué en profondeur le 2026-07-24** : cause applicative non retrouvée après recherche exhaustive, cause externe (extension navigateur) hautement probable, mitigation ciblée testée. Voir `DEMO_HYDRATION_ROOT_CAUSE_REPORT.md`.
- **Découverte critique du 2026-07-24, FERMÉE le même jour (bloc P0.1 EXECUTE ROUTE GOVERNANCE RE-CLOSURE)** : `/api/pierre/execute` s'était retrouvé sans aucune évaluation de gouvernance — cause établie par forensique Git (un correctif réel du 2026-07-23 n'avait jamais été commité et a été écrasé sur disque par un chantier externe concurrent), re-fermé et vérifié (18/18+15/15+5611/5613 tests verts) — voir `ISSUE-40`, `P0_1_EXECUTE_ROUTE_GOVERNANCE_RECLOSURE_REPORT.md`, `P0_1_GIT_FORENSIC_TIMELINE.md`.
- Une **règle de sécurité RH ("un email n'est jamais auto-exécuté")** qui n'était pas universelle sur cette route legacy — restaurée par le même correctif (`ISSUE-01`, P0, re-fermé 2026-07-24).
- Les **5 pages légales sont des brouillons non validés**, avec des mentions légales contenant des placeholders non remplis, alors que le site encaisse déjà des paiements (mode test) (`ISSUE-08`, `ISSUE-09`) — **fermeture technique partielle le 2026-07-24** (bloc LEGAL AND COMMERCIAL TRUST CLOSURE) : cases d'acceptation CGV/confidentialité au checkout, liens légaux complets au footer, cohérence corrigée sur `/legal/confidentialite` ; l'identité juridique elle-même reste manquante et la revue juridique humaine n'a jamais eu lieu — voir `LEGAL_AND_COMMERCIAL_TRUST_CLOSURE_REPORT.md`.
- `npm run lint` retourne **545 890 problèmes** à cause d'une config cassée — la commande est aujourd'hui inutilisable, alors que le vrai code source est propre (80 erreurs réelles sur ~4000 fichiers).
- Le site n'a **aucun sitemap, aucun robots.txt**, et 64% des pages n'ont pas de metadata SEO propre.

Rien de tout cela n'est catastrophique isolément. Ensemble, ils dessinent un produit **techniquement plus mûr que son emballage de mise en marché** — le moteur est prêt à un niveau que la surface commerciale (paiement, SEO, légal, démo) ne reflète pas encore.

## 2. Forces

- Moteur Pierre v1/hr : idempotence, isolation tenant, floors human-only réellement câblés dans le chemin d'exécution principal, documents avec intégrité SHA-256, onboarding serveur-authoritatif.
- Paiement : hard floor `PRODUCTION_AUTHORIZED=false` réellement câblé (bloque le live indépendamment de la config env), signature webhook Stripe obligatoire à deux secrets, anti-double-crédit de commission partenaire.
- CloneChat : vrais appels OpenAI confirmés (pas une façade), repli déterministe honnêtement étiqueté (jamais maquillé), kill-switch fail-closed.
- Sécurité : aucun secret réel en dur trouvé, RLS Supabase bien présente, aucune policy permissive.
- Transparence produit : les limites de Pierre (pas de licenciement autonome, pas de paie officielle, pas d'email autonome) sont divulguées de façon cohérente à 4 endroits indépendants du site.
- Homepage : promesse claire ("Gagnez du temps et de l'argent"), CTA démo visible au-dessus du pli sur toutes les largeurs testées, prix transparent (449€/499 CHF) affiché tôt.
- Démo : value-shock immédiat dès le premier écran, avec disclaimers honnêtes ("estimation, jamais une garantie").
- Dépendances tierces compactes (23 `dependencies`), aucun doublon, cœur métier très majoritairement first-party.
- `tsc --noEmit` : 0 erreur sur tout le repo.

## 3. Faiblesses et incohérences confirmées

Voir `CLONESTORE_ISSUE_REGISTER.md` pour le détail complet (37 issues cataloguées). Les plus importantes :
- Gouvernance CloneGuard fragmentée en 4 implémentations, la version "canonique" P19 non branchée sur le pipeline principal.
- "CloneContinuum", mis en scène dans la démo, n'existe pas dans le moteur Pierre réel.
- Pipeline d'attribution marketing (BLOC3/LeadForge) inerte en production par absence de backend — documenté par l'équipe elle-même, mais réel.
- Trois architectures d'analytics/funnel parallèles, partiellement redondantes.
- CTA d'achat mort, 500 sur paiement, hydratation cassée sur la démo (voir §1).

## 4. Ce qui bloque la compréhension / la conversion / la confiance

- **Compréhension** : la grille de 10 badges technologiques "Clone*" au milieu de la homepage (et proportionnellement plus longue sur mobile) introduit un jargon propriétaire dense sans explication immédiate — risque de surcharge cognitive avant que le visiteur atteigne le reste du contenu.
- **Conversion** : le CTA d'achat mort sur `/agents/pierre` (Suisse) et le 500 sur `/paiement` sont des points de rupture directs et silencieux dans le funnel d'achat.
- **Confiance** : les pages légales affichées publiquement comme "Draft" (avec des placeholders visibles : SIREN/SIRET non renseignés) sur un site qui facture déjà (mode test) envoient un signal de non-préparation à un visiteur attentif qui les consulterait.

## 5. État mobile

Voir `CLONESTORE_MOBILE_AUDIT.md`. En bref : le CTA démo est visible sans scroll sur 390×844 et 820×1180, à la limite basse sur 375×667. La page mobile fait 10 807px de haut contre 7 250px en desktop — pas une simple mise à l'échelle, un contenu réellement plus long. Balayage limité à la homepage par contrainte de temps ; `/demo`, `/agents/pierre`, `/paiement` **non testés en mobile réel** dans cette session.

## 6. État funnel

Voir `CLONESTORE_FUNNEL_AUDIT.md`. Trois systèmes d'analytics coexistent, un seul (`founder-access`, Postgres réel) est réellement opérant en production. Le dernier maillon "paiement→activation" a une donnée serveur réelle mais n'est représenté dans aucune définition de funnel visible au dashboard. Aucun bandeau de consentement cookies alors qu'un cookie marketing réel est posé.

## 7. État Pierre

Voir `CLONESTORE_PIERRE_AUDIT.md`. Le cœur (missions, documents, Employee 360, onboarding) est réel et robuste. Le défaut le plus important : les règles de sécurité RH ne sont pas universelles (une route legacy les contourne totalement) et la gouvernance est fragmentée en 4 implémentations non unifiées.

## 8. État paiement

Voir `CLONESTORE_TECHNICAL_AUDIT.md` §6 et `CLONESTORE_ISSUE_REGISTER.md`. Le socle (hard floor prod, signature webhook, anti-fraude commission) est solide. Deux défauts confirmés en navigateur réel (CTA mort, 500 transitoire) et un système de tarification pays qui n'est jamais réellement invoqué par le chemin d'achat actif.

## 9. État technique

Voir `CLONESTORE_TECHNICAL_AUDIT.md`. `tsc` propre. `eslint` cassé par une config d'ignore incomplète (545K faux positifs, 80 vrais). `next build` **avait crashé une première fois par OOM sous charge concurrente créée par cet audit** (11 agents + lint + dev server simultanés) — **re-testé en isolation une fois cette charge retombée : succès complet, 196/196 pages statiques, 0 erreur.** L'OOM était donc un artefact de l'audit lui-même, pas un défaut du build (durée de build non fiable pour la même raison de contention/interruption de session, à re-chronométrer proprement). Couverture de test réelle : 28,5% via `npm test`. Dette de repo volumétrique importante (23-24 dossiers `.next-*`, 92 dossiers `*-proofs`, 173 rapports `.md`) mais sans impact fonctionnel direct. Vérification complémentaire post-déconnexion Playwright : `/checkout`, `/reserver/pierre`, `/login`, `/signup`, `/partenaires`, `/legal/cgv` tous HTTP 200, corps HTML substantiel ; une 404 aléatoire retourne une vraie page personnalisée, pas un crash.

**Note d'outillage** : le serveur MCP Playwright s'est déconnecté au milieu de cette session de continuation, sans reconnexion possible. Les tests prévus qui exigeaient un navigateur réel (viewport Android ~412×915, double-clic sur le CTA mort d'`ISSUE-02`, retour navigateur, rafraîchissement, conservation d'état) **n'ont pas pu être exécutés** — indisponibilité d'outillage, pas un choix de priorisation. Marqué NON TESTÉ explicitement partout où c'est pertinent plutôt que supposé bon.

---

## 10. Parcours utilisateurs simulés

**Avertissement du commanditaire respecté : ces simulations ne remplacent pas de vrais tests utilisateurs.** Elles sont construites à partir des preuves réellement observées dans cette session (captures, code, comportements reproduits), pas d'une pure supposition.

### Profil 1 — Dirigeant non technique découvrant CloneStore
- **Objectif** : comprendre en 30 secondes ce que fait le produit.
- **Parcours** : homepage → lit "Gagnez du temps et de l'argent" + sous-titre → voit les 3 badges de confiance (24/7, Traçable, Contrôlé) → clique "Voir la démo Pierre".
- **Blocage** : en scrollant avant de cliquer, tombe sur la grille de 10 technologies "Clone*" non expliquées — jargon qui ne parle pas à un non-technicien.
- **Preuve trouvée** : prix clair (449€/mois), positionnement honnête ("Pierre absorbe une part massive du travail RH opérationnel" — pas "remplace tout").
- **Action finale** : probable clic démo (CTA bien positionné).
- **Confiance** : moyenne-haute. **Probabilité de poursuivre** : haute jusqu'à la démo, incertaine après (voir Profil 5).

### Profil 2 — Responsable RH
- **Objectif** : évaluer si Pierre peut réellement prendre en charge des tâches RH sensibles.
- **Parcours** : homepage → `/agents/pierre` → cherche les limites du produit.
- **Preuve trouvée** : limites divulguées clairement (pas de licenciement/sanction autonome) sur `/agents/pierre`, `/questions`, `/comprendre-clonestore` et les CGU — cohérence remarquée positivement.
- **Blocage** : si ce profil cherche activement les CGV pour évaluer un engagement contractuel, il tombe sur un bandeau "Draft — validation juridique requise" — signal de non-préparation pour un profil qui lit les petites lignes.
- **Confiance** : haute sur le produit, **baisse nette** si les CGV sont consultées.
- **Probabilité de poursuivre** : haute jusqu'à la case légale.

### Profil 3 — Cabinet de recrutement
- **Objectif** : comprendre le programme partenaire/commission.
- **Parcours** : `/partenaires` → lit la commission 20%.
- **Preuve trouvée** : aucun chiffre fabriqué, calculs annotés "estimatifs".
- **Blocage** : aucun observé sur ce chemin dans cette session (page non testée en profondeur — NON TESTÉ pour les détails de calcul).
- **Confiance** : moyenne (contenu honnête mais profondeur non vérifiée ici).

### Profil 4 — Consultant partenaire (Cabinets Fondateurs)
- **Objectif** : évaluer la crédibilité du programme.
- **Parcours** : `/founding-partners` → voit le sceau "SPÉCIMEN" explicitement annoncé.
- **Preuve trouvée** : transparence remarquée (le code affiche explicitement que rien n'est inventé).
- **Confiance** : haute sur l'honnêteté, à condition que le sceau reste visible dans tous les contextes de partage (non re-vérifié ici).

### Profil 5 — Visiteur mobile pressé (le signal "ingénieur qui scrolle sans cliquer")
- **Objectif** : comprendre vite, sur téléphone.
- **Parcours reconstitué** : homepage mobile → CTA démo visible dès l'ouverture → **mais** scrolle quand même à travers 10 807px de contenu, dont la grille de 10 badges techno.
- **Blocage identifié (hypothèse, pas fait confirmé)** : un profil technique/sceptique peut préférer lire et décoder toute la terminologie propriétaire avant de faire confiance à un CTA marketing — ce qui, combiné à une page 50% plus longue que le desktop, maintient ce profil en mode lecture jusqu'à épuisement du scroll, sans jamais cliquer.
- **Action finale observée dans le signal rapporté** : aucune (sortie sans clic démo).
- **Confiance** : incertaine — le produit ne perd pas ce visiteur par un bug, mais possiblement par une longueur/densité de contenu qui entre en tension avec l'intention "rapide" d'un visiteur mobile pressé.

### Profil 6 — Visiteur intéressé mais sceptique
- **Objectif** : chercher des preuves avant de croire la promesse.
- **Parcours** : `/demo` → lit "estimation, jamais une garantie" sur le premier écran → essaie le calculateur de coût.
- **Blocage confirmé** : le calculateur a un bug d'hydratation React réel — un visiteur sceptique qui teste précisément l'interactivité pour "vérifier" est le profil le plus susceptible de remarquer un comportement anormal (curseur qui saute, valeur qui ne correspond pas).
- **Confiance** : baisse au moment du bug, pour un profil déjà en quête de raisons de douter.

### Profil 7 — Utilisateur qui veut seulement comprendre le prix
- **Objectif** : trouver le prix le plus vite possible.
- **Parcours** : homepage (prix visible en milieu de page, "449€ HT / mois") → `/agents/pierre` (tarif par pays, sélecteur FR/BE/LU/Suisse).
- **Preuve trouvée** : prix clair et cohérent entre les pages (449€ EUR, 499 CHF), sauf `/checkout` et `/paiement` qui affichent un prix EUR statique même pour un visiteur suisse.
- **Blocage** : si suisse, le bouton d'achat par pays est mort (Profil 9).
- **Confiance** : haute sur la clarté du prix, jusqu'au clic d'achat pour un non-FR/BE/LU.

### Profil 8 — Utilisateur prêt à tester Pierre
- **Objectif** : voir Pierre "travailler" avant de payer.
- **Parcours** : `/agents/pierre` → clique "Voir Pierre travailler".
- **NON TESTÉ dans cette session** : le contenu réel de cette expérience (au-delà de la démo cinématique déjà auditée) n'a pas été suivi jusqu'au bout — nécessiterait une navigation supplémentaire non réalisée par contrainte de temps.

### Profil 9 — Utilisateur prêt à payer
- **Objectif** : finaliser un abonnement Pierre.
- **Parcours (France/Belgique/Luxembourg)** : `/checkout` → `/paiement` → Stripe (mode test).
- **Blocage confirmé** : 500 reproduit une fois sur deux tentatives directes sur `/paiement` dans cette session (voir `ISSUE-03` — non confirmé comme systématique, possiblement lié au mode dev).
- **Parcours (Suisse)** : `/agents/pierre` → sélectionne Suisse → **bouton d'achat mort, aucune suite possible** par ce chemin (doit trouver un autre CTA de la page qui, lui, ignore le pays sélectionné).
- **Confiance** : haute jusqu'au clic d'achat, **rompue net** pour un visiteur suisse suivant ce chemin précis.
- **Complément** : `/checkout`, `/reserver/pierre`, `/login`, `/signup` confirmés vivants et non cassés au niveau HTTP (200, corps HTML substantiel) dans la deuxième passe de cet audit — mais le rendu réel et l'interactivité de ces pages pour ce persona n'ont pas pu être re-vérifiés en navigateur (outillage Playwright indisponible en fin de session).

---

## 11. Verdict final

### 1. CloneStore est-il techniquement stable ?
**Partiellement — mais plus stable que ne le suggérait le premier essai.** `tsc` est propre, le cœur métier est solide, et `next build` **réussit intégralement une fois testé en isolation** (le crash OOM initial était un artefact de la charge concurrente de l'audit lui-même, pas un défaut du produit). Ce qui reste réellement à corriger : `npm run lint` est cassé (bruit à 99,98%), la couverture de test réelle n'est que de 28,5% via `npm test`, et un 500 a été reproduit en direct sur `/paiement` (non re-confirmé sur un build de production servi, faute d'outillage navigateur disponible jusqu'au bout de cette session).

### 2. Pierre est-il réellement vendable aujourd'hui à 449€/mois ?
**Presque.** Le moteur (missions, documents, Employee 360) est réel et solide. Mais une route legacy contourne totalement la règle "un email n'est jamais auto-exécuté" (P0), la gouvernance est fragmentée, et une technologie mise en scène en démo (CloneContinuum) n'existe pas dans le moteur réel.

### 3. Le site fait-il comprendre la valeur suffisamment vite ?
**Partiellement.** La promesse et le prix sont clairs dès le premier écran. Mais la densité de jargon propriétaire non expliqué (10 technologies "Clone*") en milieu de page peut ralentir la compréhension pour un visiteur non averti.

### 4. Le passage homepage → démo est-il suffisamment évident ?
**Oui**, au sens strict de la visibilité du CTA (confirmé sur 4 largeurs testées, desktop et mobile). **Partiellement** au sens du comportement réel : le signal utilisateur rapporté (scroll complet sans clic) reste plausible pour un profil analytique face à un contenu long et dense — hypothèse, non confirmée par cet audit.

### 5. La démo est-elle assez forte pour convertir du trafic froid ?
**Partiellement.** Le value-shock immédiat et l'honnêteté des disclaimers sont de vrais atouts. Le bug d'hydratation React sur l'outil interactif central est un vrai défaut pour un visiteur qui teste l'interactivité pour se convaincre.

### 6. Le paiement et l'activation sont-ils prêts pour la production ?
**Non**, au sens strict de "prêt à amplifier" : `PRODUCTION_AUTHORIZED=false` bloque explicitement le mode live (choix délibéré, pas un oubli). Au sens fonctionnel du parcours test : **partiellement** — un CTA mort et un 500 reproduit doivent être corrigés avant toute amplification, même en test.

### 7. Le produit est-il prêt pour une amplification mondiale ?
**Non.** Trois blocants concrets s'y opposent en l'état : (a) les pages légales sont des brouillons non validés avec des mentions légales incomplètes, (b) `npm run lint` et la couverture de test réelle (28,5%) ne donnent pas un filet de sécurité CI fiable pour scaler le rythme de changement, (c) le moteur de tarification pays n'est pas réellement branché sur le chemin d'achat actif.

### 8. Les 10 problèmes les plus importants, dans l'ordre exact
1. ~~`/api/pierre/execute` contourne totalement la gouvernance CloneGuard~~ (ISSUE-01, P0) — **fermé 2026-07-23, régressé silencieusement, re-fermé et vérifié 2026-07-24** (bloc P0.1 EXECUTE ROUTE GOVERNANCE RE-CLOSURE).
2. CTA d'achat mort pour la Suisse sur `/agents/pierre` (ISSUE-02).
3. 500 reproduit sur `/paiement` (ISSUE-03).
4. Pages légales non validées juridiquement + mentions légales incomplètes, site déjà facturant (ISSUE-08/09) — **techniquement resserré le 2026-07-24** (checkbox checkout, footer complet), identité juridique et revue avocat toujours manquantes.
5. Gouvernance CloneGuard fragmentée en 4 implémentations non unifiées (ISSUE-07).
6. `npm run lint` inutilisable (config cassée, 545K faux positifs) (ISSUE-11).
7. Couverture de test réelle de 28,5% seulement via `npm test` (ISSUE-10).
8. ~~Hydratation React cassée sur le calculateur de `/demo` (ISSUE-04)~~ — **mitigé 2026-07-24**, cause externe hautement probable, voir `DEMO_HYDRATION_ROOT_CAUSE_REPORT.md`. ~~`/api/pierre/execute` sans gouvernance réelle (ISSUE-40)~~ — **fermé le même jour** (bloc P0.1 re-closure), voir `P0_1_EXECUTE_ROUTE_GOVERNANCE_RECLOSURE_REPORT.md`.
9. Moteur de tarification pays inerte par défaut, `/checkout` n'envoie jamais le pays (ISSUE-21).
10. Aucun sitemap/robots.txt + 64% des pages sans metadata propre (ISSUE-13/14).

### 9. Quelle est la première optimisation à effectuer ensuite ?
**Corriger le CTA d'achat mort (`CountryPricingCard.tsx`) et diagnostiquer le 500 de `/paiement`.** Ce sont les deux points de rupture directs et silencieux les plus proches de la conversion payante, avec l'effort de correction le plus faible (S) pour l'impact le plus immédiat sur le chiffre d'affaires. Lancer en parallèle la validation juridique des pages légales (délai hors du contrôle technique, donc à démarrer immédiatement).

**Mise à jour 2026-07-24** : les deux points ci-dessus sont fermés (`PAYMENT_PATH_CLOSURE_REPORT.md`). Le chantier légal a reçu une fermeture technique dédiée (`LEGAL_AND_COMMERCIAL_TRUST_CLOSURE_REPORT.md`) : ce qui pouvait être corrigé sans inventer d'information l'a été (checkbox d'acceptation, liens footer, cohérence des pages) ; l'identité juridique de l'éditeur et la revue par un avocat restent des actions propriétaire/professionnelles non substituables par du code.

### 10. Que ne faut-il surtout pas modifier ?
- Le moteur v1/hr de Pierre (missions, documents, Employee 360, onboarding) : substantiel, testé, cohérent — ne pas refactoriser sans nécessité.
- Le hard floor `PRODUCTION_AUTHORIZED = false as const` : c'est un garde-fou volontaire, pas un bug.
- L'honnêteté du discours produit (disclaimers "estimation, jamais une garantie", divulgation cohérente des limites de Pierre, sceau "SPÉCIMEN" explicite) : c'est un vrai atout de crédibilité, à préserver tel quel.
- La transparence tarifaire (449€/499 CHF affiché tôt et clairement) : ne pas la masquer derrière un formulaire de contact.
- L'identité visuelle et le positionnement premium : hors périmètre de cet audit, non remis en cause par les constats ci-dessus.
