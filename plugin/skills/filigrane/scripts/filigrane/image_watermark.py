"""Moteur image : compose un calque de filigrane sans dégrader la source."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps
from pillow_heif import register_heif_opener

from filigrane.config import (
    WatermarkSpec,
    hex_to_rgb255,
    resolved_font,
    resolved_size,
)
from filigrane.output import atomic_output
from filigrane.tiling import diagonal_extent, steps_for, tile_positions

register_heif_opener()  # active la lecture/écriture HEIC via Pillow


def build_watermark_layer(
    size: tuple[int, int], spec: WatermarkSpec
) -> Image.Image:
    width, height = size
    font_size = resolved_size(spec, width, height, "image")
    extent = diagonal_extent(width, height)
    layer = Image.new("RGBA", (extent, extent), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    font = ImageFont.truetype(str(resolved_font(spec)), font_size)

    bbox = draw.textbbox((0, 0), spec.text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    r, g, b = hex_to_rgb255(spec.color)
    alpha = round(spec.opacity * 255)
    step_x, step_y = steps_for(text_w, text_h, spec.density)

    for x, y in tile_positions(extent, step_x, step_y):
        draw.text((x, y), spec.text, font=font, fill=(r, g, b, alpha))

    rotated = layer.rotate(spec.angle, expand=True, resample=Image.BICUBIC)
    rw, rh = rotated.size
    left = (rw - width) // 2
    top = (rh - height) // 2
    return rotated.crop((left, top, left + width, top + height))


def apply_watermark(img: Image.Image, spec: WatermarkSpec) -> Image.Image:
    base = ImageOps.exif_transpose(img)  # respecte l'orientation EXIF
    original_mode = base.mode
    layer = build_watermark_layer(base.size, spec)
    composited = Image.alpha_composite(base.convert("RGBA"), layer)
    if original_mode == "RGBA":
        return composited
    return composited.convert("RGB" if original_mode != "L" else "L")


def _save(img: Image.Image, tmp: Path, dest: Path, as_pdf: bool) -> None:
    if as_pdf:
        img.convert("RGB").save(tmp, "PDF", resolution=150.0)
        return
    ext = dest.suffix.lower()
    if ext == ".png":
        img.save(tmp, "PNG")
    elif ext in (".jpg", ".jpeg"):
        img.convert("RGB").save(tmp, "JPEG", quality=95, subsampling="keep")
    elif ext == ".webp":
        img.save(tmp, "WEBP", lossless=True)
    elif ext in (".tif", ".tiff"):
        img.save(tmp, "TIFF", compression="tiff_lzw")
    elif ext in (".heic", ".heif"):
        img.convert("RGB").save(tmp, "HEIF", quality=95)
    else:
        img.save(tmp, "PNG")


def process_image(
    source: Path, spec: WatermarkSpec, dest: Path, as_pdf: bool
) -> None:
    with Image.open(source) as img:
        result = apply_watermark(img, spec)
    with atomic_output(dest) as tmp:
        _save(result, tmp, dest, as_pdf)
