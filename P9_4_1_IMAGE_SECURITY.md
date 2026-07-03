# P9.4.1 — Image security & sanitization

> **⚠️ MISE À JOUR P9.4.2 (Gap 3 fermé) :** le redimensionnement/recompression PIXEL est
> désormais RÉEL via **sharp** (déjà présent dans node_modules — aucune installation) :
> `prepareImagesForModel` décode les pixels, **redimensionne à ≤1024px** (`fit:inside`,
> sans agrandir), **recompresse** (png niveau 9 / jpeg q72 mozjpeg / webp q72) et retire
> TOUTES les métadonnées (sharp ne réémet pas l'EXIF). Repli honnête (sharp indisponible) :
> le chunk-strip ci-dessous (métadonnées retirées, `pixelResize:false`). Preuve :
> `image-sanitizer.test.ts` — image 2000×1500 → **≤1024px**, octets↓, EXIF « GPS:… »
> injecté puis **absent** de ce qui part au modèle. Le texte ci-dessous décrit le repli.
>
> **Honnêteté :** sharp est fourni TRANSITIVEMENT par la chaîne d'outils (présent dans
> `node_modules`, **non déclaré dans `package.json`**). Le resize pixel est donc RÉEL **là
> où sharp est présent** (le cas ici, prouvé — le test ÉCHOUE si sharp est absent) ; s'il
> était absent en production, le pipeline retombe sur le chunk-strip (métadonnées retirées,
> **sans** resize). Chaque réponse expose `imageSanitization.engine` (`sharp`/`chunk-strip`)
> et `pixelResize` (true/false) — le client sait donc TOUJOURS ce qui a réellement été fait
> (jamais silencieux).


**Avant (P9.4)** : validation regex mime + estimation de taille ; l'ORIGINAL (EXIF
inclus) était envoyé à OpenAI ; « metadata stripping / resize / compression » étaient des
claims NON tenus. **Après (P9.4.1)** : sanitisation RÉELLE (`openai/image-sanitizer.ts`),
+ honnêteté explicite sur ce qui n'est pas fait.

## Ce qui est RÉELLEMENT fait (prouvé)
- **Vérification des magic bytes** (PNG 89504E47 / JPEG FFD8FF / WebP RIFF…WEBP) — pas juste le mime déclaré.
- **Lecture des dimensions réelles** depuis l'en-tête (PNG IHDR, JPEG SOFn, WebP VP8X).
- **Refus des decompression bombs** (dimension > 12000, pixels > 40 Mpx, octets > 4 Mo).
- **Suppression des métadonnées** par filtrage de chunks du conteneur :
  - PNG : retire `tEXt/zTXt/iTXt/eXIf/tIME/iCCP` (garde IHDR/PLTE/IDAT/IEND…).
  - JPEG : retire `APP1`(EXIF/XMP)/`APPn`/`COM` (garde SOF/DQT/DHT/SOS + données).
  - WebP : retire `EXIF`/`XMP ` du conteneur RIFF (réécrit la taille).
- **L'image envoyée au modèle est la version SANITISÉE** (EXIF/GPS retiré), + hash du contenu nettoyé.
- **Éphémère** : jamais persistée ; seules des métadonnées (mime/octets/dimensions/hash) sont conservées.

## Ce qui n'est HONNÊTEMENT pas fait
Le **redimensionnement / recompression au niveau PIXEL** n'est PAS effectué localement
(nécessiterait un codec / dépendance native lourde — le brief demande de ne pas en
ajouter sans nécessité). Le coût est maîtrisé autrement : `detail:"low"` (sous-
échantillonnage côté OpenAI) + plafond d'octets strict + max 2 images/tour. Le rapport
renvoyé indique explicitement `pixelResize:false`.

## Preuves (`image-sanitizer.test.ts`, 6 tests)
Magic bytes vérifiés (faux rejeté) ; dimensions lues ; bomb refusée ; **PNG : chunk tEXt
contenant "GPS:48.85" RETIRÉ**, image reste un PNG valide ; **JPEG : segment APP1/EXIF
RETIRÉ** ; `prepareImagesForModel` : ce qui part au modèle ne contient plus la métadonnée,
rapport honnête (`metadataStripped:true, magicVerified:true, pixelResize:false`).
