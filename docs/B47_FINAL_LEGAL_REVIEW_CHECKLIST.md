# B47 — Final Legal Review Checklist (Pre-B48 Launch)

## Status: B47 policies implemented — legal review pending

This checklist must be completed before public launch (B48). Items marked **[BLOCKING]** must be resolved before going live.

## Juridique (Legal)

- [ ] **[BLOCKING]** CGU (Conditions Générales d'Utilisation) rédigées et approuvées par conseil juridique
- [ ] **[BLOCKING]** CGV (Conditions Générales de Vente) incluant prix (449€), durée, résiliation, remboursement, et founder pricing
- [ ] **[BLOCKING]** Mention claire de la responsabilité humaine finale dans les CGU
- [ ] **[BLOCKING]** Disclaimer juridique ("pas de conseil juridique") sur toutes les pages publiques
- [ ] Mentions légales complètes sur le site (SIRET, siège social, directeur de publication)
- [ ] Politique de résiliation et remboursement validée juridiquement

## RGPD / Data Protection

- [ ] **[BLOCKING]** Politique de confidentialité RGPD complète (bases légales, durées de conservation, droits des personnes)
- [ ] **[BLOCKING]** DPA (Data Processing Agreement) préparé pour les clients B2B
- [ ] **[BLOCKING]** RLS Supabase appliqué en production sur toutes les tables sensibles
- [ ] Registre des traitements à jour
- [ ] Procédure de réponse aux demandes de droits (accès, effacement, portabilité)

## Mentions IA

- [ ] **[BLOCKING]** Mentions légales sur l'usage de l'IA générative (OpenAI/Anthropic) dans les outputs Pierre
- [ ] Disclaimer "IA — résultat à vérifier" visible dans les interfaces

## Produit — Disclaimers

- [ ] **[BLOCKING]** Disclaimer payroll ("Pierre ne remplace pas la DSN / logiciel de paie") visible dans l'interface pré-paie
- [ ] **[BLOCKING]** Disclaimer documents officiels ("validation humaine obligatoire") sur tous les exports
- [ ] HUMAN_RESPONSIBILITY disclaimer actif sur tous les documents sensibles
- [ ] LEGAL_LIMIT disclaimer actif sur les catégories juridiques
- [ ] AI_LIMIT disclaimer sur tous les outputs IA

## Paiement / Facturation

- [ ] **[BLOCKING]** Stripe configuré avec price_id correspondant à 449€/mois
- [ ] **[BLOCKING]** Webhooks Stripe actifs et testés en production
- [ ] **[BLOCKING]** CGV liées au checkout Stripe
- [ ] Factures automatiques configurées
- [ ] Founder pricing termes définis et inclus dans les CGV

## Marketing

- [ ] **[BLOCKING]** Aucune promesse "zéro erreur" dans les pages publiques et emails marketing
- [ ] Toutes les pages publiques validées via `validatePierreMarketingCopy()`
- [ ] Emails marketing revus avec `validateCloneStoreMarketingCopy()`
- [ ] Aucune des 40+ forbidden phrases dans les matériaux commerciaux

## Produit — Guardrails Techniques

- [ ] **[BLOCKING]** Démo confirmée sans consommation IA réelle (B38 cost shield en mode demo)
- [ ] **[BLOCKING]** Envoi d'emails sensibles confirmé comme jamais automatique (B39 + B47 guardrails)
- [ ] `PIERRE_LEGAL_GUARDRAILS_ENABLED=true` en production
- [ ] `PIERRE_OUTPUT_VALIDATION_ENABLED=true` en production
- [ ] Routes `/api/pierre/legal/*` actives et testées

## Revue Finale

- [ ] **[BLOCKING]** Revue juridique humaine complète de tous les matériaux publics avant lancement
- [ ] Tests B47 validés : 220+ tests passants
- [ ] TypeScript 0 erreur sur B47
- [ ] Build production propre

## Résumé des Blockers

8 items bloquants nécessitent une revue juridique humaine avant B48.
Les guardrails techniques B47 sont en place. La protection légale du code est active.
La responsabilité légale finale reste avec l'équipe fondatrice et leur conseil juridique.

---

*B47 fournit la couche technique de protection légale et commerciale. Ce checklist ne remplace pas l'avis d'un avocat. Obtenir une revue juridique complète avant le lancement public.*
