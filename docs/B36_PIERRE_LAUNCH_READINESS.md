# B36 — Pierre Launch Readiness

**Date:** 2026-05-25  
**Verdict:** `almost_sellable`  
**Score:** ~79/100  
**Stratégie recommandée:** Bêta fermé (5-10 clients pilotes)

---

## Verdict final

**Pierre est vendable avec réserves à 449€/mois.**

Le moteur RH est prouvé. La gouvernance est solide. 4685 tests passent. Le socle est honnêtement construit. Mais les providers réels (email, fichiers) ne sont pas connectés, et plusieurs workflows restent partiels.

**Pierre ne doit pas être lancé comme un produit fini. Pierre doit être lancé comme un assistant RH opérationnel en bêta — avec des limites explicites dans les CGV.**

---

## Ce que Pierre fait vraiment bien

| Capacité | Preuve |
|---|---|
| Pipeline mission complet | 79 routes API, 5 étapes submit→brain→guard→governance→DB |
| Sécurité absolue email | email.send → email.draft forcé, never_auto_execute respecté |
| Gouvernance (CloneGuard / ClonePolicy / CloneTrust) | Testé exhaustivement, y compris edge cases |
| CloneADN | Fingerprint entreprise, règles, préférences, appliqués à chaque action |
| B35 context pack | Pierre sait ce qu'il sait avant d'agir — 66 tests, 12 scopes |
| Piste d'audit | 20+ types d'événements, multi-tenant, log immuable |
| Documents premium | 15+ templates RH, génération HTML/PDF |
| Suite de tests | 4685 tests, 13 scénarios dorés, tsc clean, build clean |

---

## Ce que Pierre ne fait pas encore

| Limite | Impact opérationnel |
|---|---|
| Envoi email non connecté | Pierre rédige, le RH envoie manuellement |
| Extraction PDF/DOCX mockée | Pierre ne peut pas lire les documents uploadés |
| Pas d'intégration SIRH | Données saisies manuellement ou via API |
| Pas d'intégration paie | Variables préparées mais non transmises à Silae/Sage/ADP |
| Pas d'eSign | Contrats imprimés ou uploadés manuellement dans DocuSign/Yousign |
| Pas de test navigateur E2E | Risque de bugs UI non détectés |
| Qualité IA non benchmarkée | À valider sur des missions réelles avant lancement public |

---

## Stratégie de lancement recommandée

### Phase 1 — Bêta fermé (J+0 à J+60)

**Cible:** 5-10 clients pilotes PME (20-200 salariés), secteur tertiaire, RH non-full-time.

**Conditions:**
1. Annoncer honnêtement dans les CGV : *"Pierre rédige et prépare, l'envoi reste sous votre contrôle."*
2. Fournir un guide de démarrage qui explique les limites actuelles
3. Collect feedback hebdomadaire sur les missions réelles
4. Surveiller la qualité des outputs AI sur les premières missions

**Prix:** 449€/mois justifiable avec réserves. Proposer une réduction bêta (ex: 299€) pour les pilotes en échange de feedback.

### Phase 2 — Connecter les providers réels (J+30 à J+90)

Priorités techniques sprint 1 post-bêta:
1. **Resend ou SendGrid** pour l'envoi email réel
2. **pdf-parse + mammoth** pour l'extraction de fichiers réels
3. **Test E2E Playwright** sur les parcours critiques cockpit
4. **Pilot AI quality benchmark** — 20 missions réelles, évaluation manuelle

### Phase 3 — Lancement public (J+90)

Si bêta valide les retours et que providers 1-2 sont connectés:
- Score attendu post-Phase 2: **~88/100** (`almost_sellable` → plafond `sellable`)
- Lancement public à 449€/mois justifiable

---

## Workflows prêts pour la démo commerciale

Ces workflows peuvent être démontrés à un prospect aujourd'hui:

| Workflow | Ce que Pierre fait |
|---|---|
| Onboarding docs | Génère la lettre de bienvenue et le résumé contrat |
| Offre d'embauche | Génère la lettre d'offre avec CloneADN ton + validation RH |
| Renouvellement contrat | Détecte le contexte, génère l'avenant, demande validation |
| Justification absence | Classifie, enregistre, met à jour le dossier salarié |
| Préparation paie | Collecte les variables, génère un récapitulatif |
| Dossier salarié 360 | Synthèse complète avec missions, risques, préférences |
| Cas sensible | Bloque automatiquement, escalade vers RH — comportement légalement sûr |
| Email interne | Rédige avec le ton et la signature CloneADN de l'entreprise |

---

## Ce qu'il ne faut PAS promettre à un prospect

- ❌ "Pierre envoie les emails à la place du RH" — pas encore vrai
- ❌ "Pierre lit et analyse les contrats uploadés" — pas encore vrai
- ❌ "Pierre se connecte à votre SIRH" — pas encore vrai
- ❌ "Pierre génère des DSN" — pas encore vrai
- ❌ "Pierre gère la signature électronique" — pas encore vrai

---

## Scoring détaillé par dimension

```
Mission & Task Engine    [████████░] 13/15  (87%)
HR Workflows Coverage    [██████░░░] 13/20  (65%)
Governance               [█████████] 15/15  (100%)
Audit Trail & Continuity [████████░]  8/10  (80%)
Documents & Livrables    [███████░░]  7/10  (70%)
Files/Channels/Context   [████████░] 12/15  (80%)
Billing & Access         [█████████]  5/5   (100%)
Tests & Build            [████████░]  9/10  (90%)
──────────────────────────────────────────────────
TOTAL                                 79/100
VERDICT                     ALMOST SELLABLE
```

---

## Conclusion

Pierre mérite d'être lancé. Le socle est sérieux. La gouvernance est rigoureuse. Le moteur est prouvé. Les tests donnent confiance.

Les gaps sont connus, documentés, et mitigeables par un messaging honnête. Pierre n'est pas un prototype. Pierre est un **assistant RH opérationnel** qui rédige, prépare, classe, alerte, et protège — en attendant que les providers réels soient connectés pour qu'il envoie aussi.

**Verdict: lancer en bêta fermé maintenant. Lancer en public après connexion des providers email et fichier.**
