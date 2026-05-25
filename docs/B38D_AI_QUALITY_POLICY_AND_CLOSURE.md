# B38D — AI Quality Policy & B38 Final Closure

**Bloc:** B38D  
**Statut:** Validé  
**Tests:** 44 (B38D) + 52 (B38C) + 123 (B38B) + 69 (B38A) = 288 total  
**Suite complète:** 5122 tests passing

---

## 1. Pourquoi B38D existe

B38D clôture le bloc B38 — le socle complet de l'IA économique, sécurisée et qualitative pour Pierre.

B38A a bloqué les fuites financières. B38B a prouvé que l'IA live fonctionne. B38C a rendu tout ça persistant et auditable. **B38D verrouille la doctrine et les contrats qualité** pour s'assurer que Pierre ne produit jamais des sorties "ancien ChatGPT", et prépare officiellement B44/B45 pour la qualité documentaire finale.

---

## 2. B38A/B/C résumé

| Bloc | Mission | Résultat |
|---|---|---|
| **B38A** | AI Cost Shield — anti-ruine | 69/69 tests, non-payants = 0€ IA |
| **B38B** | OpenAI Live Validation | 123/123 tests, 5/5 scénarios live, 0.980¢ coût réel |
| **B38C** | Supabase AI Cost Ledger | 52/52 tests, memory default + Supabase opt-in |
| **B38D** | AI Quality Policy & Closure | 44/44 tests, doctrine verrouillée |

---

## 3. Doctrine modèle économique/premium

Pierre utilise le bon modèle pour le bon travail :

| Tâche | Tier | Modèle actuel | Coût cible |
|---|---|---|---|
| Orchestration, statuts, micro-tâches | Economy | GPT mini (gpt-4.1-mini) | ≤ 5¢ |
| Analyse RH, drafts, planning | Balanced | GPT fort (gpt-4.1) | ≤ 20¢ |
| Documents client-visible | Premium | GPT fort (gpt-4.1) | ≤ 50¢ |
| Livrables officiels, sensibles, PDF | Premium Guarded | GPT fort + shield + ledger | ≤ 100¢ |
| Démo publique / non-payants | Disabled | Mock / Static | 0¢ |

**Principes :**
- Ne jamais mettre le modèle le plus cher partout.
- Economy pour ce qui n'est pas vu par le client.
- Premium uniquement pour ce qui sera lu par le DRH ou le salarié.
- Premium Guarded : coût shield + ledger + validation humaine systématique.

---

## 4. OpenAI-only actuel

**Toute l'IA réelle de Pierre passe par OpenAI.** C'est le seul fournisseur validé live (B38B, 5 scénarios réels, score moyen 98.8/100).

Anthropic/Claude n'est **pas une dépendance** : il n'est pas appelé, pas requis pour npm test, pas requis pour le build. Les presets B32 le référencent mais le shield le bloque. Cette configuration est stable et testée.

---

## 5. Anthropic différé — non bloquant

Les presets `premium_generation` dans `model-presets.ts` pointent vers Claude Opus 4.7. Ce choix est stratégiquement correct pour les livrables ultra-premium. Mais il est **désactivé maintenant** car :

- Budget OpenAI limité (coûts prouvés live par B38B).
- Pas de validation Anthropic live encore effectuée.
- OpenAI gpt-4.1 est suffisant pour 95% des cas Pierre actuels.

**Quand réactiver Anthropic :** une fois B44/B45 stabilisés et le budget augmenté. Les `future_provider_candidates` dans les décisions de routing marquent où Anthropic pourra intervenir.

---

## 6. Non-payants / démo = 0€ IA

Verrouillé depuis B38A, confirmé dans B38D :

- `public_demo` → provider=static, max_cost=0¢, jamais de call IA réel.
- `logged_unpaid` / `anonymous` / `qualified_prospect` / `trial_limited` → provider=mock, max_cost=0¢.
- Pas de trial open-bar 7 jours. Pas d'IA pour les prospects.
- Client payant = IA réelle sous budget contrôlé.

---

## 7. Routing par use case

La fonction `decideAiQualityRoute()` dans `quality-router.ts` est déterministe :

```typescript
// Exemple d'utilisation
const decision = decideAiQualityRoute({
  use_case: "pierre.document.generate",
  quality_class: "premium_document",
  access_level: "paid_customer",
  is_client_visible: true,
  is_official_document: false,
  is_sensitive: false,
  is_public_demo: false,
  is_unpaid: false,
});
// → model_tier: "premium_guarded"
// → provider: "openai"
// → requires_cost_shield: true
// → requires_ledger: true
```

Règles de surcharge :
- `is_public_demo=true` → force `quality_class=public_demo` (disabled)
- `is_unpaid=true` → force `quality_class=unpaid_user` (disabled)
- `is_official_document=true` → élève vers `premium_document` + `requires_human_validation`
- `is_sensitive=true` → élève vers `sensitive_analysis` + `requires_human_validation`

---

## 8. Contrats qualité des livrables Pierre

13 types de livrables couverts par `pierre-deliverable-contract.ts`. Chacun a :
- `must_include` — ce que le livrable doit contenir
- `must_never_include` — les interdictions strictes
- `human_validation_required` — validation humaine avant diffusion
- `document_style_required_later` — style kit B45 requis à terme

| Livrable | Qualité | Validation humaine | Style B45 |
|---|---|---|---|
| email_draft | client_visible | Non (mais jamais auto-envoyé) | Non |
| hr_note | operational | Non | Non |
| candidate_summary | client_visible | Non | Non |
| prepayroll_summary | premium_client_visible | **Oui** | Oui |
| certificate_draft | official_document | **Oui** | **Oui** |
| contract_draft | official_document | **Oui** | **Oui** |
| amendment_draft | official_document | **Oui** | **Oui** |
| executive_report | premium_client_visible | **Oui** | Oui |
| pdf_export | premium_client_visible | Si document officiel | **Oui** |

---

## 9. Anti "ancien ChatGPT"

Phrases interdites dans tout livrable `client_visible` et au-dessus :

```
"Voici un modèle"
"Voici un exemple"  
"N'hésitez pas à adapter"
"Cordialement, [Votre nom]"
"Signature : [Nom]"
"[À compléter]"
"[Insérez ici]"
"Lorem ipsum"
...
```

`containsForbiddenGenericPhrase()` et `validateOutputQualityLevel()` permettent de valider automatiquement le contenu avant livraison.

---

## 10. PDF/documents premium : exigence, implémentation B45

Pierre peut générer du contenu de qualité dirigeant dès maintenant (via GPT fort). Mais la **mise en page PDF premium** (logo, en-tête officiel, typographie, style tableur) dépend de B45 (Document Style Kit).

Actuellement :
- Le contenu est premium.
- La forme (PDF avec charte entreprise) est déléguée à B45.
- Le module `pierre-document-style-readiness.ts` liste les 15 exigences.

---

## 11. Empreinte Entreprise/Pierre : exigence B44/B45

L'empreinte existe déjà partiellement dans `CloneADNProfile` (B35) :
- `CloneADNDocumentProfile` — format, ton, template_ids, signature
- `CloneADNCommunicationProfile` — ton, formulations préférées/interdites

Ce qui manque pour que Pierre "apprenne" le style exact d'un client :
- Upload de documents sources (fiches de paie, contrats, attestations)
- Extraction de structure et mise en page
- Constitution du style kit visuel (logo, couleurs, typographie)
- Association entre type de document et template source

Tout cela est **B44 (Empreinte finale)** et **B45 (Style Kit / Templates officiels)**.

---

## 12. Ce qui est clôturé dans B38

- ✅ Protection financière (B38A — shield + budgets)
- ✅ Validation live OpenAI (B38B — 5 scénarios, 0.980¢)
- ✅ Ledger persistant (B38C — memory + Supabase opt-in)
- ✅ Doctrine modèle économique/premium (B38D)
- ✅ Routing qualité déterministe (B38D)
- ✅ Contrats qualité Pierre — 13 types de livrables (B38D)
- ✅ Anti "ancien ChatGPT" enforced (B38D)
- ✅ Préparation B44/B45 — types, contracts, style requirements (B38D)
- ✅ Verdict clôture B38 formalisé, score 92/100 (B38D)

---

## 13. Ce qui reste après B38

| Item | Bloc cible | Critique lancement |
|---|---|---|
| SQL/schema hardening Supabase ledger | B38C.1 | Non |
| Live Email Production (Resend) | B39 | Oui |
| Empreinte Entreprise finale | B44 | Oui |
| Document Style Kit / templates officiels | B45 | Oui |
| PDF premium complet | B45 | Oui |
| Final launch readiness audit | B48 | Oui |

---

## 14. Prochain bloc : B39 Live Email Production

B39 active les envois email réels via Resend, avec :
- Rate limiting par destinataire/entreprise
- Templates email selon CloneADN (ton, signature)
- Validation humaine avant envois sensibles
- Audit trail (B38C ledger ou équivalent)
- Jamais d'envoi autonome sans validation
- Tests live Resend (en sandbox d'abord)

---

## Architecture des modules B38D

```
src/lib/cloneos/ai/quality-policy/
  types.ts                    — AiModelTier, AiUseCaseQualityClass, AiModelRoutingDecision,
                                OutputQualityLevel, OutputQualityContract, PierreDeliverableType,
                                PierreDeliverableQualityContract, DocumentStyleKitRequirement,
                                B38FinalClosureVerdict
  model-tier-policy.ts        — Table déterministe qualityClass → tier/provider/cost
  output-quality-contract.ts  — Contrats génériques basic_internal → official_document
  premium-deliverable-policy.ts — Guards premium (pdf, sensitive, executive)
  quality-router.ts           — decideAiQualityRoute()
  b38-final-readiness.ts      — buildB38FinalClosureVerdict()

src/lib/pierre/quality/
  pierre-quality-policy.ts         — Pierre use-cases → quality classes
  pierre-deliverable-contract.ts   — 13 contrats qualité livrables
  pierre-document-style-readiness.ts — 15 exigences style kit B44/B45
```
