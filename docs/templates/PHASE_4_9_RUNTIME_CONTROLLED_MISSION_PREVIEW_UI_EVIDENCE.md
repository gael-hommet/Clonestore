# Template d'Evidence — PHASE 4.9 Runtime Controlled Mission Preview UI

> **Important** : Ce template doit être rempli manuellement.
> Ne pas auto-remplir. Ne pas modifier go-live-proofs.local.json.
> P4.9 = aperçu UI read-only. lancement public externe non validé. scale 80k non prouvé.

---

## 1. Date

*(à remplir)*

## 2. Environnement

`local` / `staging` / `production`

## 3. Brouillon préparé

- [ ] Simulation lancée (au clic)
- [ ] Brouillon local préparé (au clic)

## 4. Aperçu de promotion

- [ ] Bouton « Prévisualiser la promotion » cliqué
- [ ] Panneau « Promotion en mission contrôlée (aperçu) » affiché

## 5. Verdict affiché

- [ ] Verdict : eligible / requires_human_validation / not_eligible / blocked

## 6. Mission contrôlée

- [ ] Mission contrôlée affichée (si éligible)
- [ ] Statut : awaiting_validation / controlled_ready

## 7. Promotion non appliquée

- [ ] promotion_applied : **false** (visible dans le panneau)
- [ ] Aucune mission réelle créée

## 8. Validation humaine requise

- [ ] Mention « Validation humaine requise » visible

## 9. Aucune exécution

- [ ] Aucune exécution déclenchée
- [ ] Timeline se termine par execution_not_started

## 10. Aucun appel Pierre

- [ ] Confirmé : aucun appel moteur Pierre, aucune route /api/pierre

## 11. Aucun appel IA

- [ ] Confirmé : aucun appel OpenAI/Anthropic/Stripe

## 12. Aucun email/message/document

- [ ] Confirmé : aucun email/message/document/PDF

## 13. CloneVoice non actif

- [ ] Confirmé : CloneVoice non actif

## 14. Scale 80k non prouvé

- [ ] Confirmé : badge « Scale 80k non prouvé » visible

## 15. Aucun aperçu auto au mount

- [ ] Confirmé : aperçu au clic uniquement

## 16. Résultat test:phase4-9

`npm run test:phase4-9` → *(XX/XX)*

## 17. Résultat build

`npm run build` → *(clean / erreurs)*

## 18. Décision PASS/FAIL/NEEDS REVIEW

- [ ] **PASS** — Panneau lisible, verdict/gates/mission contrôlée affichés, promotion non appliquée, aucune exécution.
- [ ] **FAIL** — promotion appliquée, mission réelle, exécution, ou write/POST ajoutés.
- [ ] **NEEDS REVIEW** — Points non bloquants à revoir.

## 19. Notes

*(Observations, captures)*

## 20. Captures / Références

*(Liens vers captures d'écran, logs)*

---

> **Rappel** : P4.9 = aperçu read-only. La promotion n'est pas appliquée.
> Aucune mission réelle. Aucune exécution. scale 80k non prouvé.
> lancement public externe non validé.
