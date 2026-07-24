# Legal and Commercial Trust Closure — Remaining Risks

Only genuinely open items. Nothing here should be read as "must be fixed by code" — most require an owner action or a professional review, not a further code change.

## RISQUE-1 — Aucune identité légale publiée (BLOQUANT pour toute publication)
Les 7 champs d'identité (dénomination, forme juridique, adresse, SIREN/SIRET, directeur de publication, email de contact, hébergeur) restent des placeholders. Confirmé par 3 méthodes indépendantes (grep repo, lecture des pages, `legal-public-copy-scan.mjs`). **Bloque `/legal/mentions` et, par ricochet, la validité de toutes les autres pages légales qui en dépendent (juridiction applicable, contact DPO).** Action : `OWNER_LEGAL_INPUT_REQUIRED.md`.

## RISQUE-2 — Incohérence factuelle dans le DPA (sous-traitant IA)
`/legal/dpa` §7 nomme "Anthropic PBC" comme sous-traitant IA ; le code confirme qu'OpenAI est le seul fournisseur LLM réellement appelé. Cette liste doit être corrigée avant toute validation juridique du DPA — c'est une correction factuelle simple mais elle touche une page légale marquée Draft, donc laissée pour l'owner/juriste plutôt que corrigée isolément dans ce bloc technique.

## RISQUE-3 — Modèle B2B non techniquement garanti
`/signup` reste ouvert à toute personne physique (aucune exigence d'entreprise, aucune case "j'agis à titre professionnel"). Tant que ce n'est pas corrigé, FR/BE/LU/CH doivent être traités comme potentiellement B2C, ce qui active droit de la consommation, médiation, et possiblement DSA. Ce bloc n'a pas implémenté de garde B2B (décision produit hors périmètre technique de ce bloc — nécessite un arbitrage produit/juridique préalable sur qui peut acheter Pierre).

## RISQUE-4 — Consentement cookies non tranché
Deux cookies (`cs_pp_ref` 90 jours, `cs_conversion_session` 7 jours) servent une finalité commerciale (attribution de commission, campagne marketing), pas uniquement une mesure d'audience strictement exemptée. La CNIL a sanctionné 21 entités en 2025 pour ~32M€ sur ce sujet précis (source officielle vérifiée dans ce bloc). Aucun bandeau n'a été créé — la décision (bandeau complet vs exemption) doit venir d'un DPO/avocat, pas être devinée. Voir `COOKIE_AND_TRACKER_INVENTORY.md`.

## RISQUE-5 — Revue juridique humaine jamais effectuée (les 5 pages légales)
CGU, CGV, Confidentialité, DPA, Mentions sont toutes encore au stade "Draft 1.0" — structurellement complètes selon l'audit de ce bloc, jamais relues par un avocat. Aucun contenu de ce bloc ne doit être interprété comme une validation juridique.

## RISQUE-6 — Analyse AI Act non certifiée
La date de conformité Annexe III (systèmes RH à haut risque) est le 2026-08-02 selon le texte officiel consulté dans ce bloc. Les planchers "human-only" codés (4 dans le canon de capacités + 3 couches de gouvernance redondantes) sont une preuve d'atténuation forte, mais ne remplacent pas la certification par un praticien AI Act qualifié. Voir `AI_ACT_AND_HR_RISK_MATRIX.md`.

## RISQUE-7 — Fiscalité/TVA non tranchée
Aucun calcul ni collecte de TVA n'existe dans le parcours d'achat pour aucun des 4 pays ; Stripe Tax n'est pas configuré ; le numéro de TVA client n'est jamais collecté. L'affichage actuel ("HT, taxes applicables en sus") reste honnête tant qu'aucune TVA n'est prétendue incluse, mais ne constitue pas une solution de facturation conforme prête pour la vente réelle. Voir `TAX_AND_PRICE_DISCLOSURE_MATRIX.md`.

## RISQUE-8 — Persistance de l'acceptation partenaires (CloneStory) non couverte
Le flux `/founding-partners/join` a une case à cocher réelle et obligatoire mais ne persiste jamais l'acceptation (pas de version/date enregistrée côté serveur) — contrairement au programme partenaires standard (`clonestore_pp_partners.contract_accepted_at`) qui fait référence. Non corrigé dans ce bloc : périmètre CloneStory distinct, risque de casser un autre chantier actif sans connaître son architecture en détail (cf. mémoire projet : "workstream partenaire actif").

## RISQUE-9 — "Garanties" wording sur une page authentifiée
`src/app/profile/technologies/page.tsx:350` — "Gouvernance et sécurité garanties par CloneStore" — utilise un vocabulaire qui serait interdit s'il était public. Page derrière authentification, hors périmètre "pages publiques" de ce bloc, mais à corriger dans un futur passage de copie.

## RISQUE-10 — ~~Build de production isolé non conclu~~ **FERMÉ** — succès réel confirmé
Cause racine identifiée et corrigée : un worker de build Next.js orphelin de la tentative précédente n'avait jamais quitté le système, consommant ~5,78 Go de RAM (137 Mo libres au total). Une fois ce processus arrêté (mémoire remontée à ~6,1 Go libres), une 4ᵉ tentative isolée, seule (aucun outil en parallèle), a **réussi intégralement** : compilation en 2,7s, build complet en 30,3min, **196/196 pages statiques générées**, `BUILD_ID=-3eJ-j4YWNesXfmF1Fcql`, code de sortie réel `0`, les 10 routes cibles confirmées dans le bundle, aucun secret dans le log. Les 3 échecs précédents étaient **100% environnementaux**, jamais un défaut de code. Preuve complète : `CLONESTORE_AUDIT_EVIDENCE/legal-commercial-trust-closure/build-final-result.txt`.

## Ce qui N'EST PAS un risque ouvert (pour éviter tout doute)
- Aucun secret n'a été exposé dans les 21 fichiers créés par ce bloc.
- `PRODUCTION_AUTHORIZED` reste `false as const`, reconfirmé inchangé.
- Aucun fichier P0.1/P0.2/CloneGuard/moteur v1-hr/pricing canonique/Price ID/webhook n'a été touché.
- Aucun fichier homepage/démo n'a été touché — y compris le "24/7" identifié comme finding (documenté, non corrigé, par respect strict de la protection homepage de ce bloc).
- Les 846 tests de non-régression exécutés (376+470) sont tous verts.
