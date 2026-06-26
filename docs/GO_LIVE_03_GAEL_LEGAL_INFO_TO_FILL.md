# GO-LIVE 03 — Informations Société à Renseigner (Action Gaël)

## Instructions

Ce document liste les 11 champs à compléter dans `/legal/mentions` avant lancement public.
**Ne pas inventer ces informations.** Les obtenir auprès du greffe, de l'expert-comptable, ou de l'avocat.

Après avoir complété chaque champ dans `src/app/legal/mentions/page.tsx`, lancer :
```
node scripts/legal-public-copy-scan.mjs
```
pour vérifier que les placeholders ont disparu.

---

## Champs à compléter

### 1. Dénomination sociale (`company_name`)

**Description :** Nom officiel de la société tel qu'enregistré au RCS.
**Exemple :** CloneStore SAS
**Où :** En-tête des mentions légales, section "Éditeur du site"
**Placeholder actuel :** "Placeholder — à compléter"

---

### 2. Forme juridique (`legal_form`)

**Description :** Statut juridique de la société.
**Exemple :** SAS (Société par Actions Simplifiée), SASU, Auto-entrepreneur, EURL...
**Où :** Section "Éditeur du site"
**Placeholder actuel :** "À renseigner"

---

### 3. Capital social (`capital`)

**Description :** Montant du capital social en euros (si applicable selon la forme juridique).
**Exemple :** Capital social de 10 000 €
**Où :** Section "Éditeur du site"
**Note :** Peut être "non applicable" pour auto-entrepreneur

---

### 4. SIREN / SIRET / RCS (`siren`)

**Description :** Numéro d'immatriculation au Registre du Commerce et des Sociétés.
**Exemple :** SIREN : 123 456 789 — RCS Paris
**Où :** Section "Éditeur du site"
**Placeholder actuel :** "À renseigner"
**Obtenir :** infogreffe.fr ou directement au greffe de votre tribunal de commerce

---

### 5. Adresse siège social (`address`)

**Description :** Adresse complète du siège social (rue, code postal, ville, pays).
**Exemple :** 15 rue de la Paix, 75001 Paris, France
**Où :** Section "Éditeur du site"
**Placeholder actuel :** "À renseigner"

---

### 6. Directeur de la publication (`publication_director`)

**Description :** Nom et prénom de la personne responsable de la publication du site.
**Exemple :** Gaël Hommet, Président
**Où :** Section "Directeur de la publication"
**Placeholder actuel :** "À renseigner"
**Note :** Généralement le représentant légal de la société

---

### 7. Email de contact officiel (`contact_email`)

**Description :** Adresse email officielle pour les contacts légaux et commerciaux.
**Exemple :** contact@clonestore.fr
**Où :** Section "Contact" et pied de page des mentions
**Placeholder actuel :** "À renseigner"

---

### 8. Email protection des données (`privacy_email`)

**Description :** Adresse email dédiée aux demandes RGPD (droit d'accès, suppression, portabilité).
**Exemple :** dpo@clonestore.fr ou privacy@clonestore.fr
**Où :** Page confidentialité, section "Vos droits"
**Note :** Peut être le même que contact_email si pas de DPO désigné

---

### 9. Hébergeur (`hosting_provider`)

**Description :** Nom et adresse de l'hébergeur du site web.
**Exemple :**
```
Vercel Inc.
440 N Barranca Ave #4133
Covina, CA 91723, États-Unis
https://vercel.com
```
**Où :** Section "Hébergement"
**Placeholder actuel :** "À préciser"
**Note :** Si utilisation de Railway pour le backend : ajouter aussi Railway's address

---

### 10. TVA intracommunautaire (`vat_number`)

**Description :** Numéro de TVA intracommunautaire (si applicable).
**Exemple :** FR 12 123456789
**Où :** Section "Informations fiscales"
**Note :** Non applicable pour auto-entrepreneur sous seuil de franchise. À vérifier avec expert-comptable.

---

### 11. Juridiction applicable (`applicable_law`)

**Description :** Droit applicable et juridiction compétente en cas de litige.
**Exemple :** Droit français — Tribunal compétent : Tribunal de Commerce de Paris
**Où :** Section "Droit applicable et juridiction"
**Placeholder actuel :** "Placeholder à valider juridiquement"
**IMPORTANT :** À valider absolument par un juriste avant publication

---

## Checklist de complétion

- [ ] Dénomination sociale renseignée
- [ ] Forme juridique renseignée
- [ ] Capital social renseigné (ou "non applicable" justifié)
- [ ] SIREN/SIRET/RCS renseigné
- [ ] Adresse siège social renseignée
- [ ] Directeur de publication renseigné
- [ ] Email contact renseigné
- [ ] Email protection données renseigné
- [ ] Hébergeur renseigné (Vercel + Railway si applicable)
- [ ] TVA renseignée (ou "non applicable" justifié)
- [ ] Juridiction applicable validée par juriste

---

## Après complétion

1. Lancer `node scripts/legal-public-copy-scan.mjs` — vérifier que `missingEntityFields = 0`
2. Faire relire l'ensemble des mentions par un juriste
3. Marquer `LEGAL_ENTITY_INFO_COMPLETED` et `LEGAL_MENTIONS_VALIDATED` dans `go-live-proofs.local.json`
4. Ne jamais marquer `LEGAL_HUMAN_REVIEW_COMPLETED` sans confirmation d'un avocat

---

*Ce document est un aide-mémoire opérationnel, pas un avis juridique.*
*Validation juridique humaine obligatoire avant toute publication commerciale.*
