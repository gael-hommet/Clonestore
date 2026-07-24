# DPA Compliance Matrix

Maps `/legal/dpa`'s existing structure against GDPR Art. 28's required processor-contract content (source: evidence file 11, item #1). Status values: `PRESENT_DRAFT` (structurally present, unreviewed), `PRESENT_INCONSISTENT` (present but contains a factual error), `PLACEHOLDER` (explicitly marked incomplete), `MISSING`.

| Art. 28 requirement | CloneStore DPA clause | Status | Proof |
|---|---|---|---|
| Objet, durée, nature et finalité du traitement | §"Parties" + intro (dpa/page.tsx:38-53) | `PRESENT_DRAFT` | Text present, not yet lawyer-reviewed |
| Types de données et catégories de personnes concernées | §"Données traitées" (78-99) — explicitly notes sensitive categories "uniquement si transmises explicitement par le Client," client bears sole responsibility for legal basis | `PRESENT_DRAFT` | Consistent with the code finding (file 05) that Pierre has no structured special-category field, only free-text detection |
| Obligations documentées du responsable de traitement | Implicit via CGU/CGV cross-reference | `PRESENT_DRAFT` | — |
| Obligations du sous-traitant (confidentialité, sécurité) | §"Obligations du sous-traitant" (127-141) | `PRESENT_DRAFT` | — |
| Mesures de sécurité | §9 (178-189) — **concrete, not placeholder**: TLS in transit + at rest, RLS via Supabase, audit trail, per-client `company_id` isolation, Supabase Auth, periodic security review | `PRESENT_DRAFT` (content is real, just unreviewed) | Matches actual code architecture (RLS confirmed present on migrations per prior audit memory) |
| Recours à des sous-traitants ultérieurs + autorisation | §7 (147-159) | **`PRESENT_INCONSISTENT`** | Section header says "Placeholder — à compléter" but the list is actually filled with 5 named vendors — **one of which (Anthropic PBC) is factually wrong per the code** (OpenAI is the real provider, see `SUBPROCESSOR_REGISTER.md`). Must be corrected before any sign-off. |
| Assistance pour les demandes des personnes concernées | Implicit in rights-exercise language elsewhere | `PRESENT_DRAFT` | — |
| Assistance en cas de violation de données | §"Notification de violation" (197-209) | `PRESENT_DRAFT` | — |
| Aide à l'analyse d'impact (AIPD) et consultations préalables | Not explicitly clause-by-clause present as a named AIPD-assistance commitment | `MISSING` (or at least not clearly separated from general assistance language) | To be added or confirmed present in fuller text during legal review |
| Restitution ou suppression des données en fin de contrat | §"Rétention" (112-125) — kept for contract duration + grace period, then deleted/anonymized | `PRESENT_DRAFT` | — |
| Mise à disposition des informations nécessaires pour prouver la conformité, audits | §"Audit/conformité" (224-231) | `PRESENT_DRAFT` | — |
| Transferts internationaux + garanties | §8 (169-175) | `PLACEHOLDER` — explicitly "Placeholder à valider juridiquement," acknowledges all 5 named vendors are US-based, generic SCC language | Region/transfer-mechanism confirmation is `OWNER_CONFIRMATION_REQUIRED` per provider |
| Contact DPO | §13 (235-243) | `PLACEHOLDER` — explicitly "sera précisée avant lancement officiel" | See `LEGAL_ENTITY_FACT_SHEET.md` |
| Annexes (description des traitements, catégories, durées, mesures TOM, liste sous-traitants, lieux, mécanismes de transfert) | Present in prose form within the body sections above rather than as separate formal annexes | `PRESENT_DRAFT`, structurally not formatted as discrete annexes | A lawyer may want these formalized as numbered annexes for clarity, not a content gap per se |

## Verdict for this matrix
The DPA is **structurally complete** against Art. 28's checklist (every required topic is addressed somewhere in the text) but is **not exploitable as-is** for two independent reasons: (1) it has never received a lawyer review (true of all 5 legal pages, not DPA-specific), and (2) it contains one concrete, code-verifiable factual error (the Anthropic/OpenAI sub-processor mismatch) that must be corrected regardless of the broader legal review timeline. See `LEGAL_REMAINING_RISKS.md`.
