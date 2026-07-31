"""Spécification d'apparence du filigrane + parsing couleur/police."""

from dataclasses import dataclass
from pathlib import Path

from filigrane.tiling import DENSITY_GAP, auto_size

_ASSET_FONT = Path(__file__).parent / "assets" / "Inter-Regular.ttf"


def _parse_hex(hex_color: str) -> tuple[int, int, int]:
    s = hex_color.lstrip("#")
    if len(s) != 6:
        raise ValueError(f"couleur hex invalide: {hex_color!r} (attendu #rrggbb)")
    return int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16)


def hex_to_rgb255(hex_color: str) -> tuple[int, int, int]:
    return _parse_hex(hex_color)


def hex_to_rgb01(hex_color: str) -> tuple[float, float, float]:
    r, g, b = _parse_hex(hex_color)
    return (r / 255, g / 255, b / 255)


@dataclass(frozen=True)
class WatermarkSpec:
    text: str
    opacity: float = 0.30
    color: str = "#888888"
    size: int | None = None  # None : déduite des dimensions du support
    angle: int = 45
    density: str = "normal"
    font_path: Path | None = None

    def __post_init__(self) -> None:
        if not self.text:
            raise ValueError("le texte du filigrane ne peut pas être vide")
        if not 0.0 <= self.opacity <= 1.0:
            raise ValueError("opacity doit être dans [0, 1]")
        if self.size is not None and self.size <= 0:
            raise ValueError("size doit être > 0")
        if self.density not in DENSITY_GAP:
            raise ValueError(f"densité inconnue: {self.density!r}")
        _parse_hex(self.color)  # valide la couleur


def resolved_font(spec: WatermarkSpec) -> Path:
    return spec.font_path if spec.font_path is not None else _ASSET_FONT


def resolved_size(spec: WatermarkSpec, width: float, height: float, medium: str) -> int:
    """Taille explicite si l'utilisateur en a donné une, sinon celle du support.

    Laisser le moteur décider évite d'avoir à mesurer le document en amont, et rend
    le filigrane aussi lisible sur une vignette que sur un export 4K.
    """
    if spec.size is not None:
        return spec.size
    return auto_size(width, height, medium)
