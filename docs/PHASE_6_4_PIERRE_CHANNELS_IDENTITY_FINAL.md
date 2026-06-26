# PHASE 6.4 — Pierre Channels & Identity Final / Email Domain & Contact Surface Readiness

## 1. Objectif

Finaliser la couche **Channels & Identity** de Pierre pour rendre le produit **vendable,
clair et crédible** : qui est Pierre, comment il est présenté, quels canaux il peut
utiliser, quelle identité email il affiche, ce qui est actif maintenant / futur /
nécessite validation / interdit — **sans activer de communication réelle**.

**P6.4 = readiness / configuration design / contact surface / identity governance.**
P6.4 ≠ email live · P6.4 ≠ domain live · P6.4 ≠ runtime execution. **Aucun email réel,
aucun domaine connecté, aucun DNS modifié, aucune route d'envoi, aucun appel provider.**

## 2. Pierre Display Identity

- **Nom** : Pierre · **Rôle** : Employé IA RH CloneStore.
- **Fonction** : préparer, organiser, analyser, rédiger des brouillons, signaler les
  risques, demander les validations.
- **Limites (forbidden claims)** : ne signe pas · ne sanctionne pas (no sanction) · ne
  modifie pas la paie (no payroll) · n'envoie rien sans permission (no real send) · ne
  remplace pas l'avis légal (no legal replacement).
- **Mode première vente** : local-first controlled sale / demo-proof / human-in-the-loop.
- **Mode public launch futur** : identité email/domaine vérifiée, RLS/prod/live proofs.

## 3. Channel Matrix

| Canal | Statut |
|---|---|
| Internal dashboard / cockpit | active_for_first_sale |
| Demo surface | active_for_first_sale |
| Email outbound | **draft_only** |
| Email inbound | future |
| Customer domain identity | future_public_launch |
| Phone / voice / CloneVoice | future |
| File / document upload | controlled_local_or_future |
| Intégrations planning / paie | future |

## 4. Email Identity Strategy

- **First sale (controlled)** : brouillons uniquement · identité simulée/proposée ·
  **aucun email réel** · adresse « à configurer » · tout envoi réel bloqué (draft only).
- **Future customer-domain** : domaine client · **DNS SPF/DKIM/DMARC** · provider ·
  vérification · règles d'expéditeur · audit · opt-out · anti-usurpation.
- **Public launch** : domaine testé · envoi test validé · bounce/reply handling · audit
  trace · legal review · DPA/privacy · support process.
- **Adresses affichables** : pierre@entreprise.fr · rh@entreprise.fr · pierre-rh@… ·
  pierre@clonestore.app / no-reply@clonestore.app (managed futur).

## 5. Domain Readiness Strategy

Checklist : domain_owner_confirmed · dns_access_confirmed · spf_record_ready ·
dkim_record_ready · dmarc_record_ready · provider_selected · sender_identity_approved ·
reply_to_approved · bounce_handling_defined · audit_trace_ready · legal_copy_reviewed ·
test_send_evidence_required · production_send_not_enabled. **Tous `verified: false`** —
jamais « verified » sans preuve réelle.

## 6. Permissions Matrix

Par canal : `can_prepare_draft`, `can_send_real_message: false` (partout),
`human_validation_required`, `cloneguard_decision`, `clonetrace_required`,
`public_launch_required`. Règle : dashboard = prepare only · demo = show only · outbound
email = draft only (no send) · inbound/domain/voice/integrations = future · file upload =
controlled.

## 7. Draft Template Matrix

6 brouillons (jamais envoyés) : manager absence update · candidate recruitment intro ·
onboarding checklist · payroll variables reminder · sensitive HR meeting preparation ·
multi-site staffing coordination. Chacun : `requires_human_validation: true`,
`can_be_sent_now: false`.

## 8. CloneGuard Identity Rules / CloneTrace Events

- **CloneGuard** : no spoofing · no unauthorized sender · no legal/disciplinary send
  without human validation · no payroll official message without human validation · no
  external email before identity verified · no customer-domain claim before DNS/provider
  proof · no CloneVoice live claim · no public launch claim.
- **CloneTrace** : identity_plan_created · channel_matrix_generated ·
  email_identity_draft_prepared · domain_requirements_listed · permissions_matrix_created ·
  draft_templates_prepared · no_real_send_confirmed · no_domain_connection_confirmed ·
  ready_for_p6_5.

## 9. UI

`/profile/messages` : panneau **« Pierre — Identité & canaux »** (identity_status, mode,
display identity, channel matrix, email/domain strategy, permissions, draft templates,
first sale readiness, public launch requirements, next phase P6.5). Actions autorisées :
Voir identité · Voir canaux · Voir email strategy · Voir permissions · Voir templates ·
Voir prérequis domaine (lecture seule). Actions interdites : Envoyer email réel ·
Connecter domaine · Vérifier DNS · Activer SMTP/provider · Créer route send · Déclarer
email live · Déclarer public launch.

Microcopy : « Identité Pierre · Aucun email réel » · « Pierre peut préparer des brouillons,
pas envoyer sans validation. » · « Le domaine client n'est pas connecté dans cette phase. »
· « Première vente contrôlée ≠ email production. »

## 10. Invariants confirmés

- Identité Pierre **claire** · canaux **prêts pour première vente** · `ready_for_p6_5: true`.
- `email_live_enabled`/`domain_connected`/`dns_modified`/`spf_verified`/`dkim_verified`/
  `dmarc_verified`/`send_route_created`/`real_email_sent` = **false**.
- `runtime_execution_active`/`server_persistence_active`/`sql_applied`/`env_modified` false ·
  Pierre **non** déclaré fully sellable · public launch **non** validé · scale 80k **non**
  prouvé.
- Aucun import provider email / IA · aucune route send · moteur Pierre `src/lib/pierre/**`
  et `src/app/api/pierre/**` **INTACTS** · `.env.local`/go-live proofs non modifiés.

## 11. Prochaine phase recommandée

**PHASE 6.5 — Pierre Customer Activation E2E Final / First Paid Customer Proof Path.**

---

**Readiness identity. Aucun email réel. Aucun domaine connecté. Aucun DNS modifié. Aucune
route send. Aucun appel provider/IA. Première vente contrôlée possible sans email prod.
Public launch requires email/domain proof. Pierre NON fully sellable. Prochaine étape :
P6.5.**
