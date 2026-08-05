---
name: nanobanana
description: "Générateur d'images via Nano Banana MCP : texte-vers-image, édition, icônes multi-tailles, diagrammes. Triggers: générer/créer/éditer image, icône, logo, favicon, diagramme."
user-invocable: true
---

# Nano Banana MCP Skill

Tu as accès à **Nano Banana**, un serveur MCP de génération d'images alimenté par l'API Gemini. Il expose 4 outils spécialisés pour la création et l'édition d'images.

---

## Comportement général

**Délégation obligatoire via sous-agent :**
- **Ne JAMAIS appeler les tools `mcp__plugin_erom-image_nanobanana__*` directement** dans le contexte principal
- Toujours déléguer via le **Task tool** avec `subagent_type: "general-purpose"` pour protéger la fenêtre de contexte
- Le sous-agent doit : charger le tool via `ToolSearch`, appeler le tool MCP, et retourner uniquement le résultat (chemin du fichier généré, succès/erreur)
- Le prompt du sous-agent doit contenir tous les paramètres nécessaires (prompt, output_dir, style, etc.)

**Avant de déléguer :**
- Si le prompt est clair → délègue directement, sans confirmation
- Si le type de contenu est ambigu (image vs icône vs diagramme) → demande une clarification ciblée
- Toujours utiliser le répertoire de travail courant comme `output_dir` par défaut, sauf si Romain spécifie un autre chemin

**Défauts intelligents :**
- Résolution par défaut : `1K` pour les images, `2K` pour les diagrammes
- Modèle par défaut : `nano-banana-2` (`gemini-3.1-flash-image-preview`) — suffisant pour la majorité des cas
- Utiliser `nano-banana-pro` (`gemini-3-pro-image-preview`) uniquement si Romain demande une qualité supérieure ou si le résultat initial est insuffisant
- Aspect ratio : `1:1` pour les images, `16:9` pour les diagrammes

---

## Ratios d'aspect disponibles

`1:1` · `1:4` · `1:8` · `2:3` · `3:2` · `3:4` · `4:1` · `4:3` · `4:5` · `5:4` · `8:1` · `9:16` · `16:9` · `21:9`

**Correspondances courantes :**
- Photo portrait → `2:3` ou `3:4`
- Photo paysage → `3:2` ou `16:9`
- Bannière → `21:9` ou `4:1`
- Story/Reel → `9:16`
- Carré (réseaux sociaux) → `1:1`

---

## Résolutions disponibles

| Valeur | Usage typique |
|--------|---------------|
| `512px` | Brouillon rapide, aperçu |
| `1K` | Usage général (défaut images) |
| `2K` | Haute qualité (défaut diagrammes) |
| `4K` | Très haute qualité, impression |

---

## Tools disponibles

### Génération d'images

#### `nanobanana_generate`
Génère une image à partir d'un prompt texte.

| Paramètre | Type | Requis | Défaut | Description |
|-----------|------|--------|--------|-------------|
| `prompt` | string | oui | — | Description de l'image à générer (max 5000 caractères) |
| `output_dir` | string | non | `"./"` | Répertoire de sortie |
| `filename` | string | non | auto | Nom du fichier (auto-généré si omis) |
| `aspect_ratio` | string | non | `"1:1"` | Ratio d'aspect |
| `resolution` | string | non | `"1K"` | Résolution de sortie |
| `model` | string | non | `"gemini-3.1-flash-image-preview"` | Modèle Gemini |
| `style` | string | non | — | Style visuel (ex: `watercolor`, `oil-painting`, `pixel-art`, `anime`, `photorealistic`, `pencil-sketch`) |

**Quand l'utiliser :** "Génère une image de...", "Crée une illustration de...", "Dessine-moi..."

**À demander si manquant :** Rien — le prompt seul suffit. Inférer le ratio et la résolution selon le contexte.

---

### Édition d'images

#### `nanobanana_edit`
Édite une image existante via des instructions en langage naturel.

| Paramètre | Type | Requis | Défaut | Description |
|-----------|------|--------|--------|-------------|
| `image_path` | string | oui | — | Chemin vers l'image source à éditer |
| `prompt` | string | oui | — | Instructions d'édition en langage naturel (max 5000 caractères) |
| `output_dir` | string | non | même que source | Répertoire de sortie |
| `filename` | string | non | auto | Nom du fichier de sortie |
| `aspect_ratio` | string | non | original | Ratio de sortie (conserve l'original si omis) |
| `resolution` | string | non | `"1K"` | Résolution de sortie |
| `model` | string | non | `"gemini-3.1-flash-image-preview"` | Modèle Gemini |

**Quand l'utiliser :** "Modifie cette image pour...", "Change le fond de...", "Ajoute un chat à cette image"

**À demander si manquant :** Le chemin de l'image source si non fourni.

---

### Génération d'icônes

#### `nanobanana_icon`
Génère des icônes en plusieurs tailles (app-icon, favicon, ui-element).

| Paramètre | Type | Requis | Défaut | Description |
|-----------|------|--------|--------|-------------|
| `prompt` | string | oui | — | Description de l'icône (max 2000 caractères) |
| `output_dir` | string | non | `"./"` | Répertoire de sortie |
| `type` | string | non | `"app-icon"` | Type d'icône |
| `sizes` | array[int] | non | `[64, 128, 256]` | Tailles en pixels (8–1024px chacune) |
| `style` | string | non | `"minimal"` | Style visuel |
| `model` | string | non | `"gemini-3.1-flash-image-preview"` | Modèle Gemini |

**Types d'icônes :**
- `app-icon` — Icône d'application mobile/desktop
- `favicon` — Favicon pour site web
- `ui-element` — Élément d'interface utilisateur

**Styles d'icônes :**

| Style | Description |
|-------|-------------|
| `minimal` | Lignes épurées, formes simples, couleurs limitées |
| `flat` | Couleurs solides, pas d'ombres ni de dégradés, moderne |
| `3d` | Coloré, tactile avec ombres douces et profondeur subtile |
| `outline` | Style trait/contour avec épaisseur constante |
| `gradient` | Dégradés riches avec transitions de couleurs modernes |
| `glassmorphism` | Effet verre dépoli avec transparence et flou |

**Quand l'utiliser :** "Crée un favicon pour...", "Génère une icône d'app...", "Fais-moi un logo..."

**À demander si manquant :** Rien — le prompt suffit. Inférer le type selon le contexte (mention de "favicon" → `favicon`, mention de "app" → `app-icon`).

**Note :** La génération de multiples tailles peut prendre du temps. Si timeout, augmenter `MCP_TOOL_TIMEOUT` à `120000`.

---

### Diagrammes techniques

#### `nanobanana_diagram`
Génère des diagrammes techniques professionnels à partir de descriptions textuelles.

| Paramètre | Type | Requis | Défaut | Description |
|-----------|------|--------|--------|-------------|
| `prompt` | string | oui | — | Description du diagramme (max 5000 caractères) |
| `output_dir` | string | non | `"./"` | Répertoire de sortie |
| `filename` | string | non | auto | Nom du fichier de sortie |
| `type` | string | non | `"flowchart"` | Type de diagramme |
| `style` | string | non | `"professional"` | Style visuel |
| `complexity` | string | non | `"standard"` | Niveau de détail |
| `aspect_ratio` | string | non | `"16:9"` | Ratio d'aspect |
| `resolution` | string | non | `"2K"` | Résolution de sortie |
| `model` | string | non | `"gemini-3.1-flash-image-preview"` | Modèle Gemini |

**Types de diagrammes :**

| Type | Description |
|------|-------------|
| `flowchart` | Diagramme de flux (rectangles, losanges, ovales) |
| `architecture` | Architecture système (composants, services, connexions, couches) |
| `database` | Diagramme ER (tables, champs, clés primaires, cardinalités) |
| `sequence` | Diagramme de séquence (acteurs, lignes de vie, messages) |
| `mindmap` | Carte mentale (concept central, branches radiales) |

**Styles de diagrammes :**

| Style | Description |
|-------|-------------|
| `professional` | Couleurs sobres (bleus, gris), fond blanc/gris clair |
| `minimal` | Traits fins, beaucoup d'espace blanc, 2-3 couleurs max |
| `colorful` | Couleurs vives, dégradés, couleur distincte par élément |
| `blueprint` | Fond bleu foncé, lignes blanches/cyan, grille, police monospace |

**Niveaux de complexité :**

| Niveau | Description |
|--------|-------------|
| `simple` | 3–6 éléments principaux, vue d'ensemble |
| `standard` | 6–12 éléments, composants et relations clés |
| `detailed` | 12+ éléments, sous-composants, annotations, légendes |

**Quand l'utiliser :** "Fais un diagramme de...", "Schéma d'architecture pour...", "Flowchart du processus de..."

**À demander si manquant :** Rien — le prompt suffit. Inférer le type selon le contexte ("architecture" → `architecture`, "base de données" → `database`, etc.).

---

## Exemples d'utilisation

**"Génère une image d'un coucher de soleil sur la mer en style aquarelle"**
→ `nanobanana_generate` avec `prompt`, `style: "watercolor"`

**"Crée un favicon pour mon site de cuisine"**
→ `nanobanana_icon` avec `prompt: "cooking chef hat"`, `type: "favicon"`, `sizes: [16, 32, 64]`

**"Modifie cette image pour enlever l'arrière-plan"**
→ `nanobanana_edit` avec `image_path` et `prompt: "remove the background, make it transparent"`

**"Diagramme d'architecture microservices pour une app e-commerce"**
→ `nanobanana_diagram` avec `prompt`, `type: "architecture"`, `complexity: "detailed"`

**"Schéma de base de données pour un blog"**
→ `nanobanana_diagram` avec `prompt`, `type: "database"`, `style: "professional"`

**"Icône d'app style glassmorphism pour une app météo"**
→ `nanobanana_icon` avec `prompt: "weather sun cloud"`, `style: "glassmorphism"`, `sizes: [128, 256, 512]`

---

## Modèles disponibles

| Alias | Model ID | Usage |
|-------|----------|-------|
| `nano-banana-2` | `gemini-3.1-flash-image-preview` | Défaut — rapide, bon pour la majorité des cas |
| `nano-banana-pro` | `gemini-3-pro-image-preview` | Qualité supérieure, plus lent |

---

## Limitations

- **Pas de SVG** — toutes les sorties sont des images raster (PNG/JPG)
- **Pas de vidéo** — génération d'images fixes uniquement
- **Texte dans les images** — peu fiable, le texte rendu peut contenir des erreurs typographiques
- **Tailles d'icônes multiples** — peut nécessiter un timeout plus long (120s)
- **Transparence** — non garantie selon le modèle et le prompt
- **Échecs intermittents `IMAGE_OTHER`** — l'API peut renvoyer une réponse vide sans motif de blocage, surtout sur `nano-banana-pro`, puis réussir le même appel quelques minutes plus tard. Le serveur retente automatiquement le modèle demandé, puis bascule sur `nano-banana-2` en le signalant par une ligne `⚠️ Fallback` dans le résultat. Si un échec remonte malgré tout, le message porte le `finishReason` réel : ne jamais conclure à une censure sans y lire un motif de blocage explicite (`IMAGE_SAFETY`, `PROHIBITED_CONTENT`, `IMAGE_RECITATION`).
- **Édition = régénération** — `nanobanana_edit` reconstruit l'image entière, il ne retouche pas localement. Les textures, tracés à main levée et détails non mentionnés dans le prompt seront redessinés.
