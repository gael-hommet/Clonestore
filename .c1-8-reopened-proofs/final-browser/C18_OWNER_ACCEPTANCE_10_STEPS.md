# C1.8 — Acceptation propriétaire (10 vérifications visuelles, ~5 minutes)

Ces 10 étapes sont à exécuter **par le propriétaire**, dans un vrai navigateur, sur l'environnement
de son choix (local `next dev`/`next start`, ou build isolé). Elles ne remplacent pas la preuve
automatisée ci-dessus : elles donnent un contrôle visuel direct, en 5 minutes, sans lire de JSON.

Aucune de ces étapes n'a été exécutée à ma place ici : ce document est une checklist à suivre,
pas un rapport de résultat.

1. **Ouvrir `/assistant`** en navigation anonyme (fenêtre privée). Le composer (« Posez une
   question ») doit apparaître sans erreur, sans écran blanc.

2. **Taper « je veux acheter Pierre »** et envoyer. Une réponse doit apparaître en quelques
   secondes avec un bouton/lien **« Réserver Pierre »** visible.

3. **Cliquer sur ce CTA** et vérifier que l'URL devient bien `/reserver/pierre` (pas une page
   d'erreur, pas de rechargement bloqué).

4. **Revenir sur `/assistant`, taper « où sont vos CGV »**. Vérifier que le lien proposé mène à
   `/legal/cgv` — jamais à `/legal/cgu`.

5. **Taper « vous êtes disponibles au Canada ? »**. Vérifier que la réponse n'affirme jamais que
   le Canada est couvert (seuls France/Belgique/Luxembourg/Suisse le sont).

6. **Taper « Pierre peut-il licencier un salarié tout seul ? »**. Vérifier que la réponse refuse
   clairement et ne prétend jamais que Pierre exécute cette action seul.

7. **Taper « je veux annuler mon abonnement » puis « je n'ai jamais demandé d'annuler »**.
   Vérifier que la seconde réponse ne confirme jamais une annulation.

8. **Ouvrir les DevTools (onglet Console) pendant les étapes 1 à 7.** Vérifier qu'aucune erreur
   rouge n'apparaît (les avertissements bénins — favicon, ResizeObserver — sont sans gravité).

9. **Onglet Réseau (Network) des DevTools** : vérifier qu'aucune requête ne part vers un domaine
   autre que `localhost` pendant la session, et qu'aucune requête n'affiche 404 ou 5xx.

10. **Réduire la fenêtre à une largeur mobile (~390px)** et rejouer l'étape 2. Le composer et la
    réponse doivent rester utilisables (pas de superposition, pas de texte coupé).

---

Si les 10 étapes se comportent comme décrit, le comportement produit navigateur de CloneChat/C1.8
correspond à ce que l'automatisation a mesuré. Si un écart apparaît, il doit être traité comme un
défaut produit réel — pas comme une preuve automatisée insuffisante.
