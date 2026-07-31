from pathlib import Path

import pytest

from filigrane.errors import DestinationExists, SourceIsDestination
from filigrane.output import atomic_output, guard_destination, output_path


def test_output_path_image_native(tmp_path):
    src = tmp_path / "photo.png"
    dest = output_path(src, "_filigrane", None, to_pdf=False)
    assert dest == tmp_path / "photo_filigrane.png"


def test_output_path_to_pdf(tmp_path):
    src = tmp_path / "photo.png"
    dest = output_path(src, "_filigrane", None, to_pdf=True)
    assert dest == tmp_path / "photo_filigrane.pdf"


def test_output_path_custom_dir(tmp_path):
    src = tmp_path / "a.pdf"
    out = tmp_path / "out"
    dest = output_path(src, "_wm", out, to_pdf=True)
    assert dest == out / "a_wm.pdf"


def test_guard_rejects_source_equals_dest(tmp_path):
    src = tmp_path / "a.png"
    with pytest.raises(SourceIsDestination):
        guard_destination(src, src, force=False)


def test_guard_rejects_existing_without_force(tmp_path):
    src = tmp_path / "a.png"
    dest = tmp_path / "a_filigrane.png"
    dest.write_bytes(b"x")
    with pytest.raises(DestinationExists):
        guard_destination(src, dest, force=False)


def test_guard_allows_existing_with_force(tmp_path):
    src = tmp_path / "a.png"
    dest = tmp_path / "a_filigrane.png"
    dest.write_bytes(b"x")
    guard_destination(src, dest, force=True)  # ne lève pas


def test_atomic_output_writes_and_cleans(tmp_path):
    dest = tmp_path / "out.bin"
    with atomic_output(dest) as tmp:
        Path(tmp).write_bytes(b"hello")
        assert dest.exists() is False  # pas encore renommé
    assert dest.read_bytes() == b"hello"
    assert list(tmp_path.glob("*.tmp")) == []


def test_atomic_output_no_partial_on_error(tmp_path):
    dest = tmp_path / "out.bin"
    with pytest.raises(RuntimeError):
        with atomic_output(dest) as tmp:
            Path(tmp).write_bytes(b"partial")
            raise RuntimeError("boom")
    assert dest.exists() is False
    assert list(tmp_path.glob("*.tmp")) == []
