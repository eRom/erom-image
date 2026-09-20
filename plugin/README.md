# erom-image

![erom-image](assets/erom-image.png)


Atelier image et document : deux serveurs MCP de génération d'images, une skill de
filigrane qui marque le résultat avant diffusion, et une skill de QR-Code.

## Génération

| Serveur | Modèle | Points forts |
|---|---|---|
| `nanobanana` | Gemini (nano-banana-2 / pro) | images, icônes multi-tailles, diagrammes techniques, itération rapide |
| `gpt` | OpenAI `gpt-image-2.5` (flare / sunburst) | texte exact dans l'image, maquettes UI, fond transparent, composition multi-images, édition haute fidélité |

## Filigrane

La skill `filigrane` appose un filigrane texte tuilé en diagonale sur une **image** ou un
**PDF**, quelle qu'en soit l'origine. La source n'est jamais modifiée : la sortie est une
copie suffixée `_filigrane`. Sur un PDF, la surimpression est vectorielle, donc le texte
d'origine reste extractible et le poids bouge à peine.

Elle sait aussi chiffrer le PDF produit : `restrict` (lecture libre, édition bloquée -
un ralentisseur, pas un verrou) ou `lock` (AES-256, mot de passe exigé à l'ouverture).

Aucune API, aucune clé, aucun coût : tout s'exécute en local.

## QR-Code

La skill `qrcode` produit un QR-Code en PNG ou en SVG (page web, flyer, carte de visite,
wifi, vCard) et relit un QR existant sur une image ou une capture.

Sa particularité est le garde-fou : le symbole est décodé **avant** que le fichier soit
écrit, et sa charge utile comparée à ce qui était demandé. Un QR qui ne se relit pas ne
laisse rien sur le disque. Elle refuse aussi les Micro QR, que `segno` produit tout seul
sur un contenu court et que la plupart des caméras de téléphone ne lisent pas.

Local également : ni API, ni clé, ni coût.

## Prérequis

- `node` ≥ 18 — les serveurs MCP sont distribués sous forme de bundles autonomes
- `uv` pour les skills `filigrane` et `qrcode` ([installation](https://docs.astral.sh/uv/)) :
  elles résolvent leurs dépendances Python toutes seules au premier appel
- `GEMINI_API_KEY` dans l'environnement, pour le serveur nanobanana
- `OPENAI_API_KEY` dans l'environnement, pour le serveur `gpt`

Chaque composant est indépendant : une seule des deux clés suffit pour le serveur
correspondant, et le filigrane comme le QR-Code fonctionnent sans aucune des deux.

## Installation

```bash
/plugin marketplace add eRom/erom-marketplace
/plugin install erom-image@erom-marketplace
```

## Outils exposés

- `gpt_image_generate`, `gpt_image_edit`
- `nanobanana_generate`, `nanobanana_edit`, `nanobanana_icon`, `nanobanana_diagram`

Les skills `gpt` et `nanobanana` décrivent quand utiliser lequel et comment rédiger les
prompts ; les skills `filigrane` et `qrcode` prennent le relais en bout de chaîne, sans
serveur MCP ni tool exposé.

## Coûts

Les deux serveurs appellent des API payantes, facturées sur les clés fournies. Ordres de
grandeur en 1024×1024, même tarif au token pour `gpt-image-2` et `gpt-image-2.5` :
`quality: low` ≈ $0,006, `medium` ≈ $0,05, `high` ≈ $0,21 ; `xhigh` et `max` (2.5 uniquement)
ne sont pas encore chiffrés. Les skills `filigrane` et `qrcode` ne coûtent rien.
