---
name: gpt
description: "Génération et édition d'images via GPT Image MCP (OpenAI gpt-image-2.5) : texte exact dans l'image, maquettes UI, affiches, fond transparent, composition multi-images, retouche haute fidélité. Triggers: image avec du texte, affiche, poster, maquette, mockup, bannière typographiée, sticker ou logo sur fond transparent, composer plusieurs images, retoucher en préservant."
user-invocable: true
---

# GPT Image MCP Skill

Tu as accès à **GPT Image**, un serveur MCP branché sur l'API Images d'OpenAI (`gpt-image-2.5`, en deux variantes : `flare` et `sunburst`). Il expose 2 outils : génération texte-vers-image et édition/composition d'images existantes.

Ce que ce serveur fait mieux que nanobanana : **le texte rendu dans l'image est exact**, l'instruction précise est suivie, l'édition préserve identité et géométrie, et **le fond transparent est réel** (vrai canal alpha, pas un damier peint). Ce qu'il fait moins bien : il est plus lent, plus cher et plafonné à un ratio 3:1.

---

## Comportement général

**Délégation obligatoire via sous-agent :**
- **Ne JAMAIS appeler les tools `mcp__plugin_erom-image_gpt__*` directement** dans le contexte principal
- Toujours déléguer via le **Task tool** avec `subagent_type: "general-purpose"` pour protéger la fenêtre de contexte
- Le sous-agent doit : charger le tool via `ToolSearch`, appeler le tool MCP, et retourner uniquement le résultat (chemin du fichier généré, succès/erreur)
- La réponse de l'outil est un bloc texte dont la ligne utile est `📁 Saved to: <chemin>` : le sous-agent en extrait le chemin et ne remonte que lui, jamais le bloc entier
- Le prompt du sous-agent doit contenir tous les paramètres nécessaires, prompt image complet inclus (`prompt`, `output_dir`, `size`, `quality`, `image_paths`...)

**Avant de déléguer :**
- Si le besoin est clair → délègue directement, sans confirmation
- Si l'image doit porter du texte et que la chaîne exacte n'a pas été donnée mot pour mot → demande-la avant de générer. Une faute typographique se repaie en image entière, pas en correctif.
- Si le besoin ressemble à une icône, un diagramme ou une itération jetable → vérifie d'abord la table de routage ci-dessous, nanobanana est souvent le bon serveur
- Toujours utiliser le répertoire de travail courant comme `output_dir` par défaut, en chemin absolu, sauf si Romain spécifie un autre chemin

**Clé d'API :** `OPENAI_API_KEY` doit être présente dans l'environnement. Sans elle, chaque appel renvoie `Missing API key`.

---

## Routage GPT Image vs nanobanana

| Prends `gpt` quand | Prends `nanobanana` quand |
|--------------------------|---------------------------|
| Du texte exact doit apparaître dans l'image (slogan, titre, étiquette, label d'UI) | L'image ne porte pas de texte, ou du lettrage décoratif illisible suffit |
| Maquette d'interface : écran d'app, dashboard, composant avec libellés | Icône à sortir en plusieurs tailles d'un coup (`nanobanana_icon`) |
| Affiche, poster, couverture, mise en page typographique | Diagramme technique structuré (`nanobanana_diagram`) |
| Composition de plusieurs images sources en une seule (jusqu'à 16 entrées) | Itération rapide et bon marché, exploration en volume |
| Retouche devant préserver identité, géométrie, cadrage, lumière | Ratio au-delà de 3:1 : `8:1`, `4:1`, `1:4`, `1:8` (GPT Image plafonne à 3:1) |
| Photo produit, packshot, rendu commercial crédible | Rendu graphique riche sans texte, où l'esthétique prime sur la précision |
| Fond transparent : sticker, logo, sujet détouré (`background: "transparent"`, sortie `png` ou `webp`) | Jamais pour un fond transparent : nanobanana ne le garantit pas |
| Inpainting : remplacer une zone précise via un masque | Sortie au-delà de `2560x1440` : GPT Image accepte jusqu'à `3840x2160`, mais c'est au-dessus de son plafond de fiabilité conseillé |

**`21:9` n'est pas un motif de routage :** il vaut 2,3333:1, donc sous le plafond de 3:1. Une bannière 21:9 portant un slogan exact reste un cas GPT Image (`2688x1152`).

**Cas mixte fréquent :** visuel riche dont le rendu graphique prime, avec du texte exact ajouté ensuite → nanobanana pour la base, puis `gpt_image_edit` pour incruster le texte.

---

## Choix du modèle

| Modèle | Pour quoi | Défaut de |
|--------|-----------|-----------|
| `gpt-image-2.5-flare` | Génération rapide et de qualité : le cas courant | `gpt_image_generate` |
| `gpt-image-2.5-sunburst` | Le plus capable des deux, fait pour l'édition où la précision compte | `gpt_image_edit` |
| `gpt-image-2` | Génération précédente, encore servie : uniquement pour reproduire un rendu produit avant le 2026-09-08 | aucun |

Les trois ont **le même tarif au token** : choisir entre `flare` et `sunburst` est une question de vitesse contre précision, pas de budget. Passer `sunburst` en génération quand l'image doit être juste du premier coup (texte dense, maquette détaillée) : c'est le plus capable selon la doc OpenAI, ce n'est pas mesuré ici.

Pour figer un rendu reproductible, passer le snapshot daté : `gpt-image-2.5-flare-2026-09-08`, `gpt-image-2.5-sunburst-2026-09-08` ou `gpt-image-2-2026-04-21`.

---

## Défauts intelligents

| Paramètre | Défaut à appliquer | Quand s'en écarter |
|-----------|--------------------|--------------------|
| `model` | `gpt-image-2.5-flare` en génération, `gpt-image-2.5-sunburst` en édition | Voir « Choix du modèle » |
| `size` | `auto` | Dès que le format de sortie est contraint (bannière, story, impression) |
| `quality` | `auto` | `low` pour brouillon et volume ; `medium` ou `high` dès qu'il y a du texte dense ou de petits caractères ; `xhigh` ou `max` pour un rendu final quand `high` ne suffit pas (2.5 uniquement, coût non mesuré) |
| `output_format` | `png` | `jpeg` ou `webp` + `output_compression` pour alléger une photo destinée au web |
| `output_dir` | répertoire de travail courant, en absolu | Chemin explicite donné par Romain |
| `background` | non transmis | `transparent` pour un sticker, un logo ou un sujet détouré, avec `output_format` `png` ou `webp` ; `opaque` pour forcer un fond plein |
| `moderation` | non transmis | `moderation: "low"` si un sujet légitime est bloqué à tort (generate uniquement) |

**Le levier de coût est `quality`, pas le modèle.** Les deux variantes 2.5 et `gpt-image-2` coûtent le même prix au token. `chatgpt-image-latest`, `gpt-image-1.5` et `gpt-image-1-mini` sont dépréciés depuis le 2026-06-02 et retirés de l'API le 2026-12-01 : ne jamais les proposer. Pour dépenser moins, on descend en qualité, pas en modèle.

**Boucle de travail recommandée :** cadrer en `quality: "low"` (une image coûte ~$0,006), valider la composition, puis relancer le prompt retenu en `medium` ou `high`.

---

## Tools disponibles

### Génération d'images

#### `gpt_image_generate`
Génère une image à partir d'un prompt texte.

| Paramètre | Type | Requis | Défaut | Description |
|-----------|------|--------|--------|-------------|
| `prompt` | string | oui | aucun | Description de l'image (1 à 5000 caractères) |
| `output_dir` | string | non | `"./"` | Répertoire de sortie, créé s'il n'existe pas. Le défaut `"./"` est résolu dans le répertoire courant du **processus serveur MCP**, pas dans celui de la conversation : laissé tel quel, le fichier atterrit hors du projet. Toujours passer un chemin absolu. |
| `filename` | string | non | auto | Nom du fichier ; sinon `gptimage_<slug>_<timestamp>.<ext>` |
| `size` | string | non | `"auto"` | Preset ou `"LARGEURxHAUTEUR"` custom (voir section Tailles) |
| `quality` | enum | non | `"auto"` | `auto` · `low` · `medium` · `high` · `xhigh` · `max` (les deux derniers sur 2.5 uniquement) |
| `output_format` | enum | non | `"png"` | `png` · `jpeg` · `webp` (le `.jpg` est l'extension écrite pour `jpeg`) |
| `output_compression` | integer | non | aucun | 0 à 100 ; ne s'applique qu'à `jpeg` et `webp` |
| `background` | enum | non | aucun | `auto` · `opaque` · `transparent` (exige `png` ou `webp`) |
| `moderation` | enum | non | aucun | `auto` · `low` (assouplit le filtre de contenu) |
| `model` | enum | non | `"gpt-image-2.5-flare"` | `gpt-image-2.5-flare` · `gpt-image-2.5-sunburst` · `gpt-image-2`, et leurs snapshots datés |

**Quand l'utiliser :** "Fais une affiche pour...", "Génère une maquette de l'écran...", "Crée un visuel avec le texte...", "Photo produit de..."

**À demander si manquant :** la chaîne de texte exacte si l'image doit en porter. Le reste s'infère du contexte.

---

### Édition et composition

#### `gpt_image_edit`
Édite une image existante, ou compose plusieurs images en une seule. Accepte 1 à 16 entrées.

| Paramètre | Type | Requis | Défaut | Description |
|-----------|------|--------|--------|-------------|
| `image_paths` | array[string] | oui | aucun | 1 à 16 chemins. L'ordre du tableau fixe les index `Image 1`, `Image 2`... du prompt. |
| `prompt` | string | oui | aucun | Instructions d'édition (1 à 5000 caractères) |
| `mask_path` | string | non | aucun | PNG avec canal alpha, aux dimensions de la première image et de même format ; une source `jpeg` ou `webp` n'ayant pas de canal alpha, la convertir en PNG avant tout masquage. Par convention la zone transparente est celle qui sera repeinte, mais la doc OpenAI ne l'énonce pas explicitement : vérifier sur un premier essai et inverser le masque si le résultat est inversé |
| `output_dir` | string | non | dossier de la 1re image | Répertoire de sortie |
| `filename` | string | non | auto | Sinon `gptimage_edit_<slug>_<timestamp>.<ext>` |
| `size` | string | non | `"auto"` | Mêmes règles que `gpt_image_generate`. En `auto`, l'édition ne préserve pas les dimensions de la source : constaté en test réel, une source 1024x1024 éditée en `auto` est ressortie en 1254x1254. Passer une taille explicite si les dimensions de la source doivent être préservées. |
| `quality` | enum | non | `"auto"` | `auto` · `low` · `medium` · `high` · `xhigh` · `max` (les deux derniers sur 2.5 uniquement) |
| `output_format` | enum | non | `"png"` | `png` · `jpeg` · `webp` |
| `output_compression` | integer | non | aucun | 0 à 100 ; `jpeg` et `webp` seulement |
| `background` | enum | non | aucun | `auto` · `opaque` · `transparent` (exige `png` ou `webp`) |
| `model` | enum | non | `"gpt-image-2.5-sunburst"` | `gpt-image-2.5-sunburst` · `gpt-image-2.5-flare` · `gpt-image-2`, et leurs snapshots datés |

**Quand l'utiliser :** "Retouche cette photo pour...", "Mets le produit de cette image sur ce fond", "Applique le style de A au sujet de B", "Remplace la zone masquée par..."

**À demander si manquant :** les chemins des images sources, et laquelle est le sujet quand il y en a plusieurs.

**Différences avec `gpt_image_generate` :** `image_paths` et `mask_path` en plus, `moderation` en moins.

**Ce qui n'existe pas dans cette surface :** aucun réglage de fidélité d'entrée, aucun nombre de variantes par appel, aucun streaming. Un appel produit exactement un fichier.

---

## Tailles

**Presets :**

| Valeur | Ratio | Usage typique |
|--------|-------|---------------|
| `auto` | choisi par le modèle | Défaut, quand le format n'est pas contraint |
| `1024x1024` | 1:1 | Réseaux sociaux, vignette, brouillon (référence de coût) |
| `1536x1024` | 3:2 paysage | Hero, slide, bannière modérée |
| `1024x1536` | 2:3 portrait | Affiche, couverture, story |
| `2048x2048` | 1:1 | Impression, détail fin |

**Tailles custom `"LARGEURxHAUTEUR"` :** quatre règles, toutes vérifiées côté serveur avant l'appel API.

| Règle | Valeur |
|-------|--------|
| Bords multiples de | 16 |
| Bord maximum | 3840 px |
| Ratio long/court maximum | 3:1 |
| Pixels totaux | entre 655 360 et 8 294 400 |

**Plafond de fiabilité conseillé : `2560x1440`.** Les limites dures vont plus loin (`3840x2160` passe la validation, il touche exactement le plafond de 8 294 400 pixels). C'est une convention de prudence retenue pour ce serveur, pas une mesure : au-delà, considérer le rendu comme non éprouvé plutôt que dégradé.

**Correspondances d'usage.** Toutes ces valeurs ont été exécutées contre la validation du serveur ; les utiliser telles quelles évite tout calcul.

| Besoin | Taille | Note |
|--------|--------|------|
| Brouillon, exploration | `1024x1024` | avec `quality: "low"` |
| Paysage 16:9, qualité maximale conseillée | `2560x1440` | 16:9 exact (1,7778:1), plafond de fiabilité |
| Paysage 16:9 léger | `1280x720` | 16:9 exact, 921 600 px, juste au-dessus du plancher de 655 360 |
| Paysage proche 16:9, taille moyenne | `1920x1088` | 1,7647:1 (1080 n'est pas multiple de 16, 1088 l'est) |
| Bannière 21:9 | `2688x1152` | 21:9 exact (2,3333:1), largement dans les clous |
| Bannière plus large encore | `2560x1088` | 2,3529:1, plus large que 21:9, toujours sous le plafond de 3:1 |
| Portrait 9:16 (story) | `1152x2048` | 9:16 exact (1,7778:1) |
| Portrait proche 9:16, plus léger | `1024x1792` | 1,75:1 |
| Affiche, couverture | `1024x1536` | preset, 2:3 |
| Impression carrée | `2048x2048` | preset |
| Ratio au-delà de 3:1 | impossible ici | passer par nanobanana (`8:1`, `4:1`, `1:8`) |

---

## Doctrine de prompting

C'est ici que se gagne ou se perd le résultat. Le modèle suit l'instruction précise : plus le prompt est structuré, moins il improvise.

### Structure

Ordonner le prompt : **arrière-plan / scène → sujet → détails clés → contraintes.**

> *Fond bleu nuit uni, légèrement texturé. Au centre, une tasse en céramique blanche vue de trois quarts. Vapeur fine, reflet doux sur la lèvre de la tasse. Rien d'autre dans le cadre, pas de texte, marges généreuses.*

### Texte exact dans l'image

| Règle | Application |
|-------|-------------|
| Isoler la chaîne | Entre guillemets, ou en CAPITALES : le texte doit lire `"CONCERT 21 MARS"` et rien d'autre |
| Préciser la typographie | Style (grotesque, serif, condensée), graisse, taille relative, couleur, emplacement exact |
| Épeler les mots rares | Noms propres, acronymes, marques : `"EROM" (E-R-O-M)` |
| Rester court | Une accroche + une ligne secondaire. Un paragraphe entier finit fautif. |
| Une chaîne par zone | Multiplier les blocs de texte multiplie les erreurs |

Si le texte revient faux : ne pas relancer le même prompt à l'identique. Monter `quality`, raccourcir la chaîne, agrandir la zone typographique, ou corriger le seul mot fautif via `gpt_image_edit`.

### Photoréalisme

- Dire **`photorealistic`** explicitement, sinon le modèle glisse vers l'illustration
- Employer un vocabulaire **photographique** : type d'objectif (35 mm, macro), direction et qualité de la lumière (contre-jour doux, lumière rasante, fenêtre latérale), cadrage (plan taille, plongée légère, profondeur de champ courte)
- **Éviter les spécifications techniques d'appareil** (marque de boîtier, ISO, f/2.8) : elles ajoutent du bruit sans piloter le rendu
- **Ajouter des textures** : pores de peau, grain, poussière, usure, micro-rayures, empreintes. Sans elles, le rendu part en plastique lisse et stérile.

### Illustration

- Nommer le **médium dès les premiers mots** : aquarelle, gouache, sérigraphie deux tons, illustration vectorielle plate, rendu 3D, crayon graphite
- Décrire **matières et textures** : grain du papier, aplats sans dégradé, contour à l'encre, bruit de risographie
- Donner une **palette explicite** (2 à 4 couleurs nommées) plutôt que "coloré"

### Édition

- Formule de base : **`change only X, keep everything else the same`**
- **Répéter la liste de préservation à chaque itération**, sinon l'image dérive : identité du visage, géométrie et pose, cadrage, éclairage, arrière-plan, couleurs
- Décrire **la différence**, pas l'image entière : redécrire toute la scène invite le modèle à tout regénérer
- Pour circonscrire physiquement la zone modifiable, fournir `mask_path`

### Composition multi-images

- Référencer les entrées **par index**, dans l'ordre exact de `image_paths`
- Déclarer d'abord ce qu'est chaque entrée, puis l'opération :

> *Image 1 : la photo du produit. Image 2 : la texture de fond. Place le sujet de Image 1 sur le fond de Image 2, conserve l'échelle et l'éclairage de Image 1, ne modifie pas la forme du produit.*

- Formule de transfert de style : `applique le style de Image 2 au sujet de Image 1`

### Itération

- **Une seule modification à la fois**, jamais une réécriture complète du prompt : on perd ce qui marchait déjà
- Repartir de la sortie précédente avec `gpt_image_edit` plutôt que relancer une génération
- Si trois itérations n'ont pas convergé, le problème est la structure du prompt, pas le détail que tu ajustes

### Pièges

| Piège | Symptôme | Correctif |
|-------|----------|-----------|
| Prompt surchargé d'emblée | Éléments ignorés, composition confuse | Partir d'une scène simple, enrichir par éditions successives |
| Aucune contrainte explicite sur ce qui ne doit pas changer | Visage, cadrage et lumière dérivent d'une itération à l'autre | Lister la préservation à chaque appel |
| Style vague ("moderne", "propre", "pro") | Rendu générique, interchangeable | Nommer médium, palette, référence de mise en page |
| Texte long ou nom propre non épelé | Fautes typographiques | Raccourcir, épeler, monter `quality` |
| Négation seule ("sans texte", "pas de logo") | L'élément apparaît quand même | Décrire l'état positif voulu ("surface entièrement vide") |
| `quality: "high"` dès le premier essai | Coût multiplié par ~35 sur des essais jetés | Cadrer en `low`, finaliser en `high` |

---

## Exemples d'utilisation

**"Affiche pour un concert le 21 mars, texte exact CONCERT 21 MARS"**
→ `gpt_image_generate` avec `size: "1024x1536"`, `quality: "high"`, `output_dir: "/Users/recarnot/dev/mon-projet/assets"`, prompt :
*Affiche de concert. Fond dégradé violet nuit vers noir, grain fin. Silhouette de guitariste à contre-jour en bas de cadre. En haut, le texte "CONCERT 21 MARS" en typographie grotesque condensée, capitales blanches, très grande taille, centré. Aucun autre texte. Marges larges.*

**"Maquette de l'écran d'accueil d'une app de suivi de courses"**
→ `gpt_image_generate` avec `size: "1024x1536"`, `quality: "high"`, `output_dir: "/Users/recarnot/dev/mon-projet/design"`, prompt :
*Maquette d'interface mobile, fond sombre #111. En-tête avec le titre "Mes courses". Trois cartes empilées portant les libellés "Épicerie", "Pharmacie", "Marché", chacune avec un compteur d'articles. Barre de navigation basse à trois icônes. Style plat, coins arrondis, accent ambre. Texte net et lisible.*

**"Mets ce produit sur ce fond texturé"**
→ `gpt_image_edit` avec `image_paths: ["/abs/produit.png", "/abs/fond.jpg"]`, `quality: "medium"`, prompt :
*Image 1 : la photo du produit. Image 2 : la texture de fond. Place le sujet de Image 1 sur le fond de Image 2. Conserve l'échelle, la géométrie et l'éclairage du produit. Ajoute une ombre portée douce cohérente avec la lumière de Image 2. Ne modifie ni la forme ni les couleurs du produit.*

**"Change la couleur de la veste sur cette photo, sans toucher au reste"**
→ `gpt_image_edit` avec `image_paths: ["/abs/portrait.jpg"]`, `quality: "high"`, prompt :
*Change only the jacket colour to deep forest green. Keep everything else the same: same face and identity, same pose and geometry, same framing, same lighting, same background, same fabric texture and folds.*

**"Retire l'objet dans le coin, avec un masque"**
→ `gpt_image_edit` avec `image_paths: ["/abs/scene.png"]`, `mask_path: "/abs/scene_mask.png"`, prompt :
*Fill the masked area with a seamless continuation of the wall behind. Change only the masked region, keep everything else the same.*

**"Explore cinq directions de visuel pour la home"**
→ 5 appels `gpt_image_generate` en `quality: "low"`, `size: "1024x1024"`, même `output_dir` absolu pour tous (~$0,03 au total), puis un seul appel `high` sur la direction retenue

---

## Coûts

Ordres de grandeur par image en `1024x1024`. Le tarif au token est le même pour les deux variantes 2.5 et `gpt-image-2`. En `low`, les deux générations mesurées le 2026-09-11 ont consommé exactement 196 tokens de sortie (`gpt-image-2` comme `flare`). Les chiffres `medium` et `high` viennent de `gpt-image-2` et n'ont pas été remesurés sur 2.5.

| Qualité | Coût indicatif | Usage |
|---------|----------------|-------|
| `low` | ≈ $0,006 | Brouillons, exploration, volume |
| `medium` | ≈ $0,05 | Livrable courant, texte lisible |
| `high` | ≈ $0,21 | Texte dense, petits caractères, rendu final |
| `xhigh`, `max` | non mesuré | 2.5 uniquement : rendu final exigeant, jamais en exploration |
| `auto` | variable | Laisse le modèle décider ; à éviter quand le budget compte |

Le coût croît avec la surface : `2048x2048` est quatre fois plus de pixels que la référence. Un aller-retour `low` puis `high` reste moins cher qu'un seul `high` raté.

---

## Limitations

| Limitation | Détail et contournement |
|------------|-------------------------|
| Fond transparent : `png` ou `webp` seulement | Le `jpeg` n'a pas de canal alpha. Constaté sur un seul essai (`sunburst`, `low`) : éditer une source déjà transparente a laissé un halo coloré flou autour du sujet, invisible sur fond noir et flagrant sur fond blanc. Contrôler le résultat sur fond clair avant de livrer. |
| Latence en `quality: "high"` | Un appel en haute qualité et grande taille peut dépasser 60 s. Si timeout, augmenter `MCP_TOOL_TIMEOUT` à `120000`. |
| Vérification d'organisation OpenAI | Le premier usage peut échouer tant que l'organisation n'est pas vérifiée dans la console OpenAI. L'erreur API le dit explicitement ; aucun retry ne la résout. |
| Plafond de facturation | `OpenAI API 400 (billing_hard_limit_reached)` signifie que le plafond de dépense OpenAI est atteint. Ne pas réessayer : il faut relever le plafond côté compte. |
| Modération | Une requête peut être bloquée ; l'erreur nomme l'étape et les catégories. `moderation: "low"` assouplit le filtre, sur `gpt_image_generate` uniquement. |
| Masquage entièrement guidé par le prompt | Le modèle se sert du masque comme d'une indication et peut ne pas en suivre la forme avec précision. Le prompt reste le pilote : décrire ce qui doit apparaître dans la zone, pas seulement la masquer. |
| Contraintes de fichier du masque | L'image à éditer et son masque doivent être de même format et de même taille, chacun sous 50 Mo. Le masque étant un PNG à canal alpha, une source `jpeg` ou `webp` doit être convertie en PNG avant tout masquage. |
| Ratio plafonné à 3:1 | Ni `8:1`, ni `4:1`, ni `1:8` : ces formats vont chez nanobanana. `21:9` (2,3333:1) reste en revanche accessible ici. |
| Sorties raster uniquement | `png`, `jpeg`, `webp`. Pas de SVG, pas de vidéo. |
| Une image par appel | Pas de variantes multiples, pas de streaming, pas de réglage de fidélité d'entrée dans cette surface. |
| `size: "auto"` ne préserve pas les dimensions en édition | Source 1024x1024 éditée en `auto` ressortie en 1254x1254 (constaté en test réel, et 1254 n'est même pas multiple de 16). Passer une taille explicite pour préserver les dimensions de la source. |
