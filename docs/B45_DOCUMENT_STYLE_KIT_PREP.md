# B45 — Document Style Kit Préparation

**Bloc cible:** B45 (préparation via B38D)  
**Statut:** Contrats prêts — implémentation différée  
**Dépendance amont:** B44 (Empreinte Entreprise finale)  
**Source de vérité:** `src/lib/pierre/quality/pierre-document-style-readiness.ts`

---

## Objectif futur

Permettre à Pierre de **reproduire fidèlement le style documentaire officiel de chaque entreprise cliente** : structure, mise en page, polices, couleurs, en-têtes, pieds de page, logo, formulations officielles.

Pierre ne doit pas générer des PDF génériques. Pierre doit générer des documents qui ressemblent aux vrais documents de l'entreprise — comme si le DRH les avait rédigés lui-même.

---

## Ce que B45 n'est pas encore

B45 n'est pas encore implémenté. Ce document prépare :
- Les types de sources documentaires
- Les exigences de style
- Les comportements attendus
- Les dépendances avec B44 (Empreinte)

---

## Types de documents sources

| Type | Source | Usage |
|---|---|---|
| Fiches de paie | `payslip` | Reproduire structure bulletins officiels |
| Attestations emploi | `employment_certificate` | Template légal conforme |
| Contrats travail | `contract` | CDI, CDD, temps partiel, alternance |
| Avenants | `amendment` | Modifications contractuelles |
| Notes internes | `internal_memo` | Ton et format interne |
| Politiques RH | `HR_policy` | Formulations, ton officiel |
| En-têtes | `letterhead` | Logo, adresse, mentions légales |
| Pieds de page | `footer` | Mentions légales, confidentialité |
| Logo | `logo` | PNG/SVG haute résolution |
| Charte graphique | `brand_guidelines` | Couleurs, polices, espacements |
| Templates tableurs | `spreadsheet_template` | Format export données |

---

## 15 exigences documentées

### Exigences critiques pour lancement

| ID | Label | Bloc | Statut actuel |
|---|---|---|---|
| `official_payslip_samples` | Fiches de paie exemples | B45 | Non démarré |
| `HR_letterhead` | En-tête officiel RH | B45 | Placeholder prêt |
| `certificate_template` | Template attestation | B45 | Contrat prêt |
| `contract_template` | Template contrat | B45 | Non démarré |
| `amendment_template` | Template avenant | B45 | Non démarré |
| `logo_asset` | Logo entreprise | B45 | Non démarré |
| `header_footer_rules` | Règles header/footer | B45 | Contrat prêt |
| `date_number_format_rules` | Format dates/nombres | B44 | Non démarré |
| `approval_stamp_rules` | Règles cachet/signature | B45 | Non démarré |

### Exigences de qualité avancée (non critiques lancement)

| ID | Label | Bloc | Statut actuel |
|---|---|---|---|
| `internal_note_template` | Template note interne | B44 | Non démarré |
| `email_signature` | Signature email | B44 | Placeholder prêt |
| `table_style_rules` | Style tableaux | B45 | Non démarré |
| `typography_rules` | Règles typographiques | B45 | Non démarré |
| `tone_examples` | Exemples de ton | B44 | Non démarré |
| `forbidden_phrasing` | Formulations interdites | B44 | Non démarré |

---

## Comportements attendus (futur B45)

### Fiches de paie (`official_payslip_samples`)
Pierre pourra générer une fiche de paie pré-remplie reprenant exactement la structure du bulletin client :
- Même organisation des sections (employeur, salarié, éléments de salaire, cotisations)
- Même libellés (pas de libellés inventés)
- Variables manquantes listées séparément
- Validation humaine obligatoire avant remise

### Documents officiels (contrats, avenants, attestations)
Pierre pourra :
1. Charger le template source client
2. Identifier les sections variables (nom, poste, dates, salaire)
3. Pré-remplir les sections connues depuis le dossier employé
4. Lister explicitement les variables manquantes
5. Appliquer la mise en page officielle (logo, en-tête, pied de page)
6. Soumettre pour validation humaine obligatoire

### PDF exports
- Aucun markdown brut — conversion propre HTML→PDF
- En-tête officiel avec logo
- Pied de page avec mentions légales
- Typographie conforme à la charte
- Numérotation de pages
- Mentions "Confidentiel" / "Brouillon" selon statut

### Style entreprise
Pierre mémorisera dans `CloneADNProfile.document` :
- Format préféré (`pdf_ready_html`, `markdown`, etc.)
- Ton documentaire (`formal`, `executive`, `legal_careful`)
- Template IDs référencés
- Règles de validation par type de document

---

## Architecture cible B45

```
src/lib/pierre/style-kit/                    (à créer en B45)
  types.ts                  — StyleKit, TemplateSource, StyleRule
  extractor.ts              — Extraction structure depuis document source
  renderer.ts               — Rendu document depuis template + données
  pdf-generator.ts          — HTML → PDF propre (sans markdown brut)
  template-registry.ts      — Registre des templates par company_id
  style-validator.ts        — Validation mise en page avant export

src/lib/clonestore/documents/               (déjà existant, à enrichir)
  template-store.ts         — Stockage templates en DB (Supabase Storage)
  upload-processor.ts       — Processing documents sources client
```

---

## Dépendances B44 → B45

B44 (Empreinte Entreprise finale) doit d'abord :
1. Définir le format de configuration `CloneADNDocumentProfile` complet
2. Permettre l'upload de documents sources client
3. Stocker logo + charte graphique
4. Configurer les règles de validation par document type

B45 consomme ensuite ces données pour générer des documents conformes.

---

## Règles visuelles à capturer (B45)

- **Typographie** : famille de police (serif/sans-serif), tailles par niveau de titre, espacement lignes
- **Couleurs** : principale, secondaire, accent, fond
- **Logo** : position (haut gauche/droit/centré), taille relative, zone blanche
- **Tableaux** : couleur d'en-tête, alternance lignes, bordures
- **Marges** : haut/bas/gauche/droite en mm
- **Format page** : A4 portrait/paysage, A3 si tableur
- **Numérotation** : position, format (page X / Y)
- **Mentions** : confidentialité, brouillon, date de génération

---

## Extraction de structure (B45)

Pour apprendre la structure d'un document existant :
1. Upload du document source (PDF, DOCX, ODT)
2. Extraction texte + structure (mammoth pour DOCX, pdf-parse pour PDF)
3. Identification des sections, patterns de variables, mise en page
4. Création d'un template réutilisable
5. Association au profil `CloneADN` de l'entreprise

Contrainte : **jamais stocker de données personnelles réelles** dans les templates — uniquement la structure et les types de champs.

---

## Validation humaine (invariant)

Quel que soit le niveau de sophistication de B45 :

> **Un document officiel généré par Pierre n'est jamais envoyé automatiquement.**

Le circuit de validation est :
1. Pierre génère le brouillon (qualité premium)
2. DRH / manager valide et corrige si nécessaire
3. Signature manuelle ou électronique
4. Archivage dans le dossier employé

---

## Limites B45 (à ne pas promettre)

- B45 ne remplace pas un logiciel de paie (Silae, ADP, Sage)
- B45 ne génère pas de DSN
- B45 ne calcule pas de cotisations sociales
- B45 ne signe pas légalement à la place de l'employeur
- B45 ne garantit pas la conformité juridique sans validation humaine

---

## Tests futurs attendus (B45)

```
src/lib/pierre/__tests__/pierre-style-kit-b45.test.ts
  - Template extraction preserves structure
  - PDF export contains no raw markdown
  - Logo position matches company profile
  - Header/footer applied to all pages
  - Missing variables listed explicitly
  - Official documents never auto-sent
  - Payslip template matches source structure
```
