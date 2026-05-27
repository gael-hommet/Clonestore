# B42 — Workflow Gap Register

**Date:** 2026-05-27  
**Statut:** DOCUMENTÉ — gaps connus, non bloquants pour B42  

---

## Gaps documentés B42

### GAP-1 — Supabase adapters non câblés en production

| Champ | Valeur |
|-------|--------|
| Sévérité | Moyen |
| Impact | Pas de persistance DB en runtime réel |
| Workaround | `buildFakeB42Adapters()` utilisé en tests |
| Résolution cible | B43+ |

Les `B42WorkflowAdapters` (logTrace, recordArtifact) utilisent des implémentations in-memory dans les tests. Les vraies implémentations Supabase (insertPierreTrace, insertPierreArtifact) doivent être câblées dans les routes API de production.

---

### GAP-2 — Pas de génération IA réelle dans les workflows

| Champ | Valeur |
|-------|--------|
| Sévérité | Fonctionnel |
| Impact | Les tâches `doc.generate` produisent `artifact_pending=true` sans contenu IA |
| Raison | Choix architectural B40+ : Claude ne s'appelle pas lui-même |
| Résolution cible | Câblage IA dans route /api/pierre/execute existante (B43+) |

Le moteur workflow génère les tâches et les métadonnées. La génération du contenu IA se fait via `executePierreTask` → payload.text_content / html_content, non encore rempli automatiquement.

---

### GAP-3 — Email.send jamais envoyé (par design B39)

| Champ | Valeur |
|-------|--------|
| Sévérité | None — comportement attendu |
| Impact | Aucun email n'est envoyé sans validation explicite |
| Raison | Politique B39 : email_mode=mock permanent |
| Résolution cible | Non applicable — c'est une garantie, pas un gap |

Les scénarios utilisent `email.draft`, jamais `email.send`. C'est la garantie de sécurité B39.

---

### GAP-4 — PDF en mode artifact_pending

| Champ | Valeur |
|-------|--------|
| Sévérité | Faible |
| Impact | `pdf.generate` produit `artifact_pending=true` sans PDF réel |
| Raison | Pas de renderer PDF intégré dans le workflow engine |
| Résolution cible | B43+ — intégration renderer PDF |

---

### GAP-5 — Rate limiting non câblé dans le workflow runtime

| Champ | Valeur |
|-------|--------|
| Sévérité | Faible |
| Impact | Le runtime B42 n'applique pas de rate limit au niveau workflow |
| Raison | Rate limiting déjà appliqué au niveau route (B41) |
| Résolution cible | Non critique — couvert par la couche route |

---

### GAP-6 — Cron-triggered workflows non testés dans B42

| Champ | Valeur |
|-------|--------|
| Sévérité | Faible |
| Impact | Les workflows déclenchés par cron ne passent pas par le runtime B42 |
| Raison | Les routes cron sont testées séparément |
| Résolution cible | B43+ intégration si besoin |

---

### GAP-7 — Domaines non couverts : contract, offboarding, training

| Champ | Valeur |
|-------|--------|
| Sévérité | Faible |
| Impact | 3 domaines HR non testés dans B42 |
| Raison | Couvert par les modules pure existants — pas de gap technique |
| Résolution cible | B43+ si scénarios spécifiques requis |

Ces domaines sont pris en charge par `buildPierreHrWorkflowPlan()` et les tests unitaires existants en B38-B40. Les 8 scénarios B42 couvrent les domaines les plus critiques opérationnellement.

---

### GAP-8 — Droit de rectification RGPD non implémenté

| Champ | Valeur |
|-------|--------|
| Sévérité | Légal (B41) |
| Impact | RGPD art. 16 non couvert |
| Résolution cible | B43+ (reporté depuis B41) |

Déjà documenté en B41_RGPD_EXPORT_PURGE.md §5.

---

## Matrice risque / impact

| GAP | Bloque B42 ? | Bloque lancement prod ? |
|-----|-------------|------------------------|
| GAP-1 (Supabase) | Non | Non (si tests OK) |
| GAP-2 (IA content) | Non | Non (route execute gère) |
| GAP-3 (Email draft) | Non | Non (garantie par design) |
| GAP-4 (PDF) | Non | Non (feature optionnelle) |
| GAP-5 (Rate limit) | Non | Non (B41 route level) |
| GAP-6 (Cron) | Non | Non |
| GAP-7 (Domaines) | Non | Non |
| GAP-8 (RGPD art.16) | Non | **Oui (légal)** |

**Conclusion:** aucun gap ne bloque la fermeture de B42. GAP-8 est à traiter avant lancement public (B43+).
