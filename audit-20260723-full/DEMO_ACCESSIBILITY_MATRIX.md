# Demo Accessibility Matrix

Static/code-level audit only — no screen reader, no real keyboard-navigation session, no automated axe-core scan was run (no such tooling available in this repo per prior audits; Playwright unavailable this block). Every row below is a code-review finding, not a live assistive-technology verification.

| Route/composant | Critère | Avant | Après | Preuve |
|---|---|---|---|---|
| `DemoContextualPromptCard` (nouveau) | Nom accessible | N/A (n'existait pas) | `role="dialog"` + `aria-label` explicite | Test SSR : présence de l'attribut confirmée |
| `DemoContextualPromptCard` | Fermeture au clavier | N/A | Bouton natif `<button>`, focusable/activable Entrée/Espace par défaut, `aria-label="Fermer l'invitation"` | Test SSR : 3 `<button>` réels comptés |
| `DemoContextualPromptCard` | Non-modal | N/A | Pas de `aria-modal`, pas de fond obscurci | Test SSR : absence de `aria-modal` vérifiée |
| `DemoContextualPromptCard` | `prefers-reduced-motion` | N/A | Classe `motion-reduce:transition-none` sur le conteneur | Lecture de code (pas de test automatisé dédié — gap noté) |
| `DemoContextualPromptCard` | Zone tactile | N/A | Boutons `h-10`/`size-8` (40px/32px) — sous le seuil recommandé de 44×44 CSS px pour le bouton de fermeture | **Non conforme au seuil recommandé**, noté en risque restant |
| `CapacityCalculator` sliders | `aria-valuetext`, label | Déjà présent avant ce bloc | Inchangé (ce bloc n'a touché que `suppressHydrationWarning`) | Lecture de code, confirmé toujours présent |
| `/demo/pierre` back-link | Nom accessible / contraste | N/A | Texte visible "Retour à la démo générale" + icône `aria-hidden`, pas d'icône seule sans texte | Lecture de code |
| `GuidedTourProvider` | Focus management, Escape, inert/aria-hidden | Déjà en place avant ce bloc (sauvegarde/restauration du focus, `inert` réversible) | Inchangé — la garde ajoutée ne s'exécute qu'AVANT le montage de tout composant d'accessibilité existant | Lecture de code + 165 tests existants toujours verts |

## Gaps identifiés, non corrigés dans ce bloc
- Le bouton de fermeture (`size-8` = 32px) du nouveau prompt est sous le seuil recommandé de 44×44 CSS px pour une cible tactile — copié du composant `InstallPrompt.tsx` préexistant (même défaut potentiel, non introduit par ce bloc, non corrigé ici pour rester cohérent avec le composant sœur plutôt que de diverger).
- Aucun test automatisé de navigation clavier réelle (Tab/Shift+Tab/Entrée) n'a pu être écrit sans jsdom — seule la présence d'éléments `<button>` natifs (focusables par défaut) a été vérifiée statiquement.
- Aucun test de lecteur d'écran réel (VoiceOver/NVDA) n'a été exécuté.
