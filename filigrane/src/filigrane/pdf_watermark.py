"""Moteur PDF : surimpression vectorielle, contenu d'origine intact."""

import io
from pathlib import Path

from reportlab import rl_config
from reportlab.lib.colors import Color
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

from pypdf import PdfReader, PdfWriter
from pypdf.generic import ArrayObject, ByteStringObject

from filigrane.config import (
    WatermarkSpec,
    hex_to_rgb01,
    resolved_font,
    resolved_size,
)
from filigrane.errors import EncryptedPdf
from filigrane.output import atomic_output
from filigrane.protect import ProtectionSpec, apply_protection
from filigrane.tiling import diagonal_extent, steps_for, tile_positions

rl_config.invariant = 1  # reportlab : dates fixes, pas d'ID aléatoire

_FONT_NAME = "FiligraneFont"
_registered_fonts: set[str] = set()


def _ensure_font(path: Path) -> None:
    key = str(path)
    if key not in _registered_fonts:
        pdfmetrics.registerFont(TTFont(_FONT_NAME, key))
        _registered_fonts.add(key)


def build_overlay_pdf(
    page_size: tuple[float, float], spec: WatermarkSpec
) -> bytes:
    _ensure_font(resolved_font(spec))
    width, height = page_size
    font_size = resolved_size(spec, width, height, "pdf")
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(width, height), invariant=1)

    extent = diagonal_extent(int(width), int(height))
    text_w = pdfmetrics.stringWidth(spec.text, _FONT_NAME, font_size)
    step_x, step_y = steps_for(text_w, float(font_size), spec.density)
    r, g, b = hex_to_rgb01(spec.color)

    c.saveState()
    c.translate(width / 2, height / 2)
    c.rotate(spec.angle)
    c.translate(-extent / 2, -extent / 2)
    c.setFont(_FONT_NAME, font_size)
    c.setFillColor(Color(r, g, b, alpha=spec.opacity))
    for x, y in tile_positions(extent, step_x, step_y):
        c.drawString(x, y, spec.text)
    c.restoreState()

    c.showPage()
    c.save()
    return buf.getvalue()


def _make_deterministic(writer: PdfWriter) -> None:
    writer.add_metadata({"/Producer": "filigrane", "/Creator": "filigrane"})
    fixed = ByteStringObject(b"filigrane-deterministic-000001")
    writer._ID = ArrayObject([fixed, fixed])


def process_pdf(
    source: Path,
    spec: WatermarkSpec,
    dest: Path,
    protection: ProtectionSpec | None = None,
) -> str | None:
    reader = PdfReader(str(source))
    if reader.is_encrypted:
        raise EncryptedPdf(f"PDF chiffré, non traité: {source}")

    # clone_from rattache les pages au writer : merge_page devient fiable
    # et l'on peut recompresser chaque content stream fusionné.
    writer = PdfWriter(clone_from=reader)
    overlays: dict[tuple[float, float], object] = {}
    for page in writer.pages:
        size = (float(page.mediabox.width), float(page.mediabox.height))
        if size not in overlays:
            ov_reader = PdfReader(io.BytesIO(build_overlay_pdf(size, spec)))
            overlays[size] = ov_reader.pages[0]
        page.merge_page(overlays[size], over=True)
        page.compress_content_streams()  # recompresse le flux fusionné (zlib déterministe)

    writer.compress_identical_objects()  # déduplique la police répétée
    _make_deterministic(writer)
    password = apply_protection(writer, protection) if protection is not None else None
    with atomic_output(dest) as tmp:
        with open(tmp, "wb") as f:
            writer.write(f)
    return password
