# C1.8 A2 — Référentiel canonique minimal (faits, pas de règles de jugement)

Ce document ne contient que des faits produit vérifiables, utiles pour juger l'exactitude d'une
réponse CloneChat. Il ne contient aucune règle de routage, aucune regex, aucune réponse attendue
par cas et aucun résultat d'un tour précédent.

## CloneStore
- CloneStore est une boutique d'employés IA d'entreprise : des employés IA opérationnels, gouvernés
  et tracés.
- Le premier employé IA est **Pierre**, employé IA RH.

## Pierre
- Pierre est un employé IA RH opérationnel : il transforme des demandes en missions RH structurées,
  prépare des documents et suivis RH, centralise dans un cockpit tracé.
- **Les décisions sensibles restent sous validation humaine** — Pierre ne décide jamais seul d'un
  licenciement, d'une sanction disciplinaire finale, ou d'une décision salariale finale.
- Pierre **ne remplace pas un conseil juridique** et ne fournit aucune garantie de conformité
  légale.
- Pierre **ne doit jamais prétendre avoir déjà exécuté une action réelle** (mission créée, document
  signé, compte activé, paiement effectué) dans le contexte d'un visiteur public non connecté — un
  tel visiteur n'a structurellement aucun accès à une entreprise, un compte ou une action réelle.

## Prix
- France, Belgique, Luxembourg : **449 €/mois**.
- Suisse : **499 CHF/mois**.
- **Pas d'essai gratuit.**
- Abonnement mensuel.

## Pays de lancement
- **FR, BE, LU, CH** uniquement. Aucun autre pays n'est un marché de lancement actuel.

## Démonstration
- Une démonstration de Pierre est disponible (parcours immersif), distincte de l'achat/réservation.

## Rôle des routes canoniques (destination → à quoi elle sert)
| Route | Rôle |
|---|---|
| `/reserver/pierre` | Réserver Pierre / voir le prix et démarrer l'activation |
| `/demo/pierre` | Voir Pierre en action (démonstration) |
| `/demo` | Démonstration générale de CloneStore |
| `/agents/pierre` | Présentation de Pierre : ce qu'il fait, ses missions, ses limites |
| `/agents` | Catalogue des employés IA |
| `/comprendre-clonestore` | Présentation générale de CloneStore, sa méthode |
| `/founding-partners` | Programme des partenaires fondateurs (revendeurs, apporteurs, marque blanche) |
| `/login` | Se connecter à un espace CloneStore existant |
| `/signup` | Créer un nouveau compte CloneStore |
| `/profile` | Espace personnel « Mon CloneStore » (authentifié) |
| `/agents/pierre/use` | Cockpit Pierre (piloter les missions, authentifié, entreprise requise) |
| `/agents/pierre/employees` | Vue « Employé 360 » des salariés dans Pierre (authentifié, entreprise requise) |
| `/profile/onboarding` | Configuration de l'entreprise (authentifié, entreprise requise) |
| `/profile/technologies` | Technologies activées pour l'entreprise (authentifié, entreprise requise) |
| `/assistant` | CloneChat lui-même |
| `/questions` | Support / FAQ |
| `/legal/cgu`, `/legal/cgv`, `/legal/confidentialite`, `/legal/dpa`, `/legal/mentions` | Pages légales (CGU, CGV, confidentialité/RGPD, DPA, mentions légales) |

## Contexte de l'utilisateur pour CE jugement
- Visiteur **non connecté**, **aucune entreprise active**.
- Le pays de l'utilisateur n'est **pas déterminé**, sauf si le message l'indique explicitement.
- CloneChat est l'assistant public de CloneStore répondant à ce visiteur.
