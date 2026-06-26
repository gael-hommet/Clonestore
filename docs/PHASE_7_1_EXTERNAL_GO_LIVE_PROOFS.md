# PHASE 7.1 — External Go-Live Proofs (Stripe Live / Supabase Prod RLS / Domain Email / First Live Customer Evidence)

> **Gate de preuves externes.** Prépare/vérifie les preuves externes réelles requises **avant
> tout lancement public**. Aucune preuve inventée : par défaut rien n'est vérifié, public launch
> reste **BLOCKED**. Ne jamais déclarer public launch ready sans preuve réelle.

## Objectif

Passer de « Pierre vendable pour un premier client contrôlé avec limites » (P6.6) à
« preuves externes réelles prêtes / vérifiées ». Ce gate **ne valide rien tout seul** : il
documente la readiness, liste les preuves manuelles requises et garde public launch bloqué
tant que les preuves bloquantes ne sont pas réellement fournies.

## Quatre classifications

- **A — readiness_documented** : la readiness est documentée (référence existante).
- **B — manual_proof_required** : preuve manuelle requise (action humaine documentée).
- **C — proof_verified** : preuve réellement validée (jamais par ce gate ; preuve réelle requise).
- **D — blocking_public_launch** : bloquant — public launch interdit tant que non prouvé.

## Quatre matrices de preuves

1. **Stripe live** : readiness (A), clés live (B), webhook live (B), produit/prix live (B),
   **transaction live réelle puis remboursée (D)**, portail client live (B).
2. **Supabase prod / RLS** : readiness (A), projet prod (B), **RLS activé toutes tables tenant (D)**,
   **policies RLS testées avec auth réelle (D)**, service role audité (B), backups/PITR (B).
3. **Domaine / email** : domaine + DNS (B), **SPF/DKIM/DMARC (D)**, domaine expéditeur vérifié (B),
   délivrabilité testée (B), adresse support active (B).
4. **Premier client réel** : candidat identifié (A), contrat/CGV signés (B), activation réelle
   contrôlée (B), première valeur validée humainement (B), evidence capturée (B), aucune exécution
   autonome (A).

## Verdict par défaut

- `proof_status: "manual_proof_required"`
- `public_launch_verdict: "BLOCKED"`
- `first_live_customer_ready: "conditional"`
- `external_go_live_proofs_ready: false`
- `stripe_live_verified` / `supabase_prod_rls_verified` / `domain_email_verified` : **false**
- `scale_80k_proven: false`
- `ready_for_first_live_customer_controlled_run: true`

## Blockers (classification D)

Transaction Stripe live réelle · RLS prod activé/testé toutes tables tenant · SPF/DKIM/DMARC
configurés/vérifiés · premier paiement client E2E live · scale 80k.

## Étapes manuelles & rollback

Le gate fournit un **playbook d'étapes manuelles** (chaque étape `requires_human_action: true`,
`auto_applied: false`) et un **plan de rollback** (retour test mode Stripe, désactivation webhook,
pause client, restauration backup, retour DNS, communication). La mise à jour des go-live proofs
est une **étape manuelle** : `go-live-proofs.local.json` est référencé en lecture seule et n'est
**jamais** modifié automatiquement par ce gate.

## Rappels (invariants)

Aucun paiement live · aucun email réel · aucun runtime · aucune modification `.env.local` ·
aucune modification automatique des go-live proofs · aucune preuve inventée · public launch
NON validé · scale 80k NON prouvé.

## Prochaine phase

**FIRST LIVE CUSTOMER CONTROLLED RUN — vendre / activer / accompagner le premier client réel
avec preuves.**
