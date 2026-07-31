---
name: filigrane
description: "Appose un filigrane texte tuilé en diagonale sur une image ou un PDF, sans jamais modifier la source. Triggers: filigraner ou watermarker un fichier, tamponner CONFIDENTIEL / BROUILLON / NE PAS DIFFUSER sur un document, marquer une image ou un diagramme avant de l'envoyer, protéger un PDF par mot de passe, régler l'opacité / la couleur / l'angle / la densité d'un filigrane. À utiliser dès qu'il s'agit de marquer ou de protéger un document avant diffusion, même si le mot « filigrane » n'est pas prononcé."
user-invocable: true
---

# Filigrane

Appose un filigrane texte **tuilé en diagonale** sur des images (PNG/JPG/TIFF/WebP/HEIC)
et des PDF. Deux propriétés structurent tout le reste :

- **La source n'est jamais modifiée.** La sortie est une copie, écrite à côté de l'original
  avec le suffixe `_filigrane`. Rien à annuler si le résultat ne convient pas.
- **Le PDF n'est pas rasterisé.** Le filigrane est une surimpression vectorielle : le texte
  d'origine reste sélectionnable et extractible, le poids du fichier bouge à peine.

---

## Invocation

Le moteur est un script Python embarqué dans cette skill, exécuté par `uv`, qui résout
ses dépendances tout seul au premier appel (~6 s la première fois, ~0,7 s ensuite).
Aucune installation préalable n'est nécessaire.

Avant le premier appel, pose ces deux repères :

```bash
# Chemin absolu du dossier qui contient le SKILL.md que tu viens de lire.
# L'outil Read te l'a donné : recopie-le tel quel, ne le devine pas.
SKILL_DIR="<chemin absolu du dossier de ce SKILL.md>"

command -v uv >/dev/null 2>&1 || {
  echo "uv est requis : brew install uv (ou https://docs.astral.sh/uv/)" >&2; exit 1; }
[ -f "$SKILL_DIR/scripts/filigrane.py" ] || {
  echo "script introuvable sous SKILL_DIR=$SKILL_DIR" >&2; exit 1; }
```

Puis, pour chaque traitement :

```bash
uv run --script "$SKILL_DIR/scripts/filigrane.py" <fichiers...> --text "CONFIDENTIEL"
```

Plusieurs fichiers peuvent être passés d'un coup, images et PDF mélangés : chacun est
traité selon son type et un échec isolé n'interrompt pas les autres.

---

## Défauts à appliquer sans demander

Si Romain ne précise aucune option, **ne pose pas de question** : le but est qu'un
filigrane parte en un tour. Applique ces défauts, il corrigera s'il veut autre chose.

| Source | Options |
|---|---|
| PDF | `--text "CONFIDENTIEL" --protect restrict` |
| Image | `--text "CONFIDENTIEL" --image-output native` |

Le reste (opacité 0,30, gris `#888888`, angle 45°, densité normale) tient la route sur
la grande majorité des documents. Ne t'en écarte que sur demande, ou si un premier rendu
est manifestement illisible.

**Ne passe pas `--size` si Romain n'a pas donné de taille.** Le moteur la déduit des
dimensions du document, de sorte que le filigrane occupe la même proportion sur une
vignette, sur un 1024 px et sur un export 4K. Une taille figée serait lisible sur l'un
et réduite à une texture sur l'autre. Tu n'as donc rien à mesurer en amont.

Termine toujours en annonçant le chemin réel du fichier produit, dans le style des
autres outils du plugin :

```
📁 Saved to: /chemin/absolu/document_filigrane.pdf
```

---

## Options

| Option | Défaut | Rôle |
|---|---|---|
| `--text` | (requis) | Texte du filigrane |
| `--opacity` | `0.30` | Opacité dans [0, 1] |
| `--color` | `#888888` | Couleur hex `#rrggbb` |
| `--size` | auto | Taille de police ; déduite des dimensions du document si omise |
| `--angle` | `45` | Angle de rotation |
| `--density` | `normal` | `sparse` \| `normal` \| `dense` |
| `--image-output` | `native` | `native` (même format) ou `pdf` |
| `--output-dir` | (à côté de la source) | Dossier de sortie |
| `--suffix` | `_filigrane` | Suffixe du nom de sortie |
| `--force` | `false` | Écraser une sortie existante |
| `--protect` | (aucune) | `restrict` ou `lock` — **PDF uniquement** |
| `--password` | (généré) | Mot de passe de protection |
| `--ask-password` | `false` | Saisie masquée, avec confirmation |

---

## Protection PDF : dire la vérité sur ce qu'elle vaut

Le mot de passe (fourni ou généré) est affiché en fin de run. Transmets-le à Romain,
et sois exact sur ce qu'il protège :

- **`restrict`** = ralentisseur. Le PDF s'ouvre sans mot de passe ; édition, annotation
  et assemblage sont marqués interdits. Un initié les retire en une commande
  (`qpdf --decrypt`). Ça écarte le grand public, pas quelqu'un de déterminé.
- **`lock`** = vrai verrou. Le contenu est chiffré en AES-256 et le mot de passe est
  exigé à l'ouverture. C'est le seul mode qui protège réellement, et il faut donc
  transmettre le mot de passe au destinataire par un autre canal.

Ne présente jamais `restrict` comme une protection réelle : Romain envoie ces documents
à des ministères et à des clients, une fausse assurance sur ce point coûterait cher.

Pour un envoi sensible, propose `lock` avec `--ask-password` (saisie masquée) plutôt
qu'un mot de passe en clair dans la ligne de commande, qui finirait dans l'historique
du shell.

---

## En bout de chaîne

Cette skill s'applique à un fichier déjà produit, quel qu'en soit l'auteur :

```
nanobanana / gpt  →  assets/schema.png    →  filigrane  →  assets/schema_filigrane.png
génération PDF    →  docs/specs.pdf       →  filigrane  →  docs/specs_filigrane.pdf
```

Après une génération d'image, attends la validation de Romain avant de filigraner :
filigraner une image qu'il va rejeter ne sert à rien, et la sortie occuperait le dossier
sans raison.

Quand plusieurs fichiers d'un même lot doivent être marqués, un seul appel suffit — c'est
plus rapide et le rendu reste identique d'un fichier à l'autre.

---

## Erreurs et cas limites

| Situation | Ce qui se passe |
|---|---|
| `--protect` sur une image | Erreur : la protection ne vise que les PDF |
| Sortie déjà existante | Erreur ; ajouter `--force` pour écraser |
| `--password` sans `--protect` | Ignoré, avertissement sur stderr |
| PDF d'entrée déjà chiffré | Non traité |
| Sortie = source | Refusé : la source ne peut pas être écrasée |
| Fichier ni image ni PDF | Format non supporté |

Le type est déduit du contenu, pas de l'extension : un `.png` qui contient en réalité du
JPEG est traité correctement.

---

## Limites connues

- Le filigrane est **cosmétique sur une image** : rien n'empêche de le retirer par
  retouche. Sur un PDF, seul `lock` oppose une résistance réelle.
- Le HEIC est lu et écrit, mais la sortie repasse en RGB (pas de canal alpha).
- Une police unique est embarquée (Inter). Les alphabets non latins ne rendront pas.
