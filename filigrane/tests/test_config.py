import pytest

from filigrane.config import (
    WatermarkSpec,
    hex_to_rgb01,
    hex_to_rgb255,
    resolved_font,
    resolved_size,
)


def test_resolved_size_honours_an_explicit_size():
    spec = WatermarkSpec(text="X", size=40)
    assert resolved_size(spec, 4096, 4096, "image") == 40


def test_resolved_size_falls_back_to_the_document_dimensions():
    spec = WatermarkSpec(text="X")
    assert spec.size is None
    assert resolved_size(spec, 1024, 1024, "image") == 24
    assert resolved_size(spec, 4096, 4096, "image") > 24


def test_rejects_explicit_size_of_zero():
    with pytest.raises(ValueError):
        WatermarkSpec(text="X", size=0)


def test_defaults():
    spec = WatermarkSpec(text="CONFIDENTIEL")
    assert spec.opacity == 0.30
    assert spec.color == "#888888"
    assert spec.angle == 45
    assert spec.density == "normal"


def test_hex_to_rgb255():
    assert hex_to_rgb255("#888888") == (136, 136, 136)
    assert hex_to_rgb255("000000") == (0, 0, 0)


def test_hex_to_rgb01():
    r, g, b = hex_to_rgb01("#ffffff")
    assert (r, g, b) == (1.0, 1.0, 1.0)


def test_hex_invalid_length():
    with pytest.raises(ValueError):
        hex_to_rgb255("#fff")


def test_rejects_empty_text():
    with pytest.raises(ValueError):
        WatermarkSpec(text="")


def test_rejects_bad_opacity():
    with pytest.raises(ValueError):
        WatermarkSpec(text="X", opacity=1.5)


def test_rejects_bad_density():
    with pytest.raises(ValueError):
        WatermarkSpec(text="X", density="ultra")


def test_resolved_font_defaults_to_asset():
    spec = WatermarkSpec(text="X")
    assert resolved_font(spec).name == "Inter-Regular.ttf"
    assert resolved_font(spec).exists()
