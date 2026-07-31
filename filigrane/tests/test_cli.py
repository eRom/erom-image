import hashlib

from pypdf import PdfReader
from typer.testing import CliRunner

from filigrane.cli import app

runner = CliRunner()


def _sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_requires_text(example_png):
    result = runner.invoke(app, [str(example_png)])
    assert result.exit_code != 0


def test_missing_file_exits_nonzero(tmp_path):
    result = runner.invoke(
        app, [str(tmp_path / "nope.png"), "--text", "X"]
    )
    assert result.exit_code == 1


def test_happy_path_png(example_png, tmp_path):
    result = runner.invoke(
        app,
        [str(example_png), "--text", "CONFIDENTIEL", "--output-dir", str(tmp_path)],
    )
    assert result.exit_code == 0
    assert (tmp_path / f"{example_png.stem}_filigrane.png").exists()


def test_source_unchanged(example_png, tmp_path):
    before = _sha(example_png)
    runner.invoke(
        app,
        [str(example_png), "--text", "CONFIDENTIEL", "--output-dir", str(tmp_path)],
    )
    assert _sha(example_png) == before  # source non détruite


def test_image_output_pdf(example_png, tmp_path):
    result = runner.invoke(
        app,
        [
            str(example_png),
            "--text", "X",
            "--image-output", "pdf",
            "--output-dir", str(tmp_path),
        ],
    )
    assert result.exit_code == 0
    assert (tmp_path / f"{example_png.stem}_filigrane.pdf").exists()


def test_protect_restrict_pdf(example_pdf, tmp_path):
    result = runner.invoke(
        app,
        [
            str(example_pdf),
            "--text", "CONFIDENTIEL",
            "--protect", "restrict",
            "--password", "ownerpw",
            "--output-dir", str(tmp_path),
        ],
    )
    assert result.exit_code == 0
    out = tmp_path / f"{example_pdf.stem}_filigrane.pdf"
    assert out.exists()
    assert PdfReader(str(out)).is_encrypted
    assert "protection: restrict" in result.output
    assert "ownerpw" in result.output


def test_protect_lock_pdf(example_pdf, tmp_path):
    result = runner.invoke(
        app,
        [
            str(example_pdf),
            "--text", "CONFIDENTIEL",
            "--protect", "lock",
            "--password", "secretpw",
            "--output-dir", str(tmp_path),
        ],
    )
    assert result.exit_code == 0
    assert "mot de passe d'ouverture" in result.output


def test_protect_generates_password_when_absent(example_pdf, tmp_path):
    result = runner.invoke(
        app,
        [
            str(example_pdf),
            "--text", "CONFIDENTIEL",
            "--protect", "restrict",
            "--output-dir", str(tmp_path),
        ],
    )
    assert result.exit_code == 0
    assert "owner=" in result.output


def test_protect_rejects_image(example_png, tmp_path):
    result = runner.invoke(
        app,
        [
            str(example_png),
            "--text", "X",
            "--protect", "restrict",
            "--output-dir", str(tmp_path),
        ],
    )
    assert result.exit_code == 1


def test_password_without_protect_warns(example_pdf, tmp_path):
    result = runner.invoke(
        app,
        [str(example_pdf), "--text", "X", "--password", "z", "--output-dir", str(tmp_path)],
    )
    assert result.exit_code == 0
    assert "Avertissement" in result.stderr
    out = tmp_path / f"{example_pdf.stem}_filigrane.pdf"
    assert not PdfReader(str(out)).is_encrypted  # password ignoré


def test_ask_password_without_protect_warns(example_pdf, tmp_path):
    result = runner.invoke(
        app,
        [str(example_pdf), "--text", "X", "--ask-password", "--output-dir", str(tmp_path)],
    )
    assert result.exit_code == 0
    assert "Avertissement" in result.stderr


def test_ask_password_prompts_masked(example_pdf, tmp_path):
    result = runner.invoke(
        app,
        [
            str(example_pdf),
            "--text", "CONFIDENTIEL",
            "--protect", "lock",
            "--ask-password",
            "--output-dir", str(tmp_path),
        ],
        input="motdepasse\nmotdepasse\n",  # saisie + confirmation
    )
    assert result.exit_code == 0
    out = tmp_path / f"{example_pdf.stem}_filigrane.pdf"
    assert PdfReader(str(out)).is_encrypted
    assert len(PdfReader(str(out), password="motdepasse").pages) >= 1
