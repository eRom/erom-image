# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "cryptography>=45.0.0",
#     "pillow>=11.0.0",
#     "pillow-heif>=1.0.0",
#     "pypdf>=6.0.0",
#     "reportlab>=4.0.0",
#     "typer>=0.15.0",
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
        f"filigrane: paquet introuvable dans {_HERE}. "
        "L'installation du plugin est incomplète."
    )

sys.path.insert(0, str(_HERE))

from filigrane.cli import run

run()
