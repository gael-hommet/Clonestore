# CloneChat — BLOC 12 : CloneAnalytics & Observability

**Verdict local : PASS.** Couche d'analytics, de mesure de qualité et d'observabilité au-dessus du pipeline complet (Brain → CloneContext → Diagnosis → CloneGuide → CloneVoice → CloneCare → CloneActions → Visual Guidance → CloneInspector → Onboarding → Mission Support). Elle **observe** ; elle ne devient **jamais** une autorité métier : ne modifie aucune décision/diagnostic, ne contourne pas CloneGuard, n'accorde aucune permission, ne change aucun tenant, ne confirme/n'exécute aucune action, ne casse jamais la réponse si le sink tombe, ne transforme jamais une absence de donnée en succès, ne prétend jamais qu'un événement a été envoyé s'il ne l'a pas été.

- **SHA parent** : `563283a46378578fbf2d56bf28f436852c034bf0` (commit BLOC 12 initial ; lui-même parenté à `c5e124b4` clôture BLOC 11). Ce commit **correctif** durcit la sémantique honnête de livraison.
- **SHA final** : le commit correctif BLOC 12 (un commit ne peut pas contenir son propre SHA ; il est livré dans le verdict final et devient `origin/main` après `git push`).
- **Aucun provider externe Production activé.** Sink par défaut = **no-op NON capable** (aucune destination ⇒ statut `disabled`, jamais un faux envoi). Rien n'est déployé, rien n'est câblé dans `/api/assistant/chat`.

## Réutilisation (pas de second système)
- **CloneTrace** (`actions/trace.ts`) + hash FNV (`actions/keys.ts` `truthVersionHash`) réutilisés pour la corrélation et les identifiants ; **CloneCare** `redactText` réutilisé pour la redaction ; clés viewer/tenant SÛRES réutilisées puis **pseudonymisées**.
- Le module généraliste `src/lib/observability/` (domaine Pierre B43) n'est **pas** touché : CloneAnalytics est un module CloneChat distinct `src/lib/clonechat/analytics/`, sans collision de noms.
- Aucun runtime Pierre (`pierre/v1`), aucune mission RH réelle, P22, migration, paiement, Vercel Production ni provider analytics externe touché.

## Fichiers (`src/lib/clonechat/analytics/`)
| Fichier | Rôle |
|---|---|
| `types.ts` | Types versionnés (`analytics-1`) : étapes pipeline, catégories, nature (operational/product/security/quality), base de collecte, résultats SÛRS (aucun `running`/`paid`/`success` représentable), enveloppe, spec d'événement, sink, snapshots d'agrégat/santé. |
| `registry.ts` | Registre CANONIQUE (**53 événements**) : id/version/catégorie/étape/nature/base/sensibilité/méta requise+allowlist/résultats possibles/échantillonnage/déduplication/rétention/provenance/métriques alimentées. Un événement n'existe que s'il correspond à une étape/un résultat réel. Politique d'échantillonnage EXPLICITE par événement (`always` pour tout opérationnel/sécurité ; `rate:1` pour les événements produit Care, sous-échantillonnables via sampler injectable). |
| `privacy.ts` | Minimisation déterministe : allowlist stricte, rejet des clés inconnues/interdites, redaction récursive, bornes taille/profondeur ; pseudonymiseur injectable (viewer **tenant-scopé** ⇒ distinct entre tenants). |
| `envelope.ts` | Construction + **validation STRICTE** de l'enveloppe (événement connu, résultat possible, preuve observable si requise, route réelle, méta minimisée, taille bornée). Temps/identifiants INJECTÉS. |
| `sink.ts` | Sinks abstraits injectables : mémoire (tests), no-op (défaut sûr), failing/timeout/partial (tests). Un sink ne lève jamais. |
| `collector.ts` | Émetteur : validation → **(sink capable ?)** → consentement → échantillonnage → déduplication → buffer borné (backpressure, priorité opérationnel/sécurité) → sink (retry BORNÉ). Résultat HONNÊTE (`accepted/buffered/**partial**/duplicate/sampled_out/disabled/rejected/failed`), **jamais de faux succès** (ni no-op, ni partiel présenté comme complet). |
| `aggregate.ts` | Agrégateur read-only (snapshots gelés) + santé. Tenant-scopé, division par zéro → null, jamais de classement/score individuel. |
| `instrument.ts` | Dérivation DÉTERMINISTE des événements depuis un résultat de pipeline (ordre stable), sans lire message/réponse/transcript/pièce jointe. |
| `observe-with-context.ts` | Adaptateur global `onboardPrepareMissionAndObserveWithCloneChat()` — additif ; résultat fonctionnel INCHANGÉ ; panne analytics absorbée. |

Ajustement additif BLOC 11 : `onboarding/orchestrator.ts` transmet désormais l'interruption explicite (`interruptedOnboarding`) au moteur (le moteur la supportait déjà).

## Sémantique HONNÊTE de livraison (correctif — cœur de cette fermeture)
Statuts d'émission finaux et non ambigus : **`accepted`** (remis à un sink CAPABLE ayant confirmé la livraison COMPLÈTE), **`buffered`** (validé + mis en file en mode manuel, PAS encore livré), **`partial`** (le sink a confirmé une livraison partielle — jamais présentée comme complète), **`duplicate`**, **`sampled_out`**, **`disabled`**, **`rejected`**, **`failed`**.
- **No-op** : un sink `capable:false` (défaut quand aucun sink n'est configuré) n'a aucune destination ⇒ tout événement renvoie **`disabled` (raison `sink_noop`)**, n'est **jamais** présenté comme livré, n'est **pas** conservé dans l'historique « accepté ». L'observation additive expose `persisted:false` — honnête. Le résultat fonctionnel CloneChat reste totalement inchangé.
- **Partiel** : `{status:"partial", delivered, failed}` → émission **`partial`** en mode immédiat ET résultat de `flush()` explicitement `partial` en mode manuel ; `failedDeliveries` incrémenté des échecs réels ; jamais la totalité du batch présentée comme livrée ; retry BORNÉ. Lorsqu'un sink ne précise pas quels événements individuels ont échoué, **aucun** événement du batch partiel n'est présenté comme livré (non attribuable) — documenté.
- **`ok` avec `failed>0`** est traité comme **partial**, jamais `accepted`.
- **Version** : `EmitInput.version` facultative ; si fournie et ≠ `analytics-1` → rejet **`invalid_version`** ; un tel événement n'atteint jamais le sink ni l'agrégateur.
- **Échantillonnage** : politique explicite par événement ; le `sampled_out` est réellement produit (événement produit Care `rate:1` + sampler injectable refusant → `sampled_out`, absent du sink, `sampledOut` incrémenté). La télémétrie opérationnelle/sécurité (`always`) n'est **jamais** échantillonnée.
- **requestId / sessionId** : **toujours pseudonymisés** (opaques `rq_`/`ss_`, tenant-scopés, stables) — un e-mail, un user-id brut ou un token ne transite jamais ; le tronquage seul est refusé ; aucune corrélation inter-tenant (même id, tenant différent → pseudonyme différent).

## Événements réellement implémentés (53)
Requête, Brain, contexte résolu/incomplet, diagnostic + clarification, guide produit/bloqué/terminé/escaladé, voix (transcription réussie/refusée/en panne, TTS réussi/fallback), Care (problème connu/résolution/contournement/escalade), actions (planifiée, refus CloneGuard, confirmation demandée/reçue/expirée/invalide, exécutée **avec preuve observable**, échouée, annulée, dédupliquée), guidage visuel (trouvé/stale/fallback), inspection (réussie/partielle/refusée/en panne), onboarding (commencé/repris/interrompu/abandonné/expiré/bloqué/prêt/terminé), mission (intake, clarification, prêt-à-préparer, préparée, indisponible, sensible escaladée), panne provider, refus de sécurité, erreur interne sûre. **Aucun** événement ne représente une mission exécutée (préparée uniquement), un paiement sans preuve, un succès sans condition observable, ou un utilisateur/entreprise/entitlement non résolu.

## Métriques réellement calculées
Nombre de requêtes ; répartition des modes Brain ; taux de contexte incomplet ; taux de clarification ; répartition des diagnostics ; guides prêts/bloqués/escaladés ; latences par étape (min/max/avg) ; pannes (transcription/modèle/TTS/entitlement/support) ; taux de fallback ; refus de sécurité ; états d'action ; confirmations (demandées/reçues/expirées/invalides) ; cibles visuelles ; inspections ; statuts d'onboarding + reprises/abandons ; statuts de mission ; erreurs par code sûr ; routes réellement utilisées. Santé : pipeline/provider disponibles, taux d'erreur, latence, saturation buffer, rejets, dédup, produit désactivé faute de consentement.

## Politique de consentement
Deux bases : **operational** (télémétrie strictement nécessaire + sécurité) — toujours autorisée ; **product** (analytics facultative) — **désactivée par défaut** (`operational_only`) tant qu'un consentement réel (`product_enabled`) ne l'autorise pas. Le consentement n'est jamais simulé ni inventé ; un retrait rebascule immédiatement le produit en `disabled` (jamais faussement envoyé).

## Données EXPLICITEMENT interdites
message brut, prompt/réponse complets, transcript, audio, image/binaire, contenu de pièce jointe, mot de passe, token, cookie, clé API, header d'auth, URL signée, donnée bancaire, e-mail, téléphone, nom de salarié, nom d'entreprise inutile, user/tenant ID brut, stack brute, donnée d'un autre tenant. Mise en œuvre : allowlist stricte des clés + garde de clés interdites (défense en profondeur) + redaction récursive des valeurs + pseudonymisation + bornes taille/profondeur + taille d'enveloppe max.

## Gate local (séquentiel, sans build/tests concurrents)
- **CloneAnalytics : 68/68** (registre & schémas, confidentialité & minimisation, consentement, sinks & fiabilité, instrumentation du pipeline, sécurité, agrégation, compatibilité + **correctif** : livraison partielle immédiate & flush / no-op honnête / version invalide / sampled_out réellement produit / protection requestId-sessionId / cohérence des 53 événements).
- **Passe de régression UNIQUE séquentielle** (`--no-file-parallelism --maxWorkers=1`, aucun build en parallèle) sur **19 fichiers = 510/510, 0 échec, 0 timeout** (BLOC 0→11 : 442 + analytics : 68). Détail BLOC 0→11 : onboarding 28, mission 30, evidence-inspector 36, cloneinspector 12, image-sanitizer 13, visual 26, actions 40, care 30, voice 32, transcribe 6, guide 25, diagnosis 25, context 25, brain 27, product-truth 15, context-boundary 51, injection-114 1 (114/114), universal-clonechat 20.
- **tsc --noEmit** : 0 erreur nouvelle (1 pré-existante `embedded-postgres` dans un `.itest.ts`) ; module + tests BLOC 12 type-checkés séparément = 0. **ESLint** : 0 (analytics + orchestrator). **Build Next isolé** (`.next-hotfix`) : **BUILD_EXIT_CODE=0**.
- **tsconfig.json** rétabli byte-exact au blob du parent, avant et après le gate ; **index Git valide** ; **aucun `.next-*`, capture ou binaire** committé.

## Preuve navigateur — justification honnête + preuve d'intégration locale déterministe
Une preuve navigateur d'un événement d'analytics n'est **pas raisonnablement possible** sans (a) câbler CloneAnalytics dans le comportement Production servi (`/api/assistant/chat`), interdit par la doctrine additive de ce programme, ou (b) créer une couche/interface de dashboard artificielle uniquement pour Playwright, explicitement interdite. En conséquence, conformément à la clause prévue : **preuve d'intégration locale DÉTERMINISTE** — l'adaptateur `onboardPrepareMissionAndObserveWithCloneChat()` exécute le VRAI pipeline (contexte réel, onboarding + mission réels) et émet les événements opérationnels attendus dans un **collecteur local (sink mémoire)**, corrélés, sans donnée sensible (tests d'intégration « instrumentation du pipeline » + « compatibilité »). Le rendu réel des parcours publics reste prouvé par les e2e navigateur des BLOC 9/10/11 (inchangés). **Aucune requête vers un provider analytics externe** n'est émise (aucun n'est câblé).

## Limites honnêtes / suite
- `onboardPrepareMissionAndObserveWithCloneChat()` n'est **pas** câblé comme comportement Production servi ; aucun effet externe ; aucun provider réel.
- Le coût/les tokens ne sont mesurés que si une source canonique versionnée les fournit — jamais devinés (l'enveloppe ne porte ni champ `cost` ni `tokens` inventé ; `provider`/`model` restent `null` si inconnus).
- Aucune interface de dashboard n'est ajoutée ; l'agrégateur est une bibliothèque read-only.
