# P-FINAL 01 — Guide de la démo publique

**Phase: 9 — Public Launch Closure**
**Audience: Équipe produit + marketing**

---

## Objectif de la démo

La démo publique (`/demo/pierre`) permet à un visiteur non-authentifié de voir Pierre en action **sans aucune interaction réelle** : pas d'IA appelée, pas d'email envoyé, pas de compte créé, pas de paiement demandé.

Elle sert à convertir un visiteur en client payant en montrant les fonctionnalités de Pierre avec des données fictives sécurisées.

---

## Ce que la démo fait

| Action | Comportement |
|--------|-------------|
| Afficher des tâches RH | ✅ Données fictives (Acme SAS) |
| Afficher des brouillons de documents | ✅ Réponses pré-écrites |
| Afficher des brouillons d'emails | ✅ Contenu statique simulé |
| Appeler l'API OpenAI/Anthropic | ❌ Bloqué — jamais en démo |
| Envoyer un vrai email | ❌ Bloqué — jamais en démo |
| Créer un vrai compte | ❌ Bloqué — jamais en démo |
| Initier un checkout Stripe | ❌ Bloqué — la démo ne coûte rien |
| Accéder à des données réelles | ❌ Bloqué — données fictives uniquement |

---

## Architecture de sécurité

### DemoSession (toujours vrai, non-modifiable)

```typescript
import { createDemoSession } from "@/lib/demo/public-demo/demo-session";

const session = createDemoSession();
// {
//   is_real_account: false,         // jamais true
//   ai_calls_allowed: false,        // jamais true
//   email_send_allowed: false,      // jamais true
//   stripe_checkout_allowed: false, // jamais true
//   max_actions: 20,
//   duration_minutes: 30,
// }
```

### Règles absolues (non-contournables)

```typescript
import { guardDemoOperation } from "@/lib/demo/public-demo/demo-guard";

// Ces opérations sont TOUJOURS bloquées en démo:
guardDemoOperation("ai_api_call");      // blocked
guardDemoOperation("email_send");       // blocked
guardDemoOperation("stripe_checkout"); // blocked
guardDemoOperation("database_write");  // blocked
guardDemoOperation("account_create");  // blocked
```

---

## Données fictives utilisées

### Entreprise fictive

```
Acme SAS — Entreprise de démonstration
SIRET: 000 000 000 00000 (fictif)
Secteur: Services B2B
Effectif simulé: 3 employés
```

### Employés fictifs

| Nom | Poste | Contrat |
|-----|-------|---------|
| Marie Dupont | Développeuse Full-Stack | CDI |
| Jean Martin | Chef de Projet | CDI |
| Sophie Bernard | Office Manager | CDI |

### Tâches simulées

1. **Onboarding Marie Dupont** — Tâche complète avec brouillons de contrat, email de bienvenue
2. **Congé Jean Martin** — Tâche de gestion d'absence avec brouillon de confirmation

### Réponses Pierre simulées

5 réponses pré-écrites couvrant : contrat de travail, email de bienvenue, gestion de congés, réponse à réclamation, brouillon de compte-rendu.

---

## Disclaimers obligatoires

La page de démo affiche systématiquement :

**Disclaimer court (dans le header) :**
> "Démo illustrative — Données fictives. Pierre n'envoie rien, ne stocke rien."

**Disclaimer complet (en bas de page) :**
> "Cette démonstration utilise des données entièrement fictives. Pierre ne remplace pas un avocat, un expert-comptable ou un logiciel de paie officiel. Tous les documents produits par Pierre sont des brouillons soumis à validation humaine obligatoire avant usage. Pierre ne garantit pas la conformité légale de ses productions."

**Disclaimer légal (footer) :**
> "Pierre — Assistant IA. Brouillons soumis à validation humaine. Aucun conseil juridique ou comptable."

---

## Scénarios disponibles

| Scénario | Description | Durée estimée |
|----------|-------------|---------------|
| Onboarding RH | Pierre génère le contrat + email de bienvenue | ~3 min |
| Gestion des congés | Pierre traite une demande d'absence | ~2 min |
| Mission prépayée | Vue du cockpit avec tâche en cours | ~2 min |

---

## Page de démo — Structure

```
/demo/pierre
├── DemoWarningBanner          — Bannière orange "DÉMO — Données fictives"
├── DemoSafetyBadges           — 5 badges de sécurité
├── CockpitStats               — Statistiques simulées (3 employés, 2 tâches)
├── EmployeeCards              — 3 cartes employés fictifs
├── TaskCards                  — 2 tâches avec réponses Pierre simulées
├── ScenarioCards              — 3 scénarios disponibles
├── CTA                        — "Abonnez-vous — 449€/an"
└── PierreFullDisclaimer       — Disclaimer légal complet
```

---

## Test de la démo avant lancement

Parcours de validation (golden path) :

1. Aller sur `/demo/pierre` sans être connecté
2. Vérifier la bannière orange "DÉMO — Données fictives" visible
3. Vérifier les 5 badges de sécurité visibles
4. Cliquer sur une tâche → voir la réponse Pierre simulée
5. Vérifier que le bouton CTA pointe vers l'abonnement (pas un checkout démo)
6. Vérifier que le disclaimer légal est présent en bas de page
7. Inspecter le réseau → aucun appel API externe déclenché

---

## Coût de la démo

**La démo ne coûte rien en production.**

- Pas d'appels OpenAI/Anthropic
- Pas d'envoi Resend
- Pas de transaction Stripe
- Données entièrement statiques

Seul coût : rendering Next.js côté serveur = négligeable.

---

## Monitoring de la démo

Métriques à surveiller après lancement :
- Taux de visite `/demo/pierre`
- Taux de conversion démo → abonnement (clic CTA)
- Erreurs JavaScript sur la page
- Temps de chargement (objectif: < 2s)

---

*P-FINAL 01 — Phase 9 — Guide de la démo publique Pierre*
