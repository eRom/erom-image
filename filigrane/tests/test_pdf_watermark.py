import pytest

from pypdf import PdfReader

from filigrane.config import WatermarkSpec
from filigrane.pdf_watermark import build_overlay_pdf, process_pdf
from filigrane.protect import ProtectionMode, ProtectionSpec


def _text_of(path, n=3):
    reader = PdfReader(str(path))
    return "".join(p.extract_text() or "" for p in reader.pages[:n])


def test_overlay_is_pdf():
    spec = WatermarkSpec(text="CONFIDENTIEL")
    data = build_overlay_pdf((595.0, 842.0), spec)
    assert data[:4] == b"%PDF"


def test_overlay_uses_the_resolved_size():
    """Même garantie côté PDF : une page A0 ne doit pas recevoir la police d'une A4."""
    a0 = (2383.94, 3370.39)
    auto = build_overlay_pdf(a0, WatermarkSpec(text="CONFIDENTIEL"))
    figee = build_overlay_pdf(a0, WatermarkSpec(text="CONFIDENTIEL", size=24))
    assert auto != figee


def test_page_count_preserved(example_pdf, tmp_path):
    spec = WatermarkSpec(text="CONFIDENTIEL")
    dest = tmp_path / "out.pdf"
    process_pdf(example_pdf, spec, dest)
    assert len(PdfReader(str(dest)).pages) == len(PdfReader(str(example_pdf)).pages)


def test_original_text_preserved(example_pdf, tmp_path):
    """Preuve de non-rasterisation : le texte d'origine reste extractible."""
    spec = WatermarkSpec(text="CONFIDENTIEL")
    dest = tmp_path / "out.pdf"
    process_pdf(example_pdf, spec, dest)
    src_text = _text_of(example_pdf).strip()
    out_text = _text_of(dest)
    assert src_text != ""
    assert src_text[:60] in out_text


def test_watermark_text_present(example_pdf, tmp_path):
    spec = WatermarkSpec(text="ZZWATERMARKZZ")
    dest = tmp_path / "out.pdf"
    process_pdf(example_pdf, spec, dest)
    assert "ZZWATERMARKZZ" in _text_of(dest, n=1)


def test_size_does_not_explode(example_pdf, tmp_path):
    spec = WatermarkSpec(text="CONFIDENTIEL")
    dest = tmp_path / "out.pdf"
    process_pdf(example_pdf, spec, dest)
    assert dest.stat().st_size < 500_000


def test_pdf_deterministic(example_pdf, tmp_path):
    spec = WatermarkSpec(text="CONFIDENTIEL")
    d1 = tmp_path / "a.pdf"
    d2 = tmp_path / "b.pdf"
    process_pdf(example_pdf, spec, d1)
    process_pdf(example_pdf, spec, d2)
    assert d1.read_bytes() == d2.read_bytes()


def test_protect_restrict_encrypts_but_opens(example_pdf, tmp_path):
    spec = WatermarkSpec(text="CONFIDENTIEL")
    dest = tmp_path / "out.pdf"
    pwd = process_pdf(
        example_pdf, spec, dest, ProtectionSpec(ProtectionMode.RESTRICT, "ownerpw")
    )
    assert pwd == "ownerpw"
    reader = PdfReader(str(dest))
    assert reader.is_encrypted
    assert len(reader.pages) >= 1  # ouvre sans mot de passe


def test_protected_original_text_preserved(example_pdf, tmp_path):
    spec = WatermarkSpec(text="CONFIDENTIEL")
    dest = tmp_path / "out.pdf"
    process_pdf(
        example_pdf, spec, dest, ProtectionSpec(ProtectionMode.RESTRICT, "ownerpw")
    )
    src_text = _text_of(example_pdf).strip()
    out_text = _text_of(dest)  # restrict ouvre librement, extract_text marche
    assert src_text != ""
    assert src_text[:60] in out_text


def test_lock_wrong_password_rejected(example_pdf, tmp_path):
    spec = WatermarkSpec(text="CONFIDENTIEL")
    dest = tmp_path / "out.pdf"
    process_pdf(
        example_pdf, spec, dest, ProtectionSpec(ProtectionMode.LOCK, "secretpw")
    )
    with pytest.raises(Exception):
        PdfReader(str(dest), password="mauvais").pages[0].extract_text()


def test_lock_requires_password(example_pdf, tmp_path):
    spec = WatermarkSpec(text="CONFIDENTIEL")
    dest = tmp_path / "out.pdf"
    process_pdf(
        example_pdf, spec, dest, ProtectionSpec(ProtectionMode.LOCK, "secretpw")
    )
    assert PdfReader(str(dest)).is_encrypted
    reader_ok = PdfReader(str(dest), password="secretpw")
    assert len(reader_ok.pages) >= 1


def test_process_pdf_no_protection_returns_none(example_pdf, tmp_path):
    spec = WatermarkSpec(text="CONFIDENTIEL")
    dest = tmp_path / "out.pdf"
    assert process_pdf(example_pdf, spec, dest) is None
    assert not PdfReader(str(dest)).is_encrypted
