"""Détection du type de fichier par magic bytes (extension non fiable)."""

from pathlib import Path

from filigrane.errors import UnsupportedFormat


def detect_kind(path: Path) -> str:
    head = path.read_bytes()[:32]
    if head[:4] == b"%PDF":
        return "pdf"
    if head[:8] == b"\x89PNG\r\n\x1a\n":
        return "image"
    if head[:3] == b"\xff\xd8\xff":
        return "image"
    if head[:4] in (b"II*\x00", b"MM\x00*"):
        return "image"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image"
    if head[4:8] == b"ftyp":  # HEIC / HEIF / AVIF (boîte ftyp ISO-BMFF)
        return "image"
    raise UnsupportedFormat(f"format non supporté: {path}")
