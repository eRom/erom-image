# Spec : plugin agence-image

Date : 2026-07-30 · Statut : design validé par Romain · Gate atelier : visuels des œuvres en cours (usage immédiat)

> **Révision du 2026-07-30 (même jour), après recherche dans la doc officielle et probes live.** Cinq faits ont corrigé la première version : `chatgpt-image-latest`, `gpt-image-1.5` et `gpt-image-1-mini` sont **dépréciés** (2026-06-02, retrait le 2026-12-01, remplaçant désigné `gpt-image-2`) ; `background: "transparent"` **échoue systématiquement** sur gpt-image-2 ; `input_fidelity` est documenté de façon contradictoire et sans effet (gpt-image-2 traite toujours en haute fidélité) ; `revised_prompt` et `url` sont **dall-e-3/2 uniquement**, jamais retournés par gpt-image ; la taille maximale est `3840x2160` **inclus** (= 8 294 400 px, la borne haute de pixels). Sections 6 et 7 mises à jour en conséquence.

## 1. Objectif

Un plugin Claude Code `agence-image`, distribué par erom-marketplace, exposant deux serveurs MCP de génération d'images avec leurs skills de pilotage :

- **nanobanana** (Gemini) : images, icônes multi-tailles, diagrammes techniques. Serveur existant (`servers/nanobanana/src`), réutilisé tel quel.
- **gpt-image** (OpenAI, API Images, défaut `gpt-image-2`) : texte exact dans l'image, composition multi-images, édition haute fidélité. À construire.

Facts API vérifiés en live le 2026-07-30 sur developers.openai.com (guide image-generation + cookbook prompting guide).

## 2. Décisions actées

| Sujet | Décision |
|---|---|
| Nom du plugin | `agence-image` → outils préfixés `mcp__plugin_agence-image_<serveur>__*` |
| Surface gpt-image | 2 outils : `gpt_image_generate`, `gpt_image_edit` (icônes/diagrammes restent le territoire nanobanana) |
| Packaging | `plugin/` = racine du plugin, autonome ; source marketplace `git-subdir` avec `path: "plugin"` |
| Runtime serveurs | bundles single-file `bun build --target=node`, committés dans `plugin/`, exécutés par `node` |
| Client HTTP OpenAI | fetch natif + FormData (Node ≥ 18), zéro dépendance ajoutée |
| Défauts gpt-image | model `gpt-image-2`, quality `auto`, size `auto` |

## 3. Architecture

```
erom-agence-image/                     # repo dev (jamais installé tel quel)
├── .gitignore                         # node_modules, .DS_Store, _memory_/
├── package.json                       # bun : deps + scripts build/test/typecheck
├── tsconfig.json                      # typecheck seul (noEmit), le build est bun
├── docs/superpowers/specs/            # ce spec
├── scripts/mcp-handshake.sh           # liste les tools d'un bundle (vérification réutilisée à chaque tâche)
├── servers/
│   ├── nanobanana/src/                # existant : index, constants, services/gemini, tools/{generate,edit,icon,diagram}
│   └── gpt-image/src/                 # à écrire : index, constants(+test), services/openai(+test), tools/{generate,edit}
└── plugin/                            # artefact distribuable, rien ne pointe hors de ce dossier
    ├── .claude-plugin/plugin.json
    ├── .mcp.json
    ├── skills/
    │   ├── nanobanana/SKILL.md        # existant, retouche des préfixes d'outils
    │   └── gpt-image/SKILL.md         # à écrire
    └── servers/
        ├── nanobanana/dist/index.js   # bundle committé
        └── gpt-image/dist/index.js    # bundle committé
```

- `plugin/agents/` vide : non utilisé (invisible pour git, aucun composant agent en 0.1.0).
- `_memory_/` : réceptacle caserne local (IDs Linear/Slack internes), gitignoré car le repo sera public.

## 4. Build et packaging

`package.json` racine :

```json
{
  "name": "erom-agence-image",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=18" },
  "scripts": {
    "build": "bun run build:nanobanana && bun run build:gpt-image",
    "build:nanobanana": "bun build servers/nanobanana/src/index.ts --target=node --outfile=plugin/servers/nanobanana/dist/index.js",
    "build:gpt-image": "bun build servers/gpt-image/src/index.ts --target=node --outfile=plugin/servers/gpt-image/dist/index.js",
    "typecheck": "tsc --noEmit",
    "test": "bun test"
  },
  "dependencies": {
    "@google/genai": "^1.0.0",
    "@modelcontextprotocol/sdk": "^1.6.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/bun": "^1.3.5",
    "@types/node": "^22.10.0",
    "typescript": "^5.7.2"
  }
}
```

Versions résolues et vérifiées le 2026-07-30 : `@modelcontextprotocol/sdk` 1.30.0, `zod` 3.25.76, `@google/genai` 1.52.0. C'est avec elles que le bundle nanobanana se construit et répond au handshake.

- **Pourquoi le bundling** : le cache d'installation d'un plugin (clone git-subdir) n'a ni `node_modules` ni étape de build. L'ancien build tsc de claude-nanobanana-mcp ne fonctionnait que grâce à son `node_modules` local : non portable en plugin. `bun build --target=node` inline SDK MCP, zod et @google/genai dans un seul fichier exécutable par `node`.
- **zod reste en ^3** : compatibilité avec `registerTool` du SDK prouvée par le serveur existant. Pas de montée en zod 4 dans ce chantier.
- tsconfig : `target ES2022`, `module NodeNext`, `moduleResolution NodeNext`, `strict`, `noEmit`, `skipLibCheck`, include `servers/*/src/**/*.ts`.

## 5. Configuration plugin

`plugin/.claude-plugin/plugin.json` (style caserne) :

```json
{
  "$schema": "https://www.schemastore.org/claude-code-plugin-manifest.json",
  "name": "agence-image",
  "description": "Génération et édition d'images : nanobanana (Gemini) pour images, icônes et diagrammes ; gpt-image (OpenAI gpt-image-2) pour texte exact, compositions multi-images et éditions haute fidélité.",
  "version": "0.1.0",
  "author": { "name": "Romain Ecarnot", "url": "https://github.com/eRom" },
  "repository": "https://github.com/eRom/erom-agence-image",
  "license": "MIT",
  "keywords": ["images", "image-generation", "mcp", "gemini", "nanobanana", "openai", "gpt-image"],
  "skills": "./skills/",
  "mcpServers": "./.mcp.json"
}
```

`plugin/.mcp.json` (remplace les chemins relatifs actuels, cassés hors du repo) :

```json
{
  "mcpServers": {
    "nanobanana": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/servers/nanobanana/dist/index.js"],
      "env": { "GEMINI_API_KEY": "${GEMINI_API_KEY}" }
    },
    "gpt-image": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/servers/gpt-image/dist/index.js"],
      "env": { "OPENAI_API_KEY": "${OPENAI_API_KEY}" }
    }
  }
}
```

## 6. Serveur gpt-image

Structure miroir de nanobanana : `index.ts` (fail-fast si `OPENAI_API_KEY` absent, enregistrement des 2 tools, transport stdio), `constants.ts`, `services/openai.ts`, `tools/generate.ts`, `tools/edit.ts`. Conventions identiques : filename auto `gptimage_<slug>_<timestamp>.<ext>`, `ensureDir`, erreurs en `isError` + message, annotations MCP `{readOnly: false, destructive: false, idempotent: false, openWorld: true}`.

### 6.1 constants.ts

- `MODELS` : `gpt-image-2` (défaut), `gpt-image-2-2026-04-21` (snapshot daté). Les autres modèles image sont volontairement absents de l'énumération : `chatgpt-image-latest`, `gpt-image-1.5` et `gpt-image-1-mini` sont dépréciés depuis le 2026-06-02 et retirés de l'API le 2026-12-01 ; les exposer inviterait l'agent à choisir un modèle condamné.
- `SIZE_PRESETS` : `auto`, `1024x1024`, `1536x1024`, `1024x1536`, `2048x2048` ; taille custom `LxH` acceptée par regex. Contraintes gpt-image-2 : bords multiples de 16 et ≤ 3840, ratio ≤ 3:1, 655 360 à 8 294 400 px au total (le maximum documenté `3840x2160` vaut exactement 8 294 400 px), fiabilité maximale conseillée 2560x1440
- `QUALITIES` : `auto`, `low`, `medium`, `high` · `OUTPUT_FORMATS` : `png`, `jpeg`, `webp` · `BACKGROUNDS` : `auto`, `opaque` (`transparent` exclu : la doc énonce que les requêtes gpt-image-2 avec `background: "transparent"` échouent, donc l'exposer serait offrir une valeur qui échoue à coup sûr) · `MODERATIONS` : `auto`, `low`
- Pas de constante `input_fidelity` : le paramètre est documenté de façon contradictoire (la doc CLI dit gpt-image-2 non supporté, le cookbook montre du code qui le passe) et sans bénéfice, gpt-image-2 traitant toujours ses entrées en haute fidélité. Un paramètre sans effet et au comportement incertain n'entre pas dans la surface d'outils.

### 6.2 services/openai.ts

Base URL lue dans `OPENAI_BASE_URL` (défaut `https://api.openai.com/v1`) : la seule affordance ajoutée, elle rend les tests exécutables contre un serveur HTTP local sans toucher au réseau.

- `buildGenerationBody(prompt, opts)` (pur) → body JSON de `/images/generations` : `model`, `prompt`, et si définis `size`, `quality`, `output_format`, `output_compression`, `background`, `moderation`. Les champs non définis sont omis.
- `buildEditForm(imagePaths[], prompt, opts)` (pur hors lecture disque) → FormData de `/images/edits`. Fichiers sous la clé **`image[]` répétée** (1 à 16, Blob + nom + mime), `mask` optionnel ; champs texte : `model`, `prompt`, et si définis `size`, `quality`, `output_format`, `output_compression`, `background`. La clé `image[]` est confirmée par un exemple curl officiel verbatim, qui l'emploie même pour une seule image, avec `model=gpt-image-2` (source : guides/image-generation).
- `moderation` : exposé sur generate uniquement (non documenté sur edits).
- Réponse : `data[0].b64_json` décodé et écrit sur disque, extension dérivée de `output_format` ; `usage` relayé dans la sortie. Pas de lecture de `url` ni de `revised_prompt` : la doc énonce que ces champs sont réservés à dall-e-2/3 et absents des réponses gpt-image.
- `formatApiError(status, json, statusText)` (pur) : deux formes d'erreur documentées. La générique porte `error.message` ; celle de modération n'a **pas** de `message` et transporte `error.moderation_details` (`moderation_stage`, `categories`), reformaté en « blocked at input stage for: harassment ». Repli sur `statusText` si le corps est illisible.
- Pas de timeout côté client : la couche MCP le gère, la skill documente `MCP_TOOL_TIMEOUT=120000` pour `quality: high`.

### 6.3 Tools

`gpt_image_generate` :

| Param | Type | Requis | Défaut | Note |
|---|---|---|---|---|
| `prompt` | string ≤ 5000 | oui | — | description de l'image |
| `output_dir` | string | non | `"./"` | |
| `filename` | string | non | auto | extension alignée sur `output_format` |
| `size` | preset ∪ `LxH` | non | `auto` | contraintes §6.1 |
| `quality` | enum | non | `auto` | `medium`/`high` pour texte dense |
| `output_format` | enum | non | `png` | |
| `output_compression` | int 0-100 | non | — | jpeg/webp uniquement |
| `background` | enum | non | `auto` | `auto` ou `opaque` |
| `moderation` | enum | non | `auto` | |
| `model` | enum | non | `gpt-image-2` | levier de coût = `quality: low` (~$0,006 en 1024²), pas un modèle plus faible |

`gpt_image_edit` :

| Param | Type | Requis | Défaut | Note |
|---|---|---|---|---|
| `image_paths` | string[] 1..16 | oui | — | composition multi-images, référencées « Image 1, Image 2… » dans le prompt |
| `prompt` | string ≤ 5000 | oui | — | instructions d'édition |
| `mask_path` | string | non | — | PNG avec canal alpha, dimensions de la 1re image |
| `output_dir` | string | non | dossier de la 1re image | |
| `filename`, `size`, `quality`, `output_format`, `output_compression`, `background`, `model` | — | non | idem generate | ni `moderation`, ni `input_fidelity` |

## 7. Skills

### 7.1 `plugin/skills/gpt-image/SKILL.md` (à écrire)

Miroir structurel de la skill nanobanana. Frontmatter : `name: gpt-image`, `user-invocable: true`, description avec triggers (texte exact dans l'image, affiche, poster, mockup UI, bannière typographiée, composition multi-images, retouche haute fidélité, photo produit). Sections :

1. **Délégation obligatoire via sous-agent** (miroir nanobanana : jamais d'appel direct dans le contexte principal, Task tool + ToolSearch, retour = chemin du fichier).
2. **Table de routage gpt-image vs nanobanana** : texte exact / mockups / compositions / retouches fidèles → gpt-image ; icônes / diagrammes / itération rapide pas chère → nanobanana.
3. **Défauts intelligents** : `gpt-image-2` + `auto`/`auto` ; `quality: low` pour les brouillons et le volume ; `quality: medium|high` dès qu'il y a du texte dense.
4. **Les 2 tools** avec tables de paramètres.
5. **Doctrine de prompting** (condensé du cookbook OpenAI) : structure scène → sujet → détails → contraintes ; texte exact entre guillemets + typo spécifiée (police, taille, couleur, position), mots rares épelés ; photoréalisme par vocabulaire photographique (objectif, lumière, cadrage) + textures (pores, grain, usure) ; édition par « change only X, keep everything else the same » avec liste de préservation répétée à chaque itération ; composition par index (« apply Image 2's style to Image 1's subject ») ; itération single-change plutôt que réécriture.
6. **Exemples** d'appels typiques.
7. **Coûts, ordres de grandeur** (gpt-image-2, 1024×1024 : low ≈ $0.006, medium ≈ $0.05, high ≈ $0.21) et **limitations** (pas de fond transparent sur gpt-image-2, latence en high, vérification d'organisation OpenAI possible au premier usage, plafond de facturation OpenAI à surveiller).

### 7.2 `plugin/skills/nanobanana/SKILL.md` (retouche minimale)

Les références `mcp__nanobanana__*` deviennent `mcp__plugin_agence-image_nanobanana__*`. Le reste est inchangé.

## 8. Marketplace (repo erom-marketplace)

Entrée ajoutée à `.claude-plugin/marketplace.json` :

```json
{
  "name": "agence-image",
  "source": {
    "source": "git-subdir",
    "url": "https://github.com/eRom/erom-agence-image.git",
    "path": "plugin",
    "ref": "main"
  },
  "description": "Génération et édition d'images par MCP : nanobanana (Gemini) pour images, icônes et diagrammes ; gpt-image (OpenAI gpt-image-2) pour texte exact dans l'image, compositions multi-images et éditions haute fidélité. Skills de routage et de prompting incluses.",
  "version": "0.1.0",
  "strict": true
}
```

`metadata.version` : 0.7.1 → 0.8.0. Fichier Codex `.agents/plugins/marketplace.json` non modifié (il ne liste que caserne, pattern actuel). Pas de pin `sha` (cohérent avec les entrées existantes). Commit : `chore(marketplace): agence-image 0.1.0, metadata 0.8.0`.

## 9. Vérification

1. `bun install && bun run typecheck` : vert. Tsconfig validé : `fetch`/`FormData`/`Blob` typent sans `lib: DOM`, avec `types: ["node", "bun"]`.
2. `bun test` : suites `constants.test.ts` (validation des tailles) et `services/openai.test.ts` (forme réelle des requêtes émises, contre un serveur HTTP local via `OPENAI_BASE_URL`).
3. `bun run build` : 2 bundles produits, taille sanity (mesuré sur nanobanana : 1,9 Mo, 338 modules).
4. Boot sans clé : `node plugin/servers/gpt-image/dist/index.js` sans `OPENAI_API_KEY` → exit 1 avec message clair (comportement déjà vérifié sur nanobanana sans `GEMINI_API_KEY`).
5. Handshake MCP via `scripts/mcp-handshake.sh` : 2 tools gpt-image, 4 tools nanobanana, avec leurs schémas.
6. E2E installation : marketplace temporaire locale avec source `git-subdir` sur `file:///Users/recarnot/dev/erom-agence-image` → `claude plugin install` → le cache contient le seul contenu de `plugin/`, `/mcp` liste les 2 serveurs. Si `file://` n'est pas supporté : E2E réel après push, en repli.
7. **Smoke réel — bloqué côté OpenAI.** La clé locale renvoie `billing_hard_limit_reached` sur tout appel image (constaté le 2026-07-30 sur `/v1/images/generations` et `/v1/images/edits`). Le smoke nanobanana reste faisable. Le smoke gpt-image (1 `generate` low 1024², 1 `edit` low sur l'image produite, < 5 centimes) est reporté jusqu'à relèvement du plafond par Romain dans le dashboard OpenAI. Deux points ne seront confirmés qu'à ce moment : le rejet effectif de `background: "transparent"` et la tolérance réelle des tailles custom aux bornes.

## 10. Hors périmètre et suites

- **Push GitHub** (repo public) et **push marketplace** : par Romain en fin de chantier, sur demande explicite.
- **Retrait de l'entrée globale `nanobanana`** de `~/.claude.json` (pointe vers l'ancien repo claude-nanobanana-mcp) une fois le plugin validé, sinon doublon d'outils.
- claude-nanobanana-mcp : legacy, non touché.
- Pas d'agent, pas de commande slash, pas de hook dans ce plugin en 0.1.0.
