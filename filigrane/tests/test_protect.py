import io

import pytest
from pypdf import PdfReader, PdfWriter
from pypdf.constants import UserAccessPermissions as UAP

from filigrane.protect import (
    RESTRICTED_PERMISSIONS,
    ProtectionMode,
    ProtectionSpec,
    apply_protection,
    generate_password,
)


def _one_page_writer() -> PdfWriter:
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    return writer


def _written(writer: PdfWriter) -> bytes:
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def test_generate_password_is_urlsafe_and_long():
    pwd = generate_password()
    assert len(pwd) >= 16
    assert all(c.isalnum() or c in "-_" for c in pwd)
    assert generate_password() != generate_password()


def test_restricted_permissions_block_editing_keep_print():
    assert not (RESTRICTED_PERMISSIONS & UAP.MODIFY)
    assert not (RESTRICTED_PERMISSIONS & UAP.ADD_OR_MODIFY)
    assert not (RESTRICTED_PERMISSIONS & UAP.ASSEMBLE_DOC)
    assert RESTRICTED_PERMISSIONS & UAP.PRINT


def test_restrict_opens_without_password():
    writer = _one_page_writer()
    pwd = apply_protection(writer, ProtectionSpec(ProtectionMode.RESTRICT, "ownerpw"))
    assert pwd == "ownerpw"
    reader = PdfReader(io.BytesIO(_written(writer)))
    assert reader.is_encrypted
    assert len(reader.pages) == 1  # lisible sans mot de passe


def test_restrict_generates_password_when_absent():
    writer = _one_page_writer()
    pwd = apply_protection(writer, ProtectionSpec(ProtectionMode.RESTRICT, None))
    assert len(pwd) >= 16


def test_lock_requires_password():
    writer = _one_page_writer()
    pwd = apply_protection(writer, ProtectionSpec(ProtectionMode.LOCK, "secretpw"))
    assert pwd == "secretpw"
    data = _written(writer)
    assert PdfReader(io.BytesIO(data)).is_encrypted
    # bon mot de passe -> accès
    reader_ok = PdfReader(io.BytesIO(data), password="secretpw")
    assert len(reader_ok.pages) == 1
    # mot de passe vide -> contenu inaccessible
    reader_no = PdfReader(io.BytesIO(data))
    assert reader_no.is_encrypted
    with pytest.raises(Exception):
        _ = reader_no.pages[0].extract_text()
