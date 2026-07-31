import pytest

from filigrane.detect import detect_kind
from filigrane.errors import UnsupportedFormat


def test_detects_pdf(example_pdf):
    assert detect_kind(example_pdf) == "pdf"


def test_detects_png(example_png):
    assert detect_kind(example_png) == "image"


def test_detects_jpeg(tmp_path):
    p = tmp_path / "x.jpg"
    p.write_bytes(b"\xff\xd8\xff\xe0" + b"\x00" * 16)
    assert detect_kind(p) == "image"


def test_detects_heic(tmp_path):
    p = tmp_path / "x.heic"
    p.write_bytes(b"\x00\x00\x00\x18ftypheic" + b"\x00" * 8)
    assert detect_kind(p) == "image"


def test_rejects_unknown(tmp_path):
    p = tmp_path / "x.txt"
    p.write_bytes(b"hello world this is plain text")
    with pytest.raises(UnsupportedFormat):
        detect_kind(p)
