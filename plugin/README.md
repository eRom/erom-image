# agence-image

Deux serveurs MCP de génération d'images, et les skills qui les pilotent.

| Serveur | Modèle | Points forts |
|---|---|---|
| `nanobanana` | Gemini (nano-banana-2 / pro) | images, icônes multi-tailles, diagrammes techniques, itération rapide |
| `gpt-image` | OpenAI `gpt-image-2` | texte exact dans l'image, maquettes UI, composition multi-images, édition haute fidélité |

## Prérequis

- `node` ≥ 18 (les serveurs sont distribués sous forme de bundles autonomes)
- `GEMINI_API_KEY` dans l'environnement, pour le serveur nanobanana
- `OPENAI_API_KEY` dans l'environnement, pour le serveur gpt-image

Chaque serveur démarre indépendamment : une seule des deux clés suffit pour utiliser le serveur correspondant.

## Installation

```bash
/plugin marketplace add eRom/erom-marketplace
/plugin install agence-image@erom-marketplace
```

## Outils exposés

- `gpt_image_generate`, `gpt_image_edit`
- `nanobanana_generate`, `nanobanana_edit`, `nanobanana_icon`, `nanobanana_diagram`

Les skills `gpt-image` et `nanobanana` décrivent quand utiliser lequel, et comment rédiger les prompts.

## Coûts

Les deux serveurs appellent des API payantes, facturées sur les clés fournies. Ordres de grandeur
pour `gpt-image-2` en 1024×1024 : `quality: low` ≈ $0,006, `medium` ≈ $0,05, `high` ≈ $0,21.
