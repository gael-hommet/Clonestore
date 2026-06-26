# GO-LIVE 07 — Public Funnel Link Map

Documenting the exact navigation paths a prospect can take through the public CloneStore funnel.

---

## Primary prospect journey

```
Homepage (/)
├── [Hero CTA primary]  → /demo/pierre            ✓ "Voir la démo Pierre"
├── [Hero CTA secondary]→ /agents                 ✓ "Découvrir les employés"
├── [Hero CTA tertiary] → /assistant              ✓ "Parler à CloneChat"
├── [Employee card Pierre > Voir la fiche] → /agents/pierre  ✓
├── [Employee card Pierre > Voir la démo] → /demo/pierre     ✓
└── [Final CTA] → /agents                         ✓ "Découvrir les employés"
               → /questions                       ✓ "Poser une question"
```

```
/agents (Boutique)
├── [Pierre card > Voir]  → /agents/pierre        ✓
├── [Pierre card > Démo]  → /demo/pierre          ✓
├── [Pierre card > Activer] → /checkout?agent=pierre  ✓
└── [Other agents > Question] → /questions        ✓
```

```
/agents/pierre (Pierre page)
├── [Hero CTA primary]  → /demo/pierre            ✓ "Voir la démo Pierre"
├── [Hero CTA secondary]→ /paiement               ✓ "Préparer l'accès"
├── [Hero CTA tertiary] → /questions              ✓ "Poser une question"
├── [Demo block CTA]    → /demo/pierre            ✓ "Voir la démo Pierre"
├── [Final CTA primary] → /demo/pierre            ✓ "Voir la démo Pierre"
├── [Final CTA secondary]→ /paiement              ✓ "Préparer l'accès"
└── [Final CTA tertiary]→ /questions              ✓ "Parler à CloneStore"
```

```
/demo/pierre (Demo interactive)
├── [Hero CTA primary]  → /agents/pierre          ✓ "Découvrir Pierre"
├── [Hero CTA secondary]→ /legal/cgv              ✓ "Voir les CGV"
├── [CTA section primary] → /agents/pierre        ✓ "Voir l'offre Pierre"
├── [CTA section secondary] → /legal/confidentialite  ✓ "Politique de confidentialité"
└── [Footer links] → /legal/cgu, /legal/cgv, /legal/confidentialite  ✓
```

```
/questions (Support / FAQ)
├── [Hero CTA primary]  → /assistant              ✓ "Ouvrir CloneChat"
├── [Hero CTA secondary]→ /agents                 ✓ "Voir les employés IA"
├── [FAQ Pierre header] → /demo/pierre            ✓ "Voir la démo Pierre"
├── [Support cards]     → /assistant              ✓ each card
└── [Contact]           → mailto:support@clonestore.pro  ✓
```

```
/checkout (Checkout)
├── [Back links] → /agents/pierre                 ✓ "Voir Pierre"
├── [Back links] → /agents                        ✓ "Retour boutique"
├── [Back links] → /assistant                     ✓ "Demander à CloneStore"
├── [Login CTA]  → /login?redirect=/checkout...  ✓
├── [Legal note] → /legal/cgv                    ✓ "CGV"
└── [Legal note] → /legal/confidentialite        ✓ "politique de confidentialité"
```

```
/paiement/success (Post-purchase success)
├── [CTA active state] → /agents/pierre/use      ✓ "Accéder à Pierre"
├── [CTA active state] → /agents/pierre/use      ✓ "Configurer Pierre"
└── [CTA]             → /profile                 ✓ "Mon CloneStore"
```

```
/paiement/cancel (Checkout cancelled)
├── [CTA primary]   → /checkout?agent=pierre     ✓ "Reprendre le paiement"
├── [CTA secondary] → /demo/pierre               ✓ "Voir la démo Pierre"  ← Added GO-LIVE 07
├── [CTA tertiary]  → /agents                    ✓ "Retour boutique"
└── [CTA]          → /assistant                  ✓ "Demander à CloneStore"
```

---

## Funnel link matrix

| From page          | Links to /demo/pierre | Links to /agents/pierre | Links to /agents | Links to /questions |
|--------------------|----------------------|------------------------|-----------------|---------------------|
| /                  | ✓ Hero CTA + card    | ✓ Pierre card           | ✓ Hero + footer  | ✓ Final CTA          |
| /agents            | ✓ Pierre card Démo   | ✓ Pierre card Voir      | —               | ✓ Other agent cards  |
| /agents/pierre     | ✓ Hero + Demo block + Final | —                | —               | ✓ Hero + Final CTA   |
| /demo/pierre       | —                    | ✓ Hero CTA + CTA section| —               | —                   |
| /questions         | ✓ FAQ header link    | —                       | ✓ Hero CTA       | —                   |
| /checkout          | —                    | ✓ "Voir Pierre"         | ✓ "Retour boutique"| —                 |
| /paiement/success  | —                    | ✓ /agents/pierre/use    | —               | —                   |
| /paiement/cancel   | ✓ "Voir la démo"     | —                       | ✓ "Retour boutique"| —                 |

---

## Missing links identified

| Gap                                            | Severity | Decision                                    |
|------------------------------------------------|----------|---------------------------------------------|
| Homepage final CTA has no /demo/pierre link    | Low      | Hero CTA already covers demo — acceptable   |
| /paiement/success has no /demo/pierre link     | Low      | Post-purchase, demo is no longer relevant   |
| /checkout has no /demo/pierre link             | Low      | User already decided to buy — acceptable    |

---

## Legal links coverage

| Page              | /legal/cgv | /legal/confidentialite | /legal/cgu |
|-------------------|------------|------------------------|------------|
| /demo/pierre      | ✓          | ✓                      | ✓          |
| /checkout         | ✓ (note)   | ✓ (note)               | —          |
| /paiement/success | —          | —                      | —          |
| /paiement/cancel  | —          | —                      | —          |

Note: Legal pages (/legal/cgv, /legal/cgu, /legal/confidentialite) must exist and be complete
before public launch. Currently pending société immatriculée + juriste.

---

_GO-LIVE 07 — 2026-05-31_
