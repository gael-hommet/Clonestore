# Exact Demo Restoration — Verdict (34 questions)

1. **HEAD au démarrage ?** `62cbb6fb7c522094fc2249762bd6e310371c1e2a`.
2. **Commit contenant la dernière bonne démo value-first ?** `90932a0bc` (2026-07-25) → jusqu'au
   HEAD actuel. Le dépôt est value-first depuis ce commit.
3. **Commit ayant introduit la régression ?** **Aucun dans le dépôt.** La régression est un
   **déploiement périmé** (build ≤ `02cf93180`, 2026-07-13, Act1Opening en premier écran).
4. **`a998eba5` a-t-il causé ou seulement préservé la régression ?** **Préservé** — il a committé
   la clôture démo value-first (dont ValueShock) ; il n'a pas ré-introduit l'ancien premier écran
   et n'a pas modifié `DemoExperience.tsx`.
5. **Fichiers contrôlant le premier écran régressif (build déployé) ?**
   `DemoExperience.tsx` (ordre) + `acts/Act1Opening.tsx` (`demo-act-open`, texte institutionnel).
6. **Fichiers restaurés ?** **Aucun** — le dépôt était déjà à la bonne version ; restaurer d'anciens
   blobs aurait été inutile et risqué (écrasement de l'Analytics). Seul ajout : le test
   anti-régression.
7. **Le premier écran affiche-t-il immédiatement la valeur et les chiffres ?** **Oui** (prouvé
   navigateur, desktop + mobile) : 11 h 35 → 12 min, 1,6 M€/an.
8. **Marqueurs value-first présents ?** **Oui** — 11 h 35 de travail humain, 12 min d'attention
   humaine, « Jusqu'à 1,6 M€ de capacité libérée par an », « postes d'employés IA », CTA « Voir ce
   que Pierre absorbe ».
9. **Le mur de texte de l'ancienne version a-t-il disparu du premier écran ?** **Oui** — Act1Opening
   est le 2ᵉ chapitre, plus le premier écran.
10. **Quantité de texte conforme à la bonne version ?** **Oui** (densité minimale : phrase de charge
    + projection + CTA).
11. **Desktop vérifié visuellement ?** **Oui** (1440 × 900).
12. **Mobile vérifié visuellement ?** **Oui** (390 × 844).
13. **Captures produites ?** **Oui** — `demo-restored-desktop-1440-firstscreen.png`,
    `demo-restored-mobile-390-firstscreen.png`.
14. **Analytics conservée ?** **Oui** (aucune modification runtime).
15. **`demo_run_id` conservé ?** **Oui**.
16. **Événements canoniques conservés ?** **Oui** (demo_started / step_completed / completed /
    pierre_reveal_viewed / discover_pierre_clicked).
17. **Un ancien fichier inutile réintroduit ?** **Non**.
18. **`/demo/pierre` intacte ?** **Oui** (non modifiée ; compilée au build, 23.8 kB).
19. **Homepage strictement intacte ?** **Oui** (non touchée).
20. **Combien de tests démo verts ?** **85** (7 fichiers), dont le verrou anti-régression.
21. **Test anti-régression d'ordre value-first vert ?** **Oui** (4 assertions).
22. **ESLint ciblé vert ?** **Oui** (0 erreur).
23. **Build pré-commit `REAL_EXIT_CODE=0` ?** **Oui**.
24. **BUILD_ID ?** `YyYGrnN2Aq41iGpc-aKBP`.
25. **Combien de commits créés ?** Voir section « Commits » (test + docs).
26. **Message et OID ?** Renseignés après création (section finale).
27. **Blobs vérifiés ?** Oui (à la création).
28. **Checkout propre final uniquement depuis Git ?** Voir `DEMO_RESTORATION_CLEAN_CHECKOUT_PROOF.md`.
29. **`npm ci` réussi ?** Voir clean checkout proof.
30. **Build final `REAL_EXIT_CODE=0` ?** Voir clean checkout proof.
31. **Un push effectué ?** **Non**.
32. **Un déploiement effectué ?** **Non**.
33. **`PRODUCTION_AUTHORIZED=false` intact ?** **Oui**.
34. **Statut final ?** **`EXACT_DEMO_RESTORED`** — la démo value-first validée est présente et
    prouvée (desktop + mobile), verrouillée contre toute régression future ; la production reste à
    redéployer (hors périmètre).

## Note honnête essentielle

Le dépôt n'avait **pas** régressé — il était déjà exactement la démo value-first validée. La
régression visible sur `clonestore.pro/demo` provient d'un **déploiement périmé** (antérieur à la
refonte value-first du 2026-07-25). Aucune restauration de code n'était nécessaire ; la correction
de la production est un **redéploiement** du HEAD actuel, hors périmètre (aucun push/déploiement
autorisé). Ce bloc prouve l'état value-first du dépôt et le verrouille.
