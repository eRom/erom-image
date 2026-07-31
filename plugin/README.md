# erom-image

Atelier image et document : deux serveurs MCP de génération d'images, et une skill de
filigrane qui marque le résultat avant diffusion.

## Génération

| Serveur | Modèle | Points forts |
|---|---|---|
| `nanobanana` | Gemini (nano-banana-2 / pro) | images, icônes multi-tailles, diagrammes techniques, itération rapide |
| `gpt` | OpenAI `gpt-image-2` | texte exact dans l'image, maquettes UI, composition multi-images, édition haute fidélité |

## Filigrane

La skill `filigrane` appose un filigrane texte tuilé en diagonale sur une **image** ou un
**PDF**, quelle qu'en soit l'origine. La source n'est jamais modifiée : la sortie est une
copie suffixée `_filigrane`. Sur un PDF, la surimpression est vectorielle, donc le texte
d'origine reste extractible et le poids bouge à peine.

Elle sait aussi chiffrer le PDF produit : `restrict` (lecture libre, édition bloquée -
un ralentisseur, pas un verrou) ou `lock` (AES-256, mot de passe exigé à l'ouverture).

Aucune API, aucune clé, aucun coût : tout s'exécute en local.

## Prérequis

- `node` ≥ 18 — les serveurs MCP sont distribués sous forme de bundles autonomes
- `uv` — pour la skill `filigrane` ([installation](https://docs.astral.sh/uv/)) ; elle
  résout ses dépendances Python toute seule au premier appel
- `GEMINI_API_KEY` dans l'environnement, pour le serveur nanobanana
- `OPENAI_API_KEY` dans l'environnement, pour le serveur `gpt`

Chaque composant est indépendant : une seule des deux clés suffit pour le serveur
correspondant, et le filigrane fonctionne sans aucune des deux.

## Installation

```bash
/plugin marketplace add eRom/erom-marketplace
/plugin install erom-image@erom-marketplace
```

## Outils exposés

- `gpt_image_generate`, `gpt_image_edit`
- `nanobanana_generate`, `nanobanana_edit`, `nanobanana_icon`, `nanobanana_diagram`

Les skills `gpt` et `nanobanana` décrivent quand utiliser lequel et comment rédiger les
prompts ; la skill `filigrane` prend le relais en bout de chaîne.

## Coûts

Les deux serveurs appellent des API payantes, facturées sur les clés fournies. Ordres de
grandeur pour `gpt-image-2` en 1024×1024 : `quality: low` ≈ $0,006, `medium` ≈ $0,05,
`high` ≈ $0,21. La skill `filigrane` ne coûte rien.
