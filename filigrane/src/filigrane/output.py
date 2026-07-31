"""Calcul du chemin de sortie, garde-fous non-destructifs, écriture atomique."""

import os
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from filigrane.errors import DestinationExists, SourceIsDestination


def output_path(
    source: Path, suffix: str, output_dir: Path | None, to_pdf: bool
) -> Path:
    ext = ".pdf" if to_pdf else source.suffix
    parent = output_dir if output_dir is not None else source.parent
    return parent / f"{source.stem}{suffix}{ext}"


def guard_destination(source: Path, dest: Path, force: bool) -> None:
    if dest.resolve() == source.resolve():
        raise SourceIsDestination(f"la sortie serait la source: {dest}")
    if dest.exists() and not force:
        raise DestinationExists(f"existe déjà (utilise --force): {dest}")


@contextmanager
def atomic_output(dest: Path) -> Iterator[Path]:
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_name(dest.name + ".tmp")
    try:
        yield tmp
        os.replace(tmp, dest)
    except BaseException:
        if tmp.exists():
            tmp.unlink()
        raise
