class FiligraneError(Exception):
    """Erreur métier de l'outil filigrane."""


class UnsupportedFormat(FiligraneError):
    """Le fichier n'est ni une image supportée ni un PDF."""


class EncryptedPdf(FiligraneError):
    """Le PDF est chiffré et ne peut pas être traité."""


class DestinationExists(FiligraneError):
    """La sortie existe déjà et --force n'a pas été fourni."""


class SourceIsDestination(FiligraneError):
    """Le chemin de sortie calculé est identique à la source."""


class ProtectionNotSupported(FiligraneError):
    """--protect demandé sur une source non-PDF."""
