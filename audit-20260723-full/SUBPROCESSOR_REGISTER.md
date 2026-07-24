# Subprocessor Register

Full evidence: `CLONESTORE_AUDIT_EVIDENCE/legal-commercial-trust-closure/04-subprocessors-raw.md`. Only providers actually called by the code — no assumed region or certification.

| Fournisseur | Fonction | Données | Région prouvée | Transfert | DPA / statut |
|---|---|---|---|---|---|
| Supabase Inc. | Auth + base Postgres + stockage fichiers | Comptes, données RH via Pierre, documents uploadés | **Non prouvée par le code** — région réelle à confirmer dans le dashboard Supabase (`.env.example` ne contient qu'une URL placeholder) | Probable hors UE/EEE (à confirmer) | DPA générique Supabase existe côté fournisseur (à vérifier/joindre) ; **nommé dans le DPA CloneStore §7** |
| Stripe Inc. | Paiement, abonnement, webhooks, Connect (paiement partenaires) | Métadonnées de facturation, adresse/nom client (collectés par Stripe lui-même), comptes Connect Express | **Non prouvée par le code** | Probable hors UE/EEE (USA) | DPA Stripe existe côté fournisseur ; **nommé dans le DPA CloneStore §7** |
| OpenAI | Fourniture du modèle IA pour CloneChat et Pierre | Messages de chat, pièces jointes, contexte compte borné (nom/rôle employé, missions — plafonné à 6 par catégorie, isolé par tenant), instructions de rédaction de documents | **Non prouvée par le code** | Probable hors UE/EEE (USA) | **DISCORDANCE FACTUELLE : le DPA §7 nomme "Anthropic PBC" comme sous-traitant IA, mais le code confirme qu'OpenAI est le seul fournisseur LLM actuellement appelé** (`package.json: "openai":"^6.22.0"`, `gpt-4o-mini`/`gpt-4.1` en config, appels directs `new OpenAI(...)` dans `pierre/brain`, `pierre/generate`, `clonechat/openai/client.ts`) — **cette liste doit être corrigée avant toute validation du DPA** |
| Resend Inc. | Email transactionnel uniquement | Adresse email destinataire + contenu du message | **Non prouvée par le code** | Probable hors UE/EEE (USA) | **Nommé dans le DPA CloneStore §7** — cohérent avec le code |
| Vercel Inc. | Hébergement application + 1 tâche cron mensuelle (versements partenaires) | Infrastructure uniquement | **Non prouvée par le code** | Probable hors UE/EEE (USA) | **Nommé dans le DPA CloneStore §7** — cohérent avec le code |
| Make.com | ~~Automatisation externe~~ | — | — | — | **Neutralisé (P0.2)** — la route `/api/router` renvoie désormais 410 Gone sans aucun appel réseau, l'URL a été retirée du code ; historiquement un sous-traitant, plus aujourd'hui — à retirer de tout futur registre public |
| Sentry / Datadog / Logtail / Axiom / autres monitoring | **Absent** | — | — | — | N/A — aucun outil de ce type intégré |
| CDN dédié | **Absent** | — | — | — | N/A — servi via Vercel/Next uniquement |
| Génération PDF/DOCX | **Aucun service externe** | — | — | — | N/A — moteurs de rendu internes, aucune bibliothèque tierce (`renderers.ts`) |
| Twilio / SMS | **Absent** | — | — | — | N/A — CloneCall reste une entrée catalogue marketing, non opérationnel |

## Action requise avant validation du DPA
1. **Corriger la mention "Anthropic PBC" → "OpenAI"** (ou documenter pourquoi les deux seraient exacts, si un changement de fournisseur est prévu) dans `/legal/dpa` §7 — c'est un fait vérifiable par le code, donc `SAFE_TO_IMPLEMENT` en soi, mais laissé pour l'owner car il s'agit d'une page légale marquée Draft dont la modification de fond doit accompagner la validation juridique globale, pas être faite isolément dans ce bloc technique.
2. Confirmer la région d'hébergement réelle de chacun des 5 fournisseurs actifs (Supabase, Stripe, OpenAI, Resend, Vercel) auprès de leurs tableaux de bord respectifs — aucune région n'est codée en dur dans ce dépôt.
3. Rassembler/vérifier les DPA de chaque fournisseur (SCC ou équivalent) pour l'annexe transferts internationaux du DPA CloneStore.

## Ce qui N'A PAS été fait
La correction du texte de `/legal/dpa` §7 elle-même n'a pas été appliquée dans ce bloc (c'est une modification de contenu légal de fond, à faire accompagner d'une validation avocat globale plutôt qu'en correction isolée) — elle est documentée ici et dans `LEGAL_REMAINING_RISKS.md` comme une correction factuelle nécessaire avant toute publication du DPA.
