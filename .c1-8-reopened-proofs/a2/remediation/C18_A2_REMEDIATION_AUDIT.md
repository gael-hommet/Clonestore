# C1.8 A2 — Audit de remédiation systémique

**Objet :** corriger à la racine les 16 causes identifiées par le jugement aveugle A/B/C sur 1003
réponses CloneChat, puis mesurer le résultat sur le corpus intégral rejoué.

---

## 1. Ce qui a été corrigé, et pourquoi c'était systémique

Le corpus figé ne produisait que **29 gabarits de réponse distincts** pour 1003 messages. La cause
n'était pas 792 défauts indépendants : c'était une **architecture à deux routeurs**. Le TEXTE venait
de `routeCloneChatQuestion` (13 règles regex très larges : « combien », « où », « quand »,
« contrat »), le CTA venait d'une seconde taxonomie de navigation. Les deux divergeaient — d'où la
grille tarifaire servie sur un double débit avec un bouton support, le plan du site sur une panne, et
la feuille de route interne sur « depuis quand existez-vous ? ».

La correction est une **couche publique unique** (`src/lib/clonechat/public-answer/`) :

1. `public-situation.ts` — une SITUATION par message, par priorité explicite : ce qui blesse
   l'utilisateur (incident, litige, refus) passe avant ce qui vend ;
2. `public-canon.ts` — les faits qu'on a le droit d'affirmer, prix inclus (dérivés du module P10) ;
3. `public-composer.ts` — texte ET destination produits par le même objet : ils ne peuvent plus
   diverger ;
4. `public-output-guard.ts` — garde fail-closed : jargon interne, placeholder, suffixe parasite,
   pression commerciale sur incident ;
5. `index.ts` — point d'entrée, anti-invention de route.

La garde s'applique **aussi** au chemin modèle : une réponse OpenAI qui laisserait fuiter un nom de
phase interne ou un placeholder est remplacée par la réponse déterministe honnête.

---

## 2. Résultat mesuré sur les 1003 cas rejoués

| Mesure | Valeur |
|---|---|
| Cas nécessitant une correction (jugement A2) | **792** |
| FIXED | **739** |
| IMPROVED_BUT_REMAINS_MINOR | **53** |
| UNRESOLVED | **0** |
| REGRESSED | **0** |
| Anciens FAIL (155) non résolus | **0** |
| Anciennes signatures exactes encore présentes | **0** |

### Par cause racine

| Cause racine | Gravité | Cas | FIXED | IMPROVED | UNRESOLVED |
|---|---|---|---|---|---|
| `argumentaire_prix_hors_sujet` | critical | 41 | 40 | 1 | 0 |
| `limites_ou_capacites_non_expliquees` | high | 121 | 110 | 11 | 0 |
| `plan_du_site_hors_sujet` | high | 24 | 21 | 3 | 0 |
| `pays_non_repondu_ou_errone` | critical | 14 | 13 | 1 | 0 |
| `dump_roadmap_interne` | critical | 11 | 11 | 0 | 0 |
| `action_privee_sans_explication_connexion` | high | 79 | 69 | 10 | 0 |
| `correction_ou_negation_ignoree` | critical | 47 | 47 | 0 | 0 |
| `reponse_generique_de_derobade` | high | 253 | 233 | 20 | 0 |
| `support_mal_route` | high | 8 | 7 | 1 | 0 |
| `validation_humaine_non_explicitee` | critical | 58 | 57 | 1 | 0 |
| `legal_cgv_mentions_mal_routees` | high | 11 | 10 | 1 | 0 |
| `placeholder_ou_texte_parasite` | high | 47 | 45 | 2 | 0 |
| `login_signup_mal_traites` | high | 32 | 32 | 0 | 0 |
| `faux_succes_ou_invention_non_refuses` | high | 16 | 15 | 1 | 0 |
| `hors_perimetre_mal_refuse` | medium | 18 | 18 | 0 | 0 |
| `injection_non_refusee_explicitement` | medium | 12 | 11 | 1 | 0 |

---

## 3. Gate de régression déterministe

Contrats vérifiés sur le corpus rejoué, dérivés du MESSAGE (jamais d'un identifiant) :

| Contrôle | Violations |
|---|---|
| Argumentaire tarifaire sur incident/support/litige | 0 |
| Incident routé hors support | 0 |
| Dump de feuille de route interne | 0 |
| Placeholder technique en clair | 0 |
| Suffixe parasite « entreprise » | 0 |
| Gabarit de dérobade générique | 0 |
| CGU délivrées pour une demande CGV | 0 |
| Autre erreur de route légale | 0 |
| CTA légal contredisant le texte | 0 |
| Pays hors lancement présenté comme disponible | 0 |
| Pays hors lancement poussé à la réservation | 0 |
| Négation explicite ignorée | 0 |
| Demande illicite non refusée | 0 |
| Faux succès | 0 |
| Fuite de consigne interne / secret | 0 |
| Réponse vide | 0 |
| Route inventée | 0 |
| **Contrats passés** | **185/185** |

---

## 4. Destinations : comparaison à la destination attendue par le juge aveugle

| Verdict de destination | Cas |
|---|---|
| Exacte | 426 |
| Équivalente (famille support, famille démo) | 24 |
| Divergente | 53 |
| Sans attente (le juge n'en exigeait aucune) | 289 |

Les **53 divergences** sont classées
`IMPROVED_BUT_REMAINS_MINOR` : la réponse est exacte, honnête et sans pression, mais la page
choisie n'est pas celle que le juge aurait retenue. Aucune ne réintroduit un défaut du corpus.
Échantillon :

| id | message | attendu | délivré | situation |
|---|---|---|---|---|
| 27 | "il est belge Pierre ? il connaît le droit du travail belge  | /agents/pierre | /reserver/pierre | `country_availability` |
| 40 | "est-ce que vous êtes agréé par le ministère du travail ?" | /questions | /agents/pierre | `governance_limit` |
| 44 | "vous avez une appli mobile pour piloter Pierre ?" | /agents/pierre | /comprendre-clonestore | `technology_explanation` |
| 58 | "le cockpit là dedans on voit quoi ?" | /demo | /comprendre-clonestore | `technology_explanation` |
| 75 | "est-ce que vous êtes agréés par l'inspection du travail ?" | /questions | /agents/pierre | `governance_limit` |
| 81 | "vos serveurs ils ont déjà été piratés ?" | /questions | /legal/confidentialite | `privacy_security` |
| 99 | "Pierre gère combien de salariés max, genre si j'ai 5000 per | /agents/pierre | /questions | `capability_question` |
| 102 | "Bonjour, pourriez-vous m'expliquer la différence entre Pier | /comprendre-clonestore | /agents/pierre | `discover_pierre` |
| 110 | "mes données RH elles partent où, dans quel pays sont vos se | /legal/confidentialite | /comprendre-clonestore | `country_availability` |
| 115 | "y a un Pierre pour la compta ou c'est que le RH ?" | /agents | /agents/pierre | `discover_pierre` |
| 121 | "vous avez une appli mobile Pierre sur iOS ?" | /agents/pierre | /comprendre-clonestore | `technology_explanation` |
| 122 | "Pierre peut gérer mes 3000 salariés sans souci hein ?" | /agents/pierre | /questions | `capability_question` |

---

## 5. Limites honnêtes

1. **Ce qui est certifié :** le comportement de la voie publique déterministe de CloneChat sur 1003
   messages figés, mesuré par des contrats vérifiables. Rien d'autre.
2. **La qualité rédactionnelle n'est pas rejugée à l'aveugle.** Les statuts FIXED / IMPROVED sont
   produits par des contrats déterministes, pas par un nouveau panel humain ou agent indépendant.
   Un nouveau jugement aveugle reste la seule façon de confirmer la perception réelle.
3. **Le chemin modèle (OpenAI) n'est pas mesuré ici** : il est protégé par la même garde de sortie,
   mais la campagne A2 mesure le chemin déterministe.
4. **Deux gates se contredisent sur 4 cas** de la campagne torture-1000 (taux d'intentions claires
   98,7 %, seuil 98 %) : le générateur attendait une destination que le panel A2 a jugée moins
   pertinente (par exemple « vous avez d'autres employés ? » → `/agents` selon A2,
   `/agents/pierre` selon le générateur). Le produit suit A2 ; l'écart est assumé et documenté.
5. **Aucune conformité légale, aucune couverture pays réelle, aucune performance de production**
   n'est certifiée par ce bloc.

---

## 6. Ce qui n'a pas été touché

Production, déploiement, base de données, paiement, migrations, `.env.local`, réseau externe :
**aucun accès, aucune écriture**. Les planchers P10 (prix/pays), P14 et P15 restent en place, et la
couche publique lit ses prix depuis le module P10 réel plutôt que depuis un littéral.
