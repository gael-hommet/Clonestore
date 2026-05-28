# B47 — Pierre Allowed and Forbidden Commercial Claims

## Safe Claims (use these)

| ID | Claim |
|---|---|
| p-safe-01 | "Pierre assiste vos équipes RH au quotidien." |
| p-safe-02 | "Pierre automatise une grande partie des tâches RH opérationnelles répétitives." |
| p-safe-03 | "Pierre prépare des brouillons de documents RH sous validation humaine." |
| p-safe-04 | "Pierre aide vos équipes à gagner du temps sur les tâches RH administratives." |
| p-safe-05 | "Pierre réduit le coût de traitement administratif RH." |
| p-safe-06 | "Pierre structure et centralise les éléments variables de pré-paie." |
| p-safe-07 | "Pierre génère des modèles de documents RH personnalisés à valider par vos équipes." |
| p-safe-08 | "Pierre prépare des brouillons de communications RH internes." |

## Forbidden Claims (never use these)

| ID | Forbidden Claim | Safe Rewrite |
|---|---|---|
| p-forb-01 | "Pierre remplace votre service juridique." | "Pierre complète votre service RH, sans remplacer un conseil juridique." |
| p-forb-02 | "Pierre garantit la conformité légale de vos documents RH." | "Pierre prépare vos documents RH — la conformité finale reste à valider par vos équipes ou un conseil." |
| p-forb-03 | "Pierre remplace votre logiciel de paie." | "Pierre prépare les éléments variables de pré-paie — il ne remplace pas un logiciel de paie certifié." |
| p-forb-04 | "Pierre prend les décisions RH à votre place." | "Pierre assiste vos décisions RH — la décision finale reste humaine." |
| p-forb-05 | "Pierre garantit zéro erreur sur vos documents RH." | "Pierre réduit les erreurs courantes sur les documents RH — validation humaine recommandée pour tout document officiel." |
| p-forb-06 | "Pierre envoie automatiquement vos communications RH." | "Pierre prépare vos communications RH — vous gardez le contrôle de l'envoi." |
| p-forb-07 | "Pierre remplace un expert-comptable." | "Pierre facilite la préparation de la pré-paie pour votre expert-comptable." |
| p-forb-08 | "Pierre peut licencier un salarié automatiquement." | "Pierre peut préparer un dossier de licenciement — la décision et la procédure restent humaines." |
| p-forb-09 | "Pierre est juridiquement autonome." | "Pierre assiste vos équipes RH dans un cadre d'autonomie encadrée." |
| p-forb-10 | "Pierre soumet votre DSN." | "Pierre prépare les données pré-paie — la DSN est soumise par votre logiciel de paie ou expert-comptable." |

## Positioning Statement

> "Pierre est un assistant RH intelligent qui prépare, structure, suit et documente — l'humain garde la responsabilité finale des décisions officielles, légales, et contractuelles."

## Legal Limit Statement

> "Pierre n'est pas un avocat, juriste, expert-comptable, logiciel de paie certifié, ni un service de conseil légal. Il prépare et assiste — il ne décide pas seul, ne garantit pas la conformité, et ne signe pas à la place de l'humain."

## How to Validate Marketing Copy

Use `validatePierreMarketingCopy(text)` from `src/lib/legal-commercial/marketing-guardrails.ts`.

Returns:
- `ok: boolean` — whether the copy is safe
- `forbidden_phrases_found: string[]` — detected violations
- `safe_rewrite: string | null` — suggested correction
- `warnings: string[]` — soft warnings (strong claims without disclaimers)

## Forbidden Phrase Categories

1. **Marketing phrases**: "juridiquement autonome", "zéro erreur", "conformité garantie"
2. **Legal phrases**: "remplace un avocat", "remplace un juriste", "avis juridique garanti"
3. **Payroll phrases**: "remplace la DSN", "remplace un logiciel de paie", "génère des bulletins officiels"
4. **HR decision phrases**: "licenciement automatique", "sanction automatique", "décide seul"
5. **AI overclaim phrases**: "IA infaillible", "100% précis", "sans supervision"
