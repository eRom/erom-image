from PIL import ImageFont
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


def test_font_loads_in_pillow(font_path):
    assert font_path.exists()
    font = ImageFont.truetype(str(font_path), 24)
    assert font.getlength("ABC") > 0


def test_font_loads_in_reportlab(font_path):
    pdfmetrics.registerFont(TTFont("InterTest", str(font_path)))
    assert pdfmetrics.stringWidth("ABC", "InterTest", 24) > 0
