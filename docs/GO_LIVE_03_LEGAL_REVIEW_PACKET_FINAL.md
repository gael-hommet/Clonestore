# GO-LIVE 03 — Legal Review Packet Final

## Instructions pour le juriste

Ce document constitue le dossier de revue juridique à transmettre à l'avocat ou juriste spécialisé
avant tout lancement commercial public de CloneStore / Pierre.

**Aucune page légale ne doit être considérée comme finale sans validation de ce juriste.**

---

## Contexte du produit

**Produit :** Pierre — Poste RH opérationnel automatisé
**Éditeur :** CloneStore (informations société à compléter par Gaël — voir section ci-dessous)
**Prix :** 449 € / mois (abonnement mensuel récurrent — carte bancaire requise)
**Période d'essai :** 7 jours avec carte (non open-bar, accès production uniquement avec validation)
**Public cible :** PME françaises (B2B)
**Territoire :** France, avec données hébergées (Vercel + Supabase)

---

## Pages légales à relire

### 1. CGU — Conditions Générales d'Utilisation
**URL :** `/legal/cgu`
**Fichier :** `src/app/legal/cgu/page.tsx`
**Statut :** Draft 1.0 — brouillon, non finalisé
**Points d'attention :**
- Section "Droit applicable" : placeholder à valider juridiquement
- Vérifier la cohérence avec la nature du service IA (brouillons RH, non décisions autonomes)
- Vérifier les limitations de responsabilité (art. L.121-14 et suivants)

### 2. CGV — Conditions Générales de Vente
**URL :** `/legal/cgv`
**Fichier :** `src/app/legal/cgv/page.tsx`
**Statut :** Draft 1.0 — brouillon, non finalisé
**Points d'attention :**
- Prix : 449 € HT/mois — confirmer régime TVA applicable
- Période d'essai 7 jours : vérifier conformité avec droit de rétractation B2B
- Conditions de résiliation et remboursement
- Force majeure et limitations de garantie

### 3. DPA — Data Processing Agreement (Accord de traitement des données)
**URL :** `/legal/dpa`
**Fichier :** `src/app/legal/dpa/page.tsx`
**Statut :** Draft 1.0 — brouillon, non finalisé
**Points d'attention :**
- Pierre en tant que sous-traitant RGPD — vérifier la liste des sous-traitants (OpenAI, Supabase, Vercel, Resend)
- Durées de conservation des données
- Localisation des données (Vercel US + Supabase EU selon configuration)
- Procédures en cas de violation de données (art. 33 RGPD)
- Droits des personnes concernées (salariés des clients)

### 4. Politique de Confidentialité
**URL :** `/legal/confidentialite`
**Fichier :** `src/app/legal/confidentialite/page.tsx`
**Statut :** Draft 1.0 — brouillon, non finalisé
**Points d'attention :**
- Cookies et trackers (analytics, etc.)
- Droits RGPD des utilisateurs (accès, rectification, suppression, portabilité)
- Transferts hors UE (OpenAI US, Vercel US)
- Délais de réponse aux demandes

### 5. Mentions Légales
**URL :** `/legal/mentions`
**Fichier :** `src/app/legal/mentions/page.tsx`
**Statut :** Draft 1.0 — CHAMPS SOCIÉTÉ MANQUANTS
**Points d'attention :**
- Tous les champs société doivent être complétés par Gaël avant transmission au juriste
- Vérifier conformité avec art. 6 LCEN (loi pour la confiance en l'économie numérique)
- Directeur de publication : personne physique responsable

---

## Informations société (à compléter par Gaël avant transmission)

| Champ | Statut | Valeur |
|---|---|---|
| Dénomination sociale | À compléter | — |
| Forme juridique | À compléter | — |
| Capital social | À compléter | — |
| SIREN/SIRET/RCS | À compléter | — |
| Adresse siège social | À compléter | — |
| Directeur de publication | À compléter | — |
| Email contact officiel | À compléter | — |
| Email protection données | À compléter | — |
| Hébergeur (nom + adresse) | À compléter | Vercel / Railway |
| TVA intracommunautaire | À compléter | — |
| Juridiction applicable | À valider juriste | — |

---

## Points juridiques spécifiques à valider

### IA et responsabilité
- [ ] Vérifier que le copy public ne contient aucune promesse de résultat garanti
- [ ] Confirmer que les disclaimers "validation humaine obligatoire" sont suffisants
- [ ] Valider que la qualification de Pierre ("assistant IA") est correcte juridiquement
- [ ] Vérifier l'absence de pratiques commerciales trompeuses (art. L.121-2 Code de la Consommation)

### Données personnelles (RGPD)
- [ ] Confirmer la légalité de traitement des données RH des salariés des clients
- [ ] Valider les bases légales de traitement (contrat, intérêt légitime, etc.)
- [ ] Vérifier la conformité des transferts de données hors UE (OpenAI, Vercel)
- [ ] Confirmer que le DPA est suffisant pour qualifier Pierre de sous-traitant

### Droit de la consommation (B2B)
- [ ] Vérifier si le droit de rétractation B2C s'applique ou non (contexte B2B)
- [ ] Confirmer les conditions de résiliation (préavis, remboursement)
- [ ] Valider la clause de force majeure

### Droit du travail (risque spécifique)
- [ ] Confirmer que Pierre ne peut pas être qualifié de "logiciel de paie" au sens légal
- [ ] Valider que les disclaimers DSN/bulletins de paie sont suffisamment clairs
- [ ] Vérifier l'absence de risque de requalification en conseil juridique non autorisé

---

## Ce que le juriste doit fournir

1. **Avis écrit** sur la conformité globale du package légal
2. **Liste des corrections** obligatoires avant publication
3. **Validation** de la juridiction applicable et du droit applicable
4. **Confirmation** que les disclaimers IA sont suffisants
5. **Recommandations** sur la gestion des données RGPD

---

## Proof IDs dépendant de cette revue

Après validation juridique complète :
- `LEGAL_CGU_VALIDATED` — après validation CGU par juriste
- `LEGAL_CGV_VALIDATED` — après validation CGV par juriste
- `LEGAL_DPA_VALIDATED` — après validation DPA par juriste
- `LEGAL_PRIVACY_VALIDATED` — après validation politique confidentialité par juriste
- `LEGAL_MENTIONS_VALIDATED` — après complétion infos société + validation mentions
- `LEGAL_HUMAN_REVIEW_COMPLETED` — après confirmation écrite du juriste sur l'ensemble

Ces 6 proof IDs ne peuvent JAMAIS être marqués `verified` automatiquement par un script.

---

## Ressources

- Fichier infos société à compléter : `docs/GO_LIVE_03_GAEL_LEGAL_INFO_TO_FILL.md`
- Scan public copy : `node scripts/legal-public-copy-scan.mjs`
- Evidence d'audit : `go-live-evidence/legal-public-copy/legal-public-copy-scan.txt`
- Proofs de lancement : `go-live-proofs.local.json` (git-ignoré)

---

*Document confidentiel — usage interne CloneStore*
*Ne constitue pas un avis juridique.*
*Validation par avocat ou juriste agréé obligatoire avant lancement public.*
