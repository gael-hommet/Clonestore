# CloneStory — Politique de données & rétention (RGPD)

> Structure technique posée. La rédaction définitive des durées et des mentions légales
> exige une **validation juridique humaine** (signalée ci-dessous par ⚖️).

## Données traitées (inventaire — `dataInventory()`)
| Donnée | Table | Finalité | Base légale (⚖️ à valider) |
|---|---|---|---|
| Partenaire (nom, email, tél, société) | `clonestory_fp_partners` | Tenue du registre du Cercle | Intérêt légitime / consentement |
| Prospect introduit (nom, email, société, note) | `clonestory_fp_introductions` | Confirmation de mise en relation | Consentement du prospect (clic POST) |
| Empreintes (email/entreprise, hachées) | `_introductions`/`_attributions` | Déduplication, anti-fraude | Intérêt légitime |
| Cookies (membre `csy_member`, attribution `csy_attribution_v1`) | navigateur | Session / attribution first-touch | Consentement / intérêt légitime |
| Identifiants Stripe (sub/invoice/PI/customer) | `_commercial_contributions`, `_stripe_events` | Preuve de paiement | Exécution / obligation comptable |
| Logs techniques | `_observability_events` | Exploitation, sécurité | Intérêt légitime |
| Audit admin | `_admin_audit` | Traçabilité, sécurité | Obligation / intérêt légitime |
| Distinctions / registry_number | `_partner_awards`, `_partners` | Registre honorifique permanent | Intérêt légitime (registre) |

**Jamais stocké** : numéro de carte, secret, token brut, email prospect en clair dans les ledgers/logs.

## Durées de rétention (configurables ⚖️)
| Élément | Durée par défaut | Mécanisme |
|---|---|---|
| Demande non vérifiée (token) | 7 j (expiration token) | expiration + balayage |
| Introduction **refusée** | 90 j puis anonymisée | `retentionSweep(now, 90)` |
| Prospect sans compte | ⚖️ à définir | anonymisation manuelle/admin |
| Attribution anonyme (cookie) | 90 j (TTL cookie) | expiration |
| Logs d'observabilité | ⚖️ (ex. 12 mois) | purge planifiée à définir |
| Events Stripe | durée comptable ⚖️ | conservés (preuve) |
| Audit admin | durée légale ⚖️ | append-only, conservé |
| Contribution commerciale | durée comptable ⚖️ | conservée |
| Registre honorifique (registry_number) | **permanent** | conservé même après retrait/anonymisation |

## Droits des personnes
- **Accès / portabilité** : export admin (à brancher sur `dataInventory` + lecture partenaire).
- **Rectification** : via l'espace partenaire / action admin.
- **Effacement / opposition** : `adminAnonymizeProspect` (prospect), `adminAnonymizePartner` (partenaire **retiré**).
  → NULLifie la PII, marque `anonymized_at`, **conserve** registry_number + intégrité + comptages. **Aucun DELETE.**
- **Retrait** : `requestWithdrawal` → statut `withdrawn` ; puis anonymisation possible.

## Anonymisation — garanties
- Tombstone email **non routable** (`anonymized+<id>@clonestory.invalid`) : préserve les contraintes NOT NULL/unique.
- Préserve : contraintes, intégrité référentielle, comptages honnêtes, historique technique minimal, registre honorifique.
- Idempotent ; réversibilité impossible (pas de ré-identification facile).

## ⚖️ À valider juridiquement avant ouverture publique
Politique de confidentialité, conditions du Cercle, notice prospect (finalité, durées définitives,
responsable de traitement, contact DPO, base légale exacte de la conservation du registry_number permanent).
