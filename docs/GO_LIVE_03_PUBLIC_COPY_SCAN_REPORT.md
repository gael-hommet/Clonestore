# GO-LIVE 03 — Public Copy Scan Report Template

## À propos de ce document

Ce document est un template de rapport. Il sera complété après exécution du scan complet.
Pour générer le rapport réel : `node scripts/legal-public-copy-scan.mjs`
Le rapport d'audit est écrit dans : `go-live-evidence/legal-public-copy/legal-public-copy-scan.txt`

---

## Pages publiques scannées

| Page | Contexte | Fichier |
|---|---|---|
| Homepage | `homepage` | `src/app/page.tsx` |
| Checkout | `checkout` | `src/app/checkout/page.tsx` |
| Succès paiement | `success` | `src/app/paiement/success/page.tsx` |
| Annulation | `cancel` | `src/app/paiement/cancel/page.tsx` |
| Page Pierre | `pierre_page` | `src/app/agents/pierre/page.tsx` (optionnelle) |
| FAQ | `faq` | `src/app/questions/page.tsx` (optionnelle) |

---

## Pages légales scannées

| Page | Contexte | Fichier |
|---|---|---|
| CGU | `cgu` | `src/app/legal/cgu/page.tsx` |
| CGV | `cgv` | `src/app/legal/cgv/page.tsx` |
| DPA | `dpa` | `src/app/legal/dpa/page.tsx` |
| Mentions légales | `mentions` | `src/app/legal/mentions/page.tsx` |
| Confidentialité | `confidentialite` | `src/app/legal/confidentialite/page.tsx` |

---

## Patterns interdits vérifiés (12)

| ID | Sévérité | Règle |
|---|---|---|
| `zero_erreur` | BLOCKING | Zéro erreur / aucune erreur garantie |
| `conformite_garantie` | BLOCKING | Conformité garantie / légalement conforme |
| `remplace_avocat` | BLOCKING | Remplace un avocat / juriste |
| `dsn_autonome` | BLOCKING | DSN autonome / soumet DSN automatiquement |
| `paie_officielle_autonome` | BLOCKING | Bulletins de paie officiels |
| `licenciement_automatique` | BLOCKING | Licenciement automatique |
| `rh_juridiquement_autonome` | BLOCKING | RH juridiquement autonome |
| `remplace_responsabilite_humaine` | BLOCKING | Remplace responsabilité humaine |
| `essai_gratuit_open_bar` | BLOCKING | Essai gratuit 7 jours / open-bar |
| `cout_ia_illimite` | BLOCKING | Coût IA illimité / IA illimitée |
| `donnees_100_protegees` | BLOCKING | Données 100% protégées / sécurité absolue |
| `public_launch_ready_sans_preuve` | BLOCKING | Public launch activé sans preuve |

---

## Résultats attendus — Copy public

**Statut cible :** `[CLEAN] Aucune violation bloquante dans les pages publiques`

Les pages actuelles utilisent un vocabulaire validé :
- "Poste RH opérationnel automatisé" ✓
- "Pierre prépare des brouillons" ✓
- "Validation humaine finale" ✓
- "449 € / mois" ✓
- Pas de "zéro erreur", pas de "garantie", pas d'"essai gratuit open-bar" ✓

---

## Résultats attendus — Pages légales

**Statut cible :** Placeholders réduits à zéro après action Gaël

Placeholders actuels dans `mentions/page.tsx` (à compléter) :
- Dénomination sociale
- Forme juridique
- SIREN/SIRET/RCS
- Adresse siège social
- Directeur de publication
- Email contact
- Hébergeur

---

## Proof IDs et conditions de validation

### `PUBLIC_COPY_SCAN_CLEAN`
**Condition :** `publicBlockers === 0` après scan Node.js
**Action :** Lancer scan, vérifier résultat, marquer manuellement si CLEAN

### `PUBLIC_SITE_NO_FORBIDDEN_CLAIMS`
**Condition :** Vérification manuelle des 12 règles sur les pages en production
**Action :** Revue humaine des pages live avant marquage

### `LEGAL_ENTITY_INFO_COMPLETED`
**Condition :** 0 champ société manquant dans mentions légales
**Action :** Compléter tous les champs → voir `GO_LIVE_03_GAEL_LEGAL_INFO_TO_FILL.md`

### `LEGAL_CGU_VALIDATED` / `LEGAL_CGV_VALIDATED` / `LEGAL_DPA_VALIDATED` / `LEGAL_PRIVACY_VALIDATED` / `LEGAL_MENTIONS_VALIDATED`
**Condition :** Relecture juridique humaine complète par un avocat spécialisé
**Action :** Jamais auto-validé — revue juriste obligatoire

### `LEGAL_HUMAN_REVIEW_COMPLETED`
**Condition :** Confirmation écrite d'un juriste que l'ensemble du package légal est conforme
**Action :** Conserver la preuve (email, document signé) dans les archives

### `CHECKOUT_LEGAL_LINKS_PRESENT`
**Condition :** Les liens vers CGV et politique de confidentialité sont visibles au moment du paiement
**Action :** Vérification manuelle de `/checkout` en production

---

## Commandes

```powershell
# Scan complet
powershell -ExecutionPolicy Bypass -File scripts/pfinal03-legal-public-copy-scan.ps1

# Scan Node.js seul
node scripts/legal-public-copy-scan.mjs

# Tests unitaires GO-LIVE 03
npx vitest run src/app/api/go-live/__tests__/go-live-03-legal-public-copy.test.ts
```

---

## Evidence file

Après exécution du scan, le rapport est disponible à :
```
go-live-evidence/legal-public-copy/legal-public-copy-scan.txt
```

Ce fichier contient :
- Nombre de violations bloquantes dans les pages publiques
- Nombre de placeholders dans les pages légales
- Nombre de champs société manquants
- Liste des 10 proof IDs (tous PENDING)

---

*Template GO-LIVE 03 — Public Copy Scan Report*
*Rapport réel généré par `node scripts/legal-public-copy-scan.mjs`*
