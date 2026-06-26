# CloneStory — Guide d'administration

## Accès
- UI : `/founding-partners/admin` (rendu 404 sans autorisation — aucune fuite).
- Garde : `resolveFounderAdmin()` (session Supabase + allowlist propriétaire `CLONESTORE_OWNER_ADMIN_EMAILS`).
- API : `POST /api/founding-partners/admin/action` (session admin obligatoire). Chaque action exige une `reason`.
- Toute action est **auditée** (`clonestory_fp_admin_audit`, append-only) avec ancien/nouvel état.

## Tableau de bord (`adminDashboardCounts`)
Partenaires (total/vérifiés/founding/suspendus/retirés) · Funnel (déclarées→vérifiées) ·
Emails morts (vérif/notif/comm) · Events Stripe (échec/attente) · Conflits d'attribution.

## Fiche partenaire (`adminGetPartnerDetail`)
Identité · statut · lien · introductions · événements · audit · **notes internes**.
Jamais de donnée bancaire, jamais de token, jamais d'email prospect en clair non nécessaire.

## Actions (toutes avec `reason`, auditées, idempotentes, non destructives)
| Action (`body.action`) | Effet |
|---|---|
| `suspend` / `reinstate` | Suspend/réactive un partenaire (mémorise le statut antérieur) |
| `revoke_link` | Révoque le lien personnel |
| `resolve_dispute` | Tranche un litige d'introduction (`verified`/`canceled`) |
| `verify_contribution` | Vérifie manuellement une contribution (peut forcer le délai) |
| `invalidate_contribution` | Invalide une contribution (historique conservé) |
| `reconcile_commercial` | Réconciliation idempotente |
| `add_note` | Note interne append-only (`body.note`) |
| `replay_emails` | Re-arme les emails `dead`/`failed_retryable` (3 outboxes) |
| `anonymize_prospect` | RGPD : anonymise le prospect d'une introduction (`introductionId`) |
| `anonymize_partner` | RGPD : anonymise un partenaire **retiré** (`partnerId`) — conserve registry_number |

Paramètres : `partnerId`, `introductionId`, `contributionId`, `reason` (obligatoire), `note`, `decision`.

## Revue (contributions / conflits / litiges)
- `adminListCommercialReview` : contributions `validation_pending`/`disputed`/`invalidated` (montants/statut sûrs, jamais de carte/PI/secret).
- `adminListConflicts` : introductions en litige.
- `listAttributionConflicts` : conflits d'attribution (preuves sûres).

## Sécurité
Aucune route admin publique. Aucune confiance dans un rôle client. Aucune action commerciale
déclenchable depuis le navigateur (seul le webhook Stripe signé est autoritatif). Erreurs neutres.
