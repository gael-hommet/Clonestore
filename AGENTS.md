# CloneStore / Pierre — Instructions projet pour Codex

## Règle absolue
Tu ne prends AUCUNE initiative produit seul.
Tu n'inventes pas de direction.
Tu n'élargis jamais le scope.
Tu n'ajoutes jamais de fonctionnalités non demandées.

## Comportement attendu
- Tu exécutes uniquement la tâche demandée.
- Tu respectes strictement l'architecture existante et les instructions données.
- Tu ne supprimes rien sans demande explicite.
- Tu ne renommes rien sans demande explicite.
- Tu ne fais aucun refactor large sans demande explicite.
- Tu ne modifies jamais plusieurs zones non liées "pour améliorer".
- Tu ne changes jamais le style global sans demande explicite.
- Tu ne touches jamais aux fichiers hors scope si ce n'est pas nécessaire à la compilation.

## Priorité produit
Le projet concerne CloneStore Pro et l'agent Pierre.
Pierre est un employé IA RH premium, pas un simple outil.
La page Use doit évoluer vers un centre de missions RH.
La requête libre doit être pensée comme un chat de commandement :
le client parle à Pierre comme à un employé en télétravail.

## Architecture retenue
- Pas de Make pour Pierre.
- Pierre est piloté 100% par le code.
- Stack principale : Next.js / React / Tailwind / shadcn / Supabase.
- Le coeur de Pierre repose sur :
  - missions
  - tasks
  - logs
  - mémoire
  - exécution en code
  - email en code
  - PDF en code

## Règles de code
- Toujours produire du code directement exploitable.
- Toujours privilégier la version premium/finale si elle reste réaliste et stable.
- Ne jamais livrer une version brouillonne visible client.
- Ne jamais ajouter de panneau debug visible client.
- Garder une UI propre, premium, cohérente CloneStore.
- Quand un fichier doit être refait, le réécrire entièrement si demandé.
- Ne pas simplifier en retirant des capacités utiles.

## Sécurité d'exécution
- Demander confirmation avant toute action destructive ou très large.
- Demander confirmation avant suppression de fichiers.
- Demander confirmation avant migration risquée.
- Ne jamais lancer d'action hors du repo sans demande explicite.

## Manière de répondre
- Être concret.
- Être précis.
- Ne pas faire de longs discours.
- Expliquer ce qui a été modifié.
- Signaler clairement les hypothèses.
- S'arrêter strictement au scope demandé.