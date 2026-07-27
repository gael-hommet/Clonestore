# Demo Visual Restoration Comparison

Validation **visuelle réelle** dans un vrai navigateur (Playwright + Chromium), pas une lecture de
code. `/demo` servi localement (`next dev`, port 3711) depuis le HEAD live `62cbb6fb` (démo
identique au HEAD `65bc5f79` — `DemoExperience.tsx` `unmodified`).

## Captures produites (dossier `CLONESTORE_AUDIT_EVIDENCE/exact-demo-restoration/`)

| Capture | Viewport | Contenu premier écran |
|---|---|---|
| `demo-restored-desktop-1440-firstscreen.png` | 1440 × 900 | **11 h 35 de travail humain → 12 min d'attention humaine**, « Jusqu'à 1,6 M€ de capacité libérée par an », « CloneStore ouvre des postes d'employés IA », CTA « Voir ce que Pierre absorbe ». Aucun mur de texte. |
| `demo-restored-mobile-390-firstscreen.png` | 390 × 844 | Mêmes marqueurs value-first, sans débordement, CTA lisible, pas de chevauchement. |

## État déployé (A — régressif, pour référence)

L'ancienne version déployée commençait par le hero institutionnel `Act1Opening` (« N'achetez plus
seulement des logiciels. Ouvrez des postes d'employés IA. ») + lede + contrat — pas de choc de
valeur immédiat. Aucune capture de la production n'est incluse (pas d'accès requis ; l'état est
décrit par l'utilisateur et correspond au blob committé `≤ 02cf93180`).

## Différences expliquées

- **Premier écran** : déployé = titre institutionnel ; dépôt actuel = **choc de valeur chiffré**
  (11 h 35 → 12 min ; 1,6 M€/an).
- **Quantité de texte** : déployé = lede + contrat de lecture visibles d'emblée ; dépôt actuel =
  une phrase de charge + une projection + un CTA (densité minimale, contrat en `Disclosure` au 2ᵉ
  chapitre).
- **Impact** : déployé = compréhension différée ; dépôt actuel = valeur comprise en quelques
  secondes.

## Gates visuelles (Phase 11) — résultat

| Gate | Desktop | Mobile |
|---|---|---|
| Value shock immédiatement visible | ✅ | ✅ |
| Chiffre fort immédiat (11 h 35 / 12 min / 1,6 M€) | ✅ | ✅ |
| Pas de mur de paragraphes dominant | ✅ | ✅ |
| CTA clair | ✅ (« Voir ce que Pierre absorbe ») | ✅ |
| Pas de débordement / chevauchement | ✅ | ✅ |
| Le premier écran n'est PAS « N'achetez plus… » | ✅ | ✅ |

Conclusion : le dépôt rend déjà, en navigateur réel, la démo value-first validée sur desktop et
mobile.
