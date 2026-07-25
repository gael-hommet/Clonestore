# Partner Program — Git Forensic Timeline

Généré 2026-07-25 depuis `pp-git-forensics.cjs` (isomorphic-git, `git.log` profondeur 200,
lecture directe des blobs/arbres — aucune écriture, aucun réseau).

## Résolution des 6 hash courts cités en mémoire de session

| Hash court | OID complet | Message | Date (auteur) |
|---|---|---|---|
| `65c1335e9` | `65c1335e90e62696aeefaefcc65cd447c33064cb` | feat: automate partner onboarding analytics and payouts | 2026-07-11T19:56:12Z |
| `134753023` | `1347530234bfb6737a8b6f2dcca9d8583fe254e4` | feat: automate partner onboarding analytics and payouts | 2026-07-11T19:26:41Z |
| `2f8c73830` | `2f8c73830ea41f06ebf5fe21de47c64648782154` | feat: deploy partner program automation | 2026-07-11T23:42:09Z |
| `2cd2dc723` | `2cd2dc7238b94ac7a1be026918b87a8694e4d176` | fix(stripe): accept Connect webhook secret so account.updated reaches production | 2026-07-11T22:25:56Z |
| `cfad1988d` | `cfad1988dab1a0cd42997dae81b6bdd5363c59ed` | docs: real Stripe Test recette — Connect onboarding, commission, transfer | 2026-07-11T23:22:42Z |
| `2a36cd804` | `2a36cd804e2851baf14a3530e14a386dee185bfd` | docs: final release report and rollback runbook | 2026-07-11T21:04:42Z |

Chacun de ces 6 commits contient déjà **219 fichiers** liés à `partner-program|/partners/|partenaires|founding-partners|clonestory` dans son arbre. Le HEAD actuel (`64e12d4b3fa8b741d546c557fe81ba9a0fda2c96`) en contient **220** (delta = 1 fichier ajouté par un commit ultérieur non lié à ce chantier).

## Autres commits liés (log profondeur 200, tri chronologique)

```
5c0f4b7c3 2026-06-27T00:11:06Z feat: finalize CloneStore launch polish and connected workspace
d0a9b89bf 2026-06-26T23:02:45Z feat: finalize CloneStore public polish and connected workspace
7cfabb3bb 2026-06-22T20:47:29Z BLOC 3 CloneStore conversion integration: attributed Pierre demo, diagnostic and test checkout
e2a42f9ad 2026-05-25T01:46:42Z B37 production connectors foundation
322425950 2026-05-08T15:16:44Z Connect Pierre queue execution to persisted artifacts
```

## Verdict de cette phase

**Classification : `PARTNER_BASE_ALREADY_COMMITTED`.**

Le Partner Program (Cabinets Fondateurs + CloneStory/Founding Partners) a une base Git réelle et
substantielle, committée le 2026-07-11. L'hypothèse de départ du bloc précédent ("122 fichiers,
absents de Git, code de production sans sauvegarde") était fausse — voir
`02_STATUS_MAP.md` pour la vérification fichier-par-fichier qui le confirme.
