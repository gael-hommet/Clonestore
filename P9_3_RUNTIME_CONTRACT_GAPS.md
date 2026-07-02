# P9.3 — Runtime Contract Gaps (prouvés)

> Manques RÉELS des contrats runtime V1 constatés pendant la construction du
> cockpit client. Aucun backend parallèle inventé ; la lane P8 n'est pas modifiée.
> Le cockpit implémente l'UX la plus honnête possible dans les limites du contrat.

## GAP-1 — Les décisions de validation n'acceptent pas de motif/instruction

**Constat (preuve).** La route V1 unique
`src/app/api/pierre/v1/validations/[id]/[action]/route.ts` (approve | reject |
request-changes) ne lit du corps **que** `version` :

```ts
return apiDecideValidation(db, ctx, id, mapped, Number(body.version ?? 1));
```

Le client typé correspondant (`src/lib/pierre/v1/client.ts`) expose de même
`rejectValidation(validationId, version)` et
`requestValidationChanges(validationId, version)` — **aucun paramètre `reason` /
`instruction`**.

**Conséquence produit.** La spec P9.3 §6 demande « motif obligatoire » au refus et
« instruction obligatoire » à la demande de modifications. Le contrat réel **ne
transporte pas** ce texte. Envoyer un motif serait du théâtre (collecté puis jeté).

**Décision honnête (implémentée).** Le cockpit ne fabrique aucun canal de motif. À
la place :
- refus / demande de modifications = **confirmation explicite** (garde
  d'irréversibilité, double intention) avant mutation ;
- approbation d'action **sensible** = confirmation explicite ;
- toute décision passe la **version courante** (verrou optimiste) ; un
  409/412 « la validation a déjà changé » est présenté et l'état est relu.

**Levée (lane P8, hors P9.3).** Ajouter un champ `reason` optionnel au corps de la
route de décision V1 + au client typé, puis le cockpit branchera un champ motif
requis. Aucune modification P8 effectuée ici.

## GAP-2 — Pas de liste de documents/livrables par mission dans le contrat V1

**Constat.** Le `MissionView` V1 expose `tasks[]` (avec `type`, `status`,
`approval_required`, `result: unknown`) mais **aucune liste `documents[]`**
dédiée. Les livrables réels sont les **sorties de tâches** documentaires
(`doc.generate`, `pdf.generate`, `email.*`).

**Décision honnête (implémentée).** Le cockpit dérive les livrables des tâches
documentaires réelles (`deriveV1Artifacts`) avec un statut d'affichage fidèle
(brouillon / à valider / validé / envoyé / à relire). Aucun faux document, aucun
placeholder téléchargeable. Le téléchargement réel reste assujetti au lien signé
sécurisé existant `/agents/pierre/use/secure/[token]` lorsqu'un token est émis par
le runtime.

**Levée (lane P8, hors P9.3).** Exposer un contrat `GET /api/pierre/v1/missions/{id}/documents`
(nom, famille, version, statut, signature, lien signé) ; le cockpit le consommera
directement.

---

Ces deux gaps ne sont **pas bloquants** pour livrer un cockpit opérationnel réel :
les décisions de validation fonctionnent (version + confirmation), et les livrables
réels sont affichés depuis les tâches. Ils sont documentés pour la lane P8.
