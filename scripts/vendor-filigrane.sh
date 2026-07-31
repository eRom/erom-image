#!/usr/bin/env bash
# Régénère l'artefact distribué de la skill filigrane depuis le sous-projet `filigrane/`.
#
# Pendant Python de `bun build` pour les serveurs TypeScript, et même raison d'être :
# le cache d'installation d'un plugin n'a ni environnement virtuel ni étape de build.
# L'entrypoint PEP 723 embarque donc ses dépendances dans son en-tête, et `uv` les
# résout à la volée au premier appel.
#
# L'en-tête est *dérivé* de filigrane/pyproject.toml : les dépendances distribuées
# sont exactement celles contre lesquelles la suite de tests s'exécute.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/filigrane"
DST="$ROOT/plugin/skills/filigrane/scripts"

command -v uv >/dev/null 2>&1 || { echo "erreur: uv est requis" >&2; exit 1; }
command -v rsync >/dev/null 2>&1 || { echo "erreur: rsync est requis" >&2; exit 1; }
[ -f "$SRC/pyproject.toml" ] || { echo "erreur: source introuvable: $SRC" >&2; exit 1; }

# Garde-fou avant un rsync --delete : la cible doit être vierge ou être bien
# l'artefact généré, jamais un répertoire quelconque.
if [ -e "$DST/filigrane" ] && [ ! -f "$DST/filigrane/cli.py" ]; then
  echo "erreur: $DST/filigrane existe mais ne ressemble pas à l'artefact généré" >&2
  exit 1
fi

mkdir -p "$DST"
# --delete-excluded : sans lui, les __pycache__ créés à l'exécution depuis le layout
# distribué survivraient au vendoring (rsync protège les exclusions de --delete).
rsync -a --delete --delete-excluded --exclude '__pycache__' "$SRC/src/filigrane/" "$DST/filigrane/"

uv run --no-project --quiet python - "$SRC/pyproject.toml" "$DST/filigrane.py" <<'PY'
import sys
import tomllib
from pathlib import Path

pyproject, target = Path(sys.argv[1]), Path(sys.argv[2])
project = tomllib.loads(pyproject.read_text(encoding="utf-8"))["project"]

deps = "\n".join(f'#     "{d}",' for d in project["dependencies"])
target.write_text(
    f'''# /// script
# requires-python = "{project["requires-python"]}"
# dependencies = [
{deps}
# ]
# ///
"""Entrypoint autonome de la skill filigrane.

FICHIER GÉNÉRÉ par scripts/vendor-filigrane.sh — ne pas éditer à la main.
La source vit dans filigrane/ à la racine du dépôt.

`uv run --script` résout les dépendances de l'en-tête ci-dessus dans un
environnement éphémère mis en cache, ce qui évite toute installation préalable :
le paquet voisin filigrane/ est simplement ajouté au chemin d'import.
"""

import sys
from pathlib import Path

_HERE = Path(__file__).resolve().parent

if not (_HERE / "filigrane" / "cli.py").exists():
    sys.exit(
        f"filigrane: paquet introuvable dans {{_HERE}}. "
        "L'installation du plugin est incomplète."
    )

sys.path.insert(0, str(_HERE))

from filigrane.cli import run

run()
''',
    encoding="utf-8",
)
print(f"entrypoint généré : {target}")
PY

echo "paquet vendoré    : $DST/filigrane/ ($(du -sh "$DST/filigrane" | cut -f1))"
