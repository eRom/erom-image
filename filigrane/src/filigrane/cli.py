"""CLI typer : orchestration multi-fichiers, codes de sortie."""

from pathlib import Path

import typer

from filigrane.config import WatermarkSpec
from filigrane.detect import detect_kind
from filigrane.errors import FiligraneError, ProtectionNotSupported, UnsupportedFormat
from filigrane.image_watermark import process_image
from filigrane.output import guard_destination, output_path
from filigrane.pdf_watermark import process_pdf
from filigrane.protect import ProtectionMode, ProtectionSpec

app = typer.Typer(add_completion=False, help="Filigrane non-destructif image/PDF.")


def _protection_line(mode: ProtectionMode, password: str) -> str:
    if mode is ProtectionMode.RESTRICT:
        return f"    protection: restrict | lecture libre, édition bloquée | owner={password}"
    return f"    protection: lock | mot de passe d'ouverture: {password} (à transmettre)"


def run_one(
    path: Path,
    spec: WatermarkSpec,
    *,
    image_output: str,
    output_dir: Path | None,
    suffix: str,
    force: bool,
    protection: ProtectionSpec | None = None,
) -> tuple[Path, str | None]:
    if not path.exists():
        raise UnsupportedFormat(f"introuvable: {path}")
    kind = detect_kind(path)
    if protection is not None and kind != "pdf":
        raise ProtectionNotSupported(
            f"--protect est réservé aux PDF (source: {kind}): {path}"
        )
    to_pdf = kind == "pdf" or (kind == "image" and image_output == "pdf")
    dest = output_path(path, suffix, output_dir, to_pdf=to_pdf)
    guard_destination(path, dest, force)
    if kind == "pdf":
        password = process_pdf(path, spec, dest, protection)
    else:
        process_image(path, spec, dest, as_pdf=(image_output == "pdf"))
        password = None
    return dest, password


@app.command()
def main(
    files: list[Path] = typer.Argument(..., help="Fichiers à filigraner."),
    text: str = typer.Option(..., "--text", help="Texte du filigrane."),
    opacity: float = typer.Option(0.30, "--opacity"),
    color: str = typer.Option("#888888", "--color"),
    size: int | None = typer.Option(
        None, "--size", help="Taille de police ; déduite des dimensions du document si omise."
    ),
    angle: int = typer.Option(45, "--angle"),
    density: str = typer.Option("normal", "--density"),
    image_output: str = typer.Option("native", "--image-output"),
    output_dir: Path | None = typer.Option(None, "--output-dir"),
    suffix: str = typer.Option("_filigrane", "--suffix"),
    force: bool = typer.Option(False, "--force"),
    protect: ProtectionMode | None = typer.Option(
        None, "--protect", help="Chiffre la sortie PDF : restrict (édition bloquée) ou lock (ouverture verrouillée)."
    ),
    password: str | None = typer.Option(
        None, "--password", help="Mot de passe de protection (sinon généré aléatoirement)."
    ),
    ask_password: bool = typer.Option(
        False, "--ask-password", help="Saisir le mot de passe de protection de façon masquée (avec confirmation)."
    ),
) -> None:
    spec = WatermarkSpec(
        text=text,
        opacity=opacity,
        color=color,
        size=size,
        angle=angle,
        density=density,
    )
    if protect is None and (password is not None or ask_password):
        typer.echo("Avertissement: --password/--ask-password ignoré sans --protect.", err=True)
    if ask_password and protect is not None and password is None:
        password = typer.prompt(
            "Mot de passe de protection", hide_input=True, confirmation_prompt=True
        )
    protection = (
        ProtectionSpec(mode=protect, password=password) if protect is not None else None
    )
    failures = 0
    for path in files:
        try:
            dest, pwd = run_one(
                path,
                spec,
                image_output=image_output,
                output_dir=output_dir,
                suffix=suffix,
                force=force,
                protection=protection,
            )
            typer.echo(f"OK  {path} -> {dest}")
            if protection is not None and pwd is not None:
                typer.echo(_protection_line(protection.mode, pwd))
        except FiligraneError as exc:
            failures += 1
            typer.echo(f"ERREUR  {path}: {exc}", err=True)
    if failures:
        raise typer.Exit(code=1)


def run() -> None:
    app()
