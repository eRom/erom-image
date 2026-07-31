"""Fixtures générées à la volée : la suite ne dépend d'aucun binaire commité.

Les fixtures d'origine pointaient vers des documents personnels (`exemples/`) absents
du dépôt. Résultat : toute la moitié PDF de la suite échouait en `FileNotFoundError`
sans que rien ne le signale. Générer les documents ici rend la suite autoportante et
reproductible sur n'importe quelle machine.

Le texte du PDF est volontairement en ASCII : `extract_text()` doit pouvoir le
comparer caractère pour caractère, et les accents introduiraient une variabilité
d'encodage sans rien tester de plus.
"""

from pathlib import Path

import pytest
from PIL import Image, ImageDraw
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parent.parent
FONT = ROOT / "src" / "filigrane" / "assets" / "Inter-Regular.ttf"

# Deux pages : le nombre de pages fait partie de ce que les tests verifient.
# Les lignes sont assez longues pour que la comparaison sur 60 caracteres
# de test_original_text_preserved porte sur du contenu reel.
_PDF_PAGES = [
    [
        "Rapport d'exemple pour la suite de tests filigrane.",
        "Ce paragraphe existe pour verifier que le texte d'origine",
        "reste extractible apres la surimpression du filigrane.",
    ],
    [
        "Deuxieme page : le nombre de pages doit etre preserve.",
        "Le filigrane s'applique page par page, sans rasteriser.",
    ],
]


@pytest.fixture(scope="session")
def example_pdf(tmp_path_factory) -> Path:
    """PDF multi-pages au texte extractible."""
    path = tmp_path_factory.mktemp("fixtures") / "rapport exemple.pdf"
    pdf = canvas.Canvas(str(path), pagesize=A4, invariant=1)
    for lines in _PDF_PAGES:
        block = pdf.beginText(72, 760)
        block.setFont("Helvetica", 12)
        for line in lines:
            block.textLine(line)
        pdf.drawText(block)
        pdf.showPage()
    pdf.save()
    return path


@pytest.fixture(scope="session")
def example_png(tmp_path_factory) -> Path:
    """PNG avec canal alpha : la préservation du mode RGBA est testée."""
    path = tmp_path_factory.mktemp("fixtures") / "schema exemple.png"
    # Fond transparent, comme un export de diagramme : la composition doit gérer
    # une source dont l'alpha varie, pas seulement un aplat opaque.
    image = Image.new("RGBA", (640, 480), (255, 255, 255, 0))
    draw = ImageDraw.Draw(image)
    draw.rectangle((60, 60, 580, 200), fill=(230, 236, 245, 255),
                   outline=(40, 70, 120, 255), width=3)
    draw.rectangle((60, 260, 580, 420), fill=(245, 238, 230, 255),
                   outline=(120, 80, 40, 255), width=3)
    draw.line((320, 200, 320, 260), fill=(40, 70, 120, 255), width=3)
    image.save(path)
    return path


@pytest.fixture
def font_path() -> Path:
    return FONT
