from PIL import Image, ImageChops

from filigrane.config import WatermarkSpec
from filigrane.image_watermark import (
    apply_watermark,
    build_watermark_layer,
    process_image,
)


def test_layer_size_and_mode():
    spec = WatermarkSpec(text="TEST")
    layer = build_watermark_layer((400, 300), spec)
    assert layer.size == (400, 300)
    assert layer.mode == "RGBA"


def test_layer_has_visible_pixels():
    spec = WatermarkSpec(text="TEST", density="dense")
    layer = build_watermark_layer((400, 300), spec)
    assert layer.getbbox() is not None  # au moins un pixel non transparent


def test_layer_uses_the_resolved_size():
    """Sur une grande image, la taille automatique doit produire un rendu différent
    de l'ancien défaut figé. Si le moteur ignorait `resolved_size`, les deux calques
    seraient identiques.

    Mesurer le taux d'encrage ne servirait à rien : le tuilage compense une police
    plus petite par davantage de répétitions, et la proportion encrée reste la même
    dans les deux régimes. C'est la taille des glyphes qui change, pas la densité.
    """
    auto = build_watermark_layer((2048, 2048), WatermarkSpec(text="CONFIDENTIEL"))
    figee = build_watermark_layer(
        (2048, 2048), WatermarkSpec(text="CONFIDENTIEL", size=24)
    )
    assert ImageChops.difference(auto, figee).getbbox(alpha_only=False) is not None


def test_apply_preserves_size_and_alpha(example_png):
    spec = WatermarkSpec(text="CONFIDENTIEL")
    src = Image.open(example_png)
    out = apply_watermark(src, spec)
    assert out.size == src.size
    assert out.mode == "RGBA"  # le PNG d'exemple a un canal alpha


def test_apply_changes_pixels(example_png):
    spec = WatermarkSpec(text="CONFIDENTIEL", density="dense")
    src = Image.open(example_png).convert("RGBA")
    out = apply_watermark(src, spec).convert("RGBA")
    diff = ImageChops.difference(src, out)
    # alpha_only=False est indispensable : depuis Pillow 10, getbbox() ne regarde
    # que le canal alpha par défaut. Sur une source opaque, le filigrane change les
    # couleurs sans toucher l'alpha, et le test passerait à côté.
    assert diff.getbbox(alpha_only=False) is not None


def test_process_image_native_png(example_png, tmp_path):
    spec = WatermarkSpec(text="CONFIDENTIEL")
    dest = tmp_path / "out.png"
    process_image(example_png, spec, dest, as_pdf=False)
    assert dest.exists()
    out = Image.open(dest)
    assert out.format == "PNG"
    assert out.size == Image.open(example_png).size


def test_process_image_deterministic(example_png, tmp_path):
    spec = WatermarkSpec(text="CONFIDENTIEL")
    d1 = tmp_path / "a.png"
    d2 = tmp_path / "b.png"
    process_image(example_png, spec, d1, as_pdf=False)
    process_image(example_png, spec, d2, as_pdf=False)
    assert d1.read_bytes() == d2.read_bytes()


def test_process_image_as_pdf(example_png, tmp_path):
    spec = WatermarkSpec(text="CONFIDENTIEL")
    dest = tmp_path / "out.pdf"
    process_image(example_png, spec, dest, as_pdf=True)
    assert dest.read_bytes()[:4] == b"%PDF"
