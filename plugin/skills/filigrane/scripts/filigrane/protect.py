"""Protection des PDF de sortie par chiffrement (pypdf / AES-256)."""

import secrets
from dataclasses import dataclass
from enum import Enum

from pypdf import PdfWriter
from pypdf.constants import UserAccessPermissions as UAP

_ALGORITHM = "AES-256"  # robuste ; le chiffré n'est pas déterministe (IV CBC aléatoire)

# Tout permis, moins ce qui permet d'éditer / retirer le filigrane.
RESTRICTED_PERMISSIONS = (
    UAP(-1) & ~UAP.MODIFY & ~UAP.ADD_OR_MODIFY & ~UAP.ASSEMBLE_DOC
)


class ProtectionMode(str, Enum):
    RESTRICT = "restrict"  # ouverture libre, édition interdite (owner password)
    LOCK = "lock"          # ouverture exige le mot de passe (user password)


@dataclass(frozen=True)
class ProtectionSpec:
    mode: ProtectionMode
    password: str | None = None


def generate_password() -> str:
    return secrets.token_urlsafe(12)


def apply_protection(writer: PdfWriter, spec: ProtectionSpec) -> str:
    """Chiffre `writer` selon `spec`, renvoie le mot de passe effectif."""
    password = spec.password or generate_password()
    if spec.mode is ProtectionMode.RESTRICT:
        writer.encrypt(
            user_password="",
            owner_password=password,
            algorithm=_ALGORITHM,
            permissions_flag=RESTRICTED_PERMISSIONS,
        )
    else:  # ProtectionMode.LOCK
        writer.encrypt(
            user_password=password,
            owner_password=password,
            algorithm=_ALGORITHM,
            permissions_flag=RESTRICTED_PERMISSIONS,
        )
    return password
