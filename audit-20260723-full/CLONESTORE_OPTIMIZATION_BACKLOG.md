# CloneStore — Backlog d'optimisation (classé, non exécuté)

Backlog dérivé de CLONESTORE_ISSUE_REGISTER.md. Aucun correctif n'a été appliqué. "Effort" est une estimation qualitative (S/M/L/XL), pas un chiffrage d'ingénierie précis.

## P0 — Bloquant (avant toute amplification commerciale)

| # | Élément | Effort | Impact | Risque si ignoré | Dépendances | Métrique affectée |
|---|---|---|---|---|---|---|
| 1 | ~~Universaliser la gouvernance CloneGuard sur `/api/pierre/execute` (ISSUE-01)~~ **FAIT 2026-07-23**, régressé silencieusement (jamais commité, écrasé par un chantier externe), **RE-FAIT ET VÉRIFIÉ 2026-07-24 (ISSUE-40, bloc P0.1 re-closure)** — `evaluateLegacyExecuteGovernance` réintégré, connecteur Make direct retiré entièrement, 18/18+15/15+5611/5613 tests verts | M | Élimine une contradiction directe avec la promesse de confiance du produit | ~~Un email/document/appel HRIS part réellement sans validation humaine sur ce chemin~~ Résolu — voir `P0_1_EXECUTE_ROUTE_GOVERNANCE_RECLOSURE_REPORT.md` | — | Confiance produit, conformité RH |
| 1bis | ~~Appliquer le même correctif à `/api/pierre/action` et `/api/router` (ISSUE-38/39)~~ **FAIT 2026-07-23 (bloc P0.2), reconfirmé 2026-07-24** — `/api/pierre/action` importe correctement `legacy-execute-governance.ts` (vérifié par lecture directe du code) — voir `P0_2_SIBLING_SURFACES_CLOSURE_REPORT.md` | M | Ferme les 2 dernières surfaces de contournement connues | ~~Même risque qu'ISSUE-01~~ Résolu pour ces 2 routes spécifiquement | — | Confiance produit, conformité RH |
| 1ter | Si `/api/pierre/action` s'avère avoir un vrai appelant self-service (génération de document), construire un chemin d'approbation dédié plutôt que de laisser `doc.generate` bloqué indéfiniment (P0_2_REMAINING_EXECUTION_RISKS.md RISQUE-1) | M | Évite de casser silencieusement une fonctionnalité si elle est réellement utilisée | Blocage permanent sans mécanisme d'approbation existant pour ce chemin | Confirmer d'abord l'existence d'un appelant réel | UX self-service documents |
| 1quater | ~~Ouvrir un bloc dédié et autorisé pour re-fermer réellement `/api/pierre/execute` (ISSUE-40)~~ **FAIT 2026-07-24 (bloc P0.1 EXECUTE ROUTE GOVERNANCE RE-CLOSURE)** — `legacy-execute-governance.ts` réimporté (module existant réutilisé, aucun second créé), `email.send`/`doc.generate`/`hris.sync` gatés, connecteur Make direct retiré entièrement plutôt que laissé comme code mort | M | Ferme un contournement de gouvernance actif et vérifié en production | ~~Emails/documents/synchronisations HRIS partent aujourd'hui sans aucune validation humaine sur ce chemin legacy~~ Résolu | — | Confiance produit, conformité RH |

## P1 — Critique (avant d'investir en acquisition payante)

| # | Élément | Effort | Impact | Risque si ignoré | Dépendances | Métrique affectée |
|---|---|---|---|---|---|---|
| 2 | ~~Câbler le `onClick` de `CountryPricingCard` (ISSUE-02)~~ **FAIT 2026-07-24** | S | Débloque la conversion CH directe | ~~Perte silencieuse de prospects prêts à payer~~ Résolu | — | Taux de conversion Suisse |
| 3 | ~~Diagnostiquer et corriger le 500 sur `/paiement` (ISSUE-03)~~ **FAIT 2026-07-24** — requalifié artefact d'environnement dev, non reproductible en production | S-M | Sécurise l'étape la plus critique du funnel | ~~Abandon panier sur erreur générique~~ Résolu | — | Taux d'achèvement paiement |
| 4 | ~~Corriger l'hydratation React du calculateur `/demo` (ISSUE-04)~~ **MITIGÉ 2026-07-24** — cause externe hautement probable, `suppressHydrationWarning` ciblé + testé | S | Fiabilise l'outil interactif central de la démo | Divergence visuelle/comportementale silencieuse | Aucune | Complétion démo |
| 5 | Réparer ou retirer le pipeline `/api/pierre/run`→`/api/pierre/generate` (ISSUE-05) | M | Clarifie si ce chemin est du code mort ou un vrai defect à corriger | Confusion de maintenance, échec systématique si appelé | Déterminer les appelants réels | Fiabilité API interne |
| 6 | Faire passer `/api/pierre/generate` par CloneGuard/gouvernance (ISSUE-06) | M | Aligne la génération de documents IA avec le reste du moteur documentaire | Documents générés sans garde-fou de contenu | Aucune | Qualité/sécurité des documents |
| 7 | Décider d'une gouvernance canonique unique et la brancher sur le pipeline mission/tâche principal (ISSUE-07) | L | Réduit un risque structurel de divergence de règles RH | Deux implémentations peuvent un jour diverger silencieusement | Migration progressive, tests de non-régression | Fiabilité des floors RH |
| 8 | ~~Faire valider juridiquement les 5 pages légales avant toute promotion à grande échelle (ISSUE-08, 09)~~ **PRÉPARÉ 2026-07-24** — 13 livrables de cartographie/registre produits (`LEGAL_AND_COMMERCIAL_TRUST_CLOSURE_REPORT.md` et annexes), checkbox d'acceptation + footer complété côté code ; la validation elle-même reste XL et dépend d'un tiers | XL (dépend d'un tiers) | Ferme le risque juridique/LCEN le plus visible | Non-conformité LCEN active (mentions légales avec placeholders publiés) — inchangé, action propriétaire toujours requise | Conseil juridique externe + `OWNER_LEGAL_INPUT_REQUIRED.md` (20 actions) | Conformité, confiance |
| 9 | Remplacer `npm run test` par un run réellement exhaustif en CI, ou documenter honnêtement la couverture (ISSUE-10) | M | Élimine un risque de faux-vert CI | 71,5% des fichiers de test jamais exécutés par confiance | Temps CI (547 fichiers vs 156) | Fiabilité du gate CI |
| 10 | Réparer `.gitignore`/`eslint.config.mjs` pour exclure `.next-*/**` et `*-proofs/**` du lint (ISSUE-11) | S | Rend `npm run lint` de nouveau utilisable | Lint ignoré/jamais exécuté en pratique | Aucune | Qualité de code, adoption du gate lint |
| 11 | Ajouter un wrapper serveur à la homepage pour permettre `generateMetadata`, ou déplacer le SEO dans un layout dédié (ISSUE-12) | M | Débloque le SEO de la page la plus commercialement critique | Titre/description génériques sur la page la plus importante | Refactor du composant client | Référencement, CTR recherche |
| 12 | Ajouter `sitemap.ts` + `robots.ts` (ISSUE-13) | S | Découvrabilité de base | Dépendance totale au crawl organique | Aucune | Indexation |
| 13 | Ajouter `metadata` sur les 54 pages qui en manquent, en priorité pages légales + `/questions` + `/checkout` (ISSUE-14) | M | Referencement différencié par page | Contenu dupliqué perçu par les moteurs | Un helper `buildPageMetadata` réduirait l'effort récurrent | Référencement |
| 14 | Documenter/décider du sort du pipeline conversion BLOC3 (implémenter le backend Postgres ou retirer la promesse d'attribution) (ISSUE-15) | L | Clarifie si le programme d'attribution marketing est vendable tel quel | Attribution de campagne silencieusement nulle en prod | Décision produit (garder LeadForge ou pas) | Attribution marketing |
| 15 | Corriger le piège Tab dans `AppShell.tsx` (tiroir mobile du produit authentifié) (ISSUE-16) | S-M | Accessibilité clavier réelle sur toute la navigation mobile connectée | Utilisateurs clavier/lecteur d'écran piégés hors du contenu | Le correctif existe déjà ailleurs dans le repo (à répliquer) | Accessibilité |

## P2 — Important

| # | Élément | Effort | Impact |
|---|---|---|---|
| 16 | Redacter les messages d'erreur bruts sur les ~31 fichiers API legacy (ISSUE-17) | M | Réduit la fuite d'informations internes |
| 17 | Déplacer l'URL Make.com de `/api/router` en variable d'env + moderniser l'auth token (ISSUE-18) | S-M | Réduit le risque de secret committé + auth faible |
| 18 | Ajouter vérification d'abonnement + rate limit sur `/api/pierre/generate` (ISSUE-19) | S | Élimine un risque d'abus de coût OpenAI |
| 19 | Ajouter noindex + garde d'accès sur `/test-pierre` au niveau API, pas seulement page (ISSUE-20) | S | Ferme un chemin de coût/fuite non intentionnel |
| 20 | ~~Activer et brancher réellement le moteur de tarification pays sur `/checkout` (ISSUE-21)~~ **FAIT 2026-07-24** | L | Cohérence tarifaire pays réellement appliquée à l'achat |
| 21 | Aligner la garde anti-misconfig clé-live sur la vérification prix/devise (ISSUE-22) | S | Ferme un risque de facturation incorrecte en environnement mal configuré |
| 22 | Supprimer ou restaurer `error.bak.tsx` → `error.tsx` (ISSUE-23) | XS | Restaure une UI d'erreur applicative dédiée |
| 23 | Décider du sort de la route `/api/assistant` nue (retirer ou documenter comme intentionnelle) (ISSUE-24) | S | Réduit un risque de réponse divergente silencieuse |
| 24 | Synchroniser/documenter les deux configs modèle CloneChat, vérifier l'existence réelle du modèle public (ISSUE-25) | M | Fiabilise la qualité de réponse anonyme |
| 25 | Brancher `public-output-guard` sur le pipeline C1.9 avant toute activation (ISSUE-26) | M | Empêche une fuite de jargon interne si C1.9 est activé un jour |
| 26 | Ajouter un bandeau de consentement cookies cohérent avec la politique affichée (ISSUE-27) — **décision préalable DPO/avocat requise 2026-07-24** (bandeau complet vs. cookies exemptés), voir `COOKIE_AND_TRACKER_INVENTORY.md` | M | Conformité déclarative |
| 27 | Ajouter les liens légaux au footer/header (ISSUE-28) | XS | Accessibilité de l'information légale obligatoire |
| 28 | Aligner la page Confidentialité sur le même composant partagé que les autres pages légales (ISSUE-29) | S | Cohérence de présentation du statut "brouillon" |
| 29 | Confirmer que "CloneContinuum" est retiré du discours démo tant qu'il n'existe pas dans le moteur Pierre, ou l'implémenter (ISSUE-33) | M (discours) / L (implémentation) | Aligne promesse marketing et réalité produit |

## P3 — Amélioration

| # | Élément | Effort |
|---|---|---|
| 30 | Étendre la couche sécurité B41 (route-guard centralisé) au-delà de 3 routes | XL |
| 31 | Câbler un vrai scanner antivirus (ClamAV réel) ou documenter clairement l'absence | M |
| 32 | Ajouter une garde edge (middleware) sur `/profile/**` | S |
| 33 | Nettoyer les 23-24 dossiers `.next-*` + 92 dossiers `*-proofs` (hygiène de repo) | S (mécanique) |
| 34 | Passer les redirections de fiches produit retirées de 307 à 308 | XS |
| 35 | Consolider les 3 systèmes de redirection courte (`/p`, `/r`, `/partenaires/r`) ou documenter pourquoi ils restent séparés | M |
| 36 | Renommer `/healt` en `/health` (ou documenter volontairement) et unifier les 3 surfaces "health" | XS-S |
| 37 | Ajouter Open Graph + `metadataBase` + JSON-LD Product/FAQPage | M |
| 38 | Ajouter `eslint-plugin-jsx-a11y` pour prévenir les régressions d'accessibilité | S |

## P4 — Futur

- Consolider les 173 fichiers `.md` de rapport en une documentation d'architecture unique.
- Réduire les 250+ scripts npm nommés par phase historique.
- Retirer les fichiers scratch orphelins à la racine (`scratch_probe*.mjs`, `on`, `glob-result*.txt`...).
- Retirer la dépendance `tw-animate-css` (jamais importée).
- Consolider les 14 fichiers `playwright.*.config.ts`.

## Ordre recommandé

1. **P0/P1 rapides et sans dépendance externe d'abord** (#2, #3, #4, #10, #12, #22 — tous S/XS, corrigent des bugs déjà reproduits ou confirmés).
2. **P0/P1 nécessitant une décision produit** (#1, #5, #7, #15, #20, #29) — arbitrage avant implémentation.
3. **P1 à dépendance externe** (#8, validation juridique) — à lancer en parallèle immédiatement car le délai est hors du contrôle de l'équipe technique.
4. **P2 de sécurité/coût** (#17, #18, #19, #21) avant toute amplification de trafic.
5. Le reste (P2 restants, P3, P4) au fil de l'eau.
