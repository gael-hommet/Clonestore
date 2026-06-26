# Template d'Evidence — PHASE 4.7 Runtime Mission Draft Server Restore UI Polish

> **Important** : Ce template doit être rempli manuellement.
> Ne pas auto-remplir. Ne pas modifier go-live-proofs.local.json.
> P4.7 = UI/observability polish. lancement public externe non validé. scale 80k non prouvé.

---

## 1. Date

*(à remplir)*

## 2. Environnement

`local` / `staging` / `production`

## 3. Brouillon local créé

- [ ] Simulation lancée (au clic)
- [ ] Brouillon local préparé (au clic)

## 4. Sauvegarde localStorage OK

- [ ] Bouton « Sauvegarder le brouillon localement » cliqué
- [ ] Enveloppe présente dans localStorage (`clonestore.runtimeMissionDrafts.local.v1`)

## 5. Restore local OK

- [ ] Bouton « Restaurer le dernier brouillon local » cliqué
- [ ] Titre du brouillon restauré affiché

## 6. Statut local visible

- [ ] Panneau « Statut brouillon runtime » affiché
- [ ] Source effective visible
- [ ] Statut local visible

## 7. Statut serveur visible

- [ ] Statut serveur visible
- [ ] Carte « Dernière tentative serveur » visible

## 8. Feature flag visible

- [ ] Carte « Flag serveur » affiche `true` / `false`

## 9. P4.6 manual activation visible

- [ ] Rappel « activation P4.6 » visible quand flag false
- [ ] Warning « SQL non appliqué » visible quand flag false

## 10. Warnings table/RLS/auth visibles si applicables

- [ ] Warning auth required (si non connecté)
- [ ] Warning table/RLS (si table absente)
- [ ] Warning RLS/permissions (si policies bloquent)

## 11. Aucune mission réelle créée

- [ ] Confirmé : aucune mission Pierre réelle créée

## 12. Aucune exécution

- [ ] Confirmé : `execution_not_started`, aucune exécution déclenchée

## 13. Aucun appel Pierre

- [ ] Confirmé : aucun appel moteur Pierre, aucune route /api/pierre

## 14. Aucun appel IA

- [ ] Confirmé : aucun appel OpenAI/Anthropic/Stripe

## 15. Aucun email/message/document

- [ ] Confirmé : aucun email/message/document/PDF

## 16. CloneVoice non actif

- [ ] Confirmé : CloneVoice non actif

## 17. Scale 80k non prouvé

- [ ] Confirmé : badge « Scale 80k non prouvé » visible

## 18. Résultat test:phase4-7

`npm run test:phase4-7` → *(XX/XX)*

## 19. Résultat build

`npm run build` → *(clean / erreurs)*

## 20. Décision PASS/FAIL/NEEDS REVIEW

- [ ] **PASS** — Panneau statut lisible, local/serveur/fallback/disabled clairs, P4.6 visible, aucun write/POST ajouté.
- [ ] **FAIL** — Statut illisible, ou write/POST/exécution/mission réelle ajoutés.
- [ ] **NEEDS REVIEW** — Points non bloquants à revoir.

## 21. Notes

*(Observations, captures)*

## 22. Captures / Références

*(Liens vers captures d'écran, logs)*

---

> **Rappel** : P4.7 ne change pas la persistance P4.5. Serveur feature-flaggé,
> activation manuelle P4.6. La restauration ne crée pas de mission réelle.
> Aucune exécution. scale 80k non prouvé. lancement public externe non validé.
