"""Géométrie pure du tuilage diagonal. Aucune I/O, déterministe."""

import math

DENSITY_GAP: dict[str, float] = {"sparse": 1.6, "normal": 0.9, "dense": 0.4}

# Une taille de police absolue ne veut rien dire d'un support à l'autre : 24 couvre
# 17 % de la largeur d'une image 1024 px, mais 4 % d'un export 4K, où le filigrane
# se réduit à une texture. La taille suit donc la diagonale du support.
#
# Les références sont choisies pour reproduire exactement l'ancien défaut de 24 sur
# les deux formats les plus courants, ce qui laisse le rendu inchangé là où il était
# déjà bon. Les unités diffèrent (pixels pour une image, points pour un PDF), d'où
# deux références distinctes.
REFERENCE_DIAGONAL: dict[str, float] = {
    "image": math.hypot(1024, 1024),      # image carrée de 1024 px
    "pdf": math.hypot(595.28, 841.89),    # page A4, en points
}
_REFERENCE_SIZE = 24
_MIN_SIZE = 8


def diagonal_extent(width: int, height: int) -> int:
    """Côté du calque carré qui couvre width×height même après rotation."""
    return math.ceil(math.hypot(width, height))


def auto_size(width: float, height: float, medium: str) -> int:
    """Taille de police proportionnelle à la diagonale du support."""
    if medium not in REFERENCE_DIAGONAL:
        raise ValueError(f"support inconnu: {medium!r}")
    ratio = math.hypot(width, height) / REFERENCE_DIAGONAL[medium]
    return max(_MIN_SIZE, round(_REFERENCE_SIZE * ratio))


def steps_for(text_w: float, text_h: float, density: str) -> tuple[float, float]:
    """Pas horizontal/vertical entre répétitions, selon la densité."""
    if density not in DENSITY_GAP:
        raise ValueError(f"densité inconnue: {density!r}")
    gap = DENSITY_GAP[density]
    step_x = text_w * (1 + gap)
    step_y = text_h * (1 + gap) * 3  # respiration verticale entre les lignes
    return (step_x, step_y)


def tile_positions(
    extent: int, step_x: float, step_y: float
) -> list[tuple[float, float]]:
    """Grille régulière de points dans [0, extent]², centrée et déterministe."""
    if step_x <= 0 or step_y <= 0:
        raise ValueError("les pas doivent être strictement positifs")
    positions: list[tuple[float, float]] = []
    y = step_y / 2
    while y < extent:
        x = step_x / 2
        while x < extent:
            positions.append((x, y))
            x += step_x
        y += step_y
    return positions
