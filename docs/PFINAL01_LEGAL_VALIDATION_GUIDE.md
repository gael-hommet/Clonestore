# P-FINAL 01 — Guide de validation juridique

**Phase: 9 — Public Launch Closure**
**Audience: Fondateur + conseil juridique**

---

## Pages légales à valider avant lancement

| Page | Route | Statut par défaut | Bloquant |
|------|-------|-------------------|----------|
| CGU | `/legal/cgu` | DRAFT | Oui |
| CGV | `/legal/cgv` | DRAFT | Oui |
| DPA | `/legal/dpa` | DRAFT | Oui |
| Mentions légales | `/legal/mentions` | DRAFT | Oui |
| Politique de confidentialité | `/legal/confidentialite` | DRAFT | Oui |

**Toutes ces pages affichent une bannière "BROUILLON" par défaut** — visible par les utilisateurs tant qu'elles ne sont pas validées.

---

## Ce que Pierre n'est PAS (contraintes absolues)

Ces formulations sont **interdites** dans tout contenu public :

| Formulation interdite | Pourquoi |
|-----------------------|----------|
| "Pierre garantit la conformité" | Fausse promesse — Pierre produit des brouillons |
| "Pierre remplace un avocat" | Exercice illégal du droit |
| "Pierre remplace un expert-comptable" | Exercice illégal de la comptabilité |
| "Zéro erreur / sans erreur garantie" | Promesse impossible |
| "Décisions autonomes" | Pierre propose, l'humain décide |
| "Satisfait ou remboursé" (pricing) | Engagement commercial non couvert |
| "Logiciel de paie officiel / certifié" | Certification inexistante |
| "Essai gratuit de 7 jours" | Pas de trial gratuit |
| "Essai gratuit illimité / open-bar" | Pas de trial gratuit |

**Vérification automatique:** `src/lib/production-readiness/public-copy/copy-scanner.ts`

---

## Process de validation recommandé

### Étape 1 — Préparer les informations réelles

Compléter tous les placeholders dans les pages :
- Nom et forme juridique de la société
- Adresse du siège social
- Capital social
- Numéro SIREN/SIRET
- Numéro de TVA
- Nom et coordonnées du directeur de publication
- Hébergeur (nom, adresse, contact)
- DPO ou point de contact RGPD
- Email de contact légal

### Étape 2 — Envoyer au conseil juridique

Fournir au juriste :
1. Les 5 pages légales en PDF (depuis le navigateur)
2. Ce guide
3. La liste des fonctionnalités de Pierre (assistant RH + brouillons documents + brouillons emails)
4. Les contraintes d'usage (validation humaine obligatoire avant tout envoi)

### Étape 3 — Collecter les preuves

Pour chaque page validée, obtenir :
- Email de validation avec date et signature du juriste
- OU document PDF de validation signé

**Conserver ces preuves** — elles débloquent les proof IDs dans le système.

### Étape 4 — Enregistrer les validations

Une fois les preuves obtenues, mettre à jour les flags dans le système :

```typescript
// Ces flags ne doivent JAMAIS être mis à true sans preuve réelle
const verifiedProofIds = [
  "proof_legal_cgu_validated",       // après validation avocat CGU
  "proof_legal_cgv_validated",       // après validation avocat CGV
  "proof_legal_dpa_validated",       // après validation DPO
  "proof_legal_confidentialite_validated", // après validation juriste
  "proof_legal_mentions_completed",  // après vérification manuelle placeholders
];
```

---

## Points d'attention spécifiques par page

### CGU (Conditions Générales d'Utilisation)
- Sections clés: objet, accès, propriété intellectuelle, responsabilité, résiliation
- **À vérifier:** Clause de limitation de responsabilité pour les brouillons Pierre
- **À vérifier:** Clause de validation humaine obligatoire
- **À vérifier:** Droit applicable et juridiction compétente

### CGV (Conditions Générales de Vente)
- Sections clés: tarifs, paiement, renouvellement, remboursement, résiliation
- **Interdit:** Essai gratuit, satisfait-ou-remboursé
- **À vérifier:** Prix TTC/HT selon clientèle cible (B2B → HT)
- **À vérifier:** Conditions de résiliation (préavis, remboursement au prorata)

### DPA (Data Processing Agreement)
- Obligatoire RGPD si traitement de données pour compte de clients
- **RT:** Pierre (CloneStore) = Responsable du Traitement
- **ST:** Clients = Sous-Traitants (ou inversement selon architecture)
- **Vérifier:** Liste des sous-traitants (Supabase, Stripe, Resend, Anthropic)
- **Vérifier:** Durées de conservation par catégorie de données

### Politique de confidentialité
- Doit couvrir: collecte, bases légales, droits RGPD, cookies, transferts hors UE
- **À vérifier:** Exercice des droits DSAR (délai 30 jours légal)
- **À vérifier:** Cookies analytics si présents

### Mentions légales
- **Action requise avant lancement:** Remplacer TOUS les placeholders `[...]`
- Vérifier sur la page `/legal/mentions` que aucun placeholder n'est visible

---

## Vérification programmatique

```typescript
import { runContentGuard } from "@/lib/launch-readiness/legal-pages/legal-page-content-guard";
import { checkPierreHardLimitsInContent } from "@/lib/launch-readiness/legal-pages/legal-page-content-guard";

// Vérifier qu'un contenu ne contient pas de formulations interdites
const result = runContentGuard("cgu", pageContent);
if (!result.passes) {
  console.error("Violations:", result.violations);
}

// Vérifier les hard limits Pierre (jamais contournable)
const limits = checkPierreHardLimitsInContent(content);
if (!limits.passes) {
  console.error("Hard limits violated:", limits.violations);
}
```

---

*P-FINAL 01 — Phase 9 — Document à conserver avec les preuves de validation*
