# GO-LIVE 03 — Legal Pages, Company Identity & Public Copy Final Scan

## Objectif

Fermer la couche légale et commerciale avant lancement public :
- Vérifier la présence et la structure des 5 pages légales
- Scanner les pages publiques pour promesses interdites
- Vérifier que les informations société sont renseignées
- Générer les preuves d'audit (evidence files)

## Statut

**Public launch : NO-GO** — tous les 10 proof IDs de ce bloc restent PENDING jusqu'à action manuelle de Gaël et revue juridique humaine.

---

## 10 Proof IDs (tous PENDING)

| Proof ID | Type | Statut |
|---|---|---|
| `LEGAL_CGU_VALIDATED` | manual | PENDING |
| `LEGAL_CGV_VALIDATED` | manual | PENDING |
| `LEGAL_DPA_VALIDATED` | manual | PENDING |
| `LEGAL_PRIVACY_VALIDATED` | manual | PENDING |
| `LEGAL_MENTIONS_VALIDATED` | manual | PENDING |
| `LEGAL_ENTITY_INFO_COMPLETED` | manual | PENDING |
| `LEGAL_HUMAN_REVIEW_COMPLETED` | manual | PENDING |
| `PUBLIC_COPY_SCAN_CLEAN` | script_output | PENDING |
| `PUBLIC_SITE_NO_FORBIDDEN_CLAIMS` | script_output | PENDING |
| `CHECKOUT_LEGAL_LINKS_PRESENT` | manual | PENDING |

---

## Pages légales attendues

| Route | Fichier | Statut actuel |
|---|---|---|
| `/legal/cgu` | `src/app/legal/cgu/page.tsx` | Draft 1.0 — placeholders actifs |
| `/legal/cgv` | `src/app/legal/cgv/page.tsx` | Draft 1.0 — contenu substantiel présent |
| `/legal/dpa` | `src/app/legal/dpa/page.tsx` | Draft 1.0 — RGPD sous-traitant |
| `/legal/mentions` | `src/app/legal/mentions/page.tsx` | Draft 1.0 — 6+ placeholders société |
| `/legal/confidentialite` | `src/app/legal/confidentialite/page.tsx` | Draft 1.0 — droits utilisateurs |

Toutes les pages affichent une `LegalValidationBanner` ambrée indiquant leur statut de brouillon.

---

## Patterns interdits dans le copy public

Les patterns suivants sont bloquants s'ils apparaissent dans les pages publiques :

| ID | Pattern | Sévérité |
|---|---|---|
| `zero_erreur` | "zéro erreur", "aucune erreur garantie", "error-free" | BLOCKING |
| `conformite_garantie` | "conformité garantie", "légalement conforme" | BLOCKING |
| `remplace_avocat` | "remplace un avocat", "remplace un juriste" | BLOCKING |
| `dsn_autonome` | "DSN autonome", "soumet des DSN automatiquement" | BLOCKING |
| `paie_officielle_autonome` | "bulletins de paie officiels", "logiciel de paie certifié" | BLOCKING |
| `licenciement_automatique` | "licenciement automatique" | BLOCKING |
| `rh_juridiquement_autonome` | "RH juridiquement autonome" | BLOCKING |
| `remplace_responsabilite_humaine` | "remplace la responsabilité humaine" | BLOCKING |
| `essai_gratuit_open_bar` | "essai gratuit de 7 jours", "open-bar" | BLOCKING |
| `cout_ia_illimite` | "coût IA illimité", "IA illimitée" | BLOCKING |
| `donnees_100_protegees` | "données 100% protégées sans réserve", "sécurité absolue" | BLOCKING |
| `public_launch_ready_sans_preuve` | "B48_PUBLIC_LAUNCH_ENABLED.*true" | BLOCKING |

---

## Patterns autorisés (confirmés)

- "gagner du temps", "réduire les coûts" ✓
- "Poste RH opérationnel automatisé" ✓
- "employé IA RH" ✓
- "Pierre prépare", "structure", "suit", "relance" ✓
- "validation humaine finale obligatoire" ✓
- "démo illustrative" ✓
- "Pierre — 449 €/mois" ✓

---

## Script de scan

```powershell
# Lancer le scan complet GO-LIVE 03
powershell -ExecutionPolicy Bypass -File scripts/pfinal03-legal-public-copy-scan.ps1

# Ou directement :
node scripts/legal-public-copy-scan.mjs
```

Le script :
- Ne fait aucun appel API
- Ne modifie pas `go-live-proofs.local.json`
- Génère `go-live-evidence/legal-public-copy/legal-public-copy-scan.txt`

---

## Librairies TypeScript

```
src/lib/go-live/legal-entity/
  types.ts                    — LegalEntityField, LegalEntityValidation, LegalEntityVerdict
  legal-entity-registry.ts    — LEGAL_ENTITY_FIELDS (11 champs)
  legal-entity-validator.ts   — validateLegalEntity(), validateLegalEntityFromPageContent()
  legal-entity-verdict.ts     — getLegalEntityVerdict(), formatLegalEntityVerdict()

src/lib/go-live/legal-pages-final/
  types.ts                    — LegalPageKey, LegalPageScanResult, LegalPagesFinalScanResult
  legal-pages-final-fixtures.ts — Fixtures de test pour les 5 pages
  legal-pages-final-scan.ts   — scanLegalPage(), scanAllLegalPages()
  legal-pages-final-verdict.ts — getLegalPagesVerdict()

src/lib/go-live/public-copy-final/
  types.ts                    — CopyFinalRule, CopyFinalViolation, CopyFinalScanResult
  public-copy-final-registry.ts — COPY_FINAL_FORBIDDEN_RULES (12), COPY_FINAL_ALLOWED_PATTERNS (8)
  public-copy-final-scanner.ts  — scanCopyFinal(), scanMultipleCopyFinal()
  public-copy-final-verdict.ts  — getCopyFinalVerdict()
```

---

## Contraintes absolues

- Ne jamais marquer un proof comme `verified` automatiquement
- Ne jamais inventer les vraies infos société (SIREN, adresse, etc.)
- Ne jamais prétendre que les CGU/CGV/DPA sont finales sans juriste
- Ne jamais activer `B48_PUBLIC_LAUNCH_ENABLED`
- Ne jamais appeler OpenAI, Stripe live, ni envoyer d'email réel

---

## Actions Gaël requises

1. Remplir les informations société dans `/legal/mentions` → voir `GO_LIVE_03_GAEL_LEGAL_INFO_TO_FILL.md`
2. Faire relire CGU/CGV/DPA/mentions par un juriste
3. Valider manuellement chaque proof ID dans `go-live-proofs.local.json` après vérification
4. Vérifier que le checkout affiche les liens CGV et confidentialité au moment du paiement

---

*Généré par GO-LIVE 03 — Legal Pages, Company Identity & Public Copy Final Scan*
*Ne constitue pas un avis juridique.*
