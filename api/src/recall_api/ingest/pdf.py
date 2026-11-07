"""Step 1: read the text of every page of a PDF.

Pages are numbered from 1 the way a PDF viewer numbers
them, so a page number here is exactly what a citation
will show (decision D4).

Some PDFs don't say which character a glyph is. Erickson's
chapters draw their old-style digits ("four.oldstyle"),
small capitals ("R.c2sc") and the "fi" ligature that way,
so every reader (PyMuPDF, pypdf, pdfminer) gets U+FFFF
there: "Lemma ?.?", "Greed clari?es". We recover them
from the font itself: find the glyph each unknown
character was drawn with, read that glyph's name inside
the embedded font, and turn the name into a character
with the Adobe Glyph List.
"""

import io
import re
import unicodedata
from dataclasses import dataclass

import pymupdf
from fontTools import agl
from fontTools.t1Lib import T1Font
from fontTools.ttLib import TTFont

MAX_PAGES = 2000  # same ceiling as documents.pages in the database

# TEXT_DEHYPHENATE joins words split across lines
# ("dyna-" + "mic" → "dynamic").
FLAGS = pymupdf.TEXTFLAGS_TEXT | pymupdf.TEXT_DEHYPHENATE


def is_unknown(c: str) -> bool:
    """True for "the PDF doesn't say which character this is":
    U+FFFF / U+FFFD, or the private-use area (U+E000–U+F8FF),
    which by definition has no agreed meaning."""
    return c in ("\uffff", "\ufffd") or 0xE000 <= ord(c) <= 0xF8FF


class PdfError(ValueError):
    """A file we refuse to ingest. The message is safe to show."""


@dataclass(frozen=True)
class Page:
    number: int  # 1, 2, 3… (viewer numbering)
    text: str  # cleaned text; "" for a page with no text layer
    unreadable: int = 0  # characters we couldn't recover (dropped)


def read_pdf(data: bytes) -> list[Page]:
    """Every page's text, in order. Raises PdfError for bad files."""
    # Check the first bytes, not the file name: a renamed
    # .docx is not a PDF (upload-edge-cases #2).
    if not data.startswith(b"%PDF-"):
        raise PdfError("This file isn't a PDF.")

    try:
        doc = pymupdf.open(stream=data, filetype="pdf")
    except Exception as error:  # PyMuPDF raises several kinds
        raise PdfError("This PDF couldn't be read.") from error

    with doc:
        if doc.needs_pass:
            raise PdfError("This PDF is password-protected.")
        if doc.page_count == 0:
            raise PdfError("This PDF has no pages.")
        if doc.page_count > MAX_PAGES:
            raise PdfError(f"This PDF has more than {MAX_PAGES} pages.")

        glyphs = GlyphNames(doc)
        pages = []
        for i, page in enumerate(doc):
            text, unreadable = page_text(page, glyphs)
            pages.append(Page(number=i + 1, text=clean_text(text), unreadable=unreadable))
        return pages


def page_text(page, glyphs: "GlyphNames") -> tuple[str, int]:
    """A page's text, with unknown characters recovered where possible.

    The text trace lists every character with the glyph
    and font it was drawn with; "rawdict" lists the same
    characters with positions, grouped into lines and
    blocks. Matching the two by position tells us which
    glyph an unknown character is. Returns the text and
    how many characters stayed unknown (and were dropped).
    """
    recovered = {}  # position → recovered text ("" = still unknown)
    for span in page.get_texttrace():
        chars = span["chars"]
        if not any(is_unknown(chr(u)) for u, *_ in chars):
            continue
        candidates = glyphs.candidates(page, span["font"])
        for unicode, glyph, origin, _bbox in chars:
            if is_unknown(chr(unicode)):
                recovered[_position(origin)] = glyphs.agreed_text(candidates, glyph)

    unreadable = 0
    blocks = []
    for block in page.get_text("rawdict", flags=FLAGS)["blocks"]:
        lines = []
        for line in block.get("lines", []):
            chars = []
            for span in line["spans"]:
                for char in span["chars"]:
                    c = char["c"]
                    if is_unknown(c):
                        c = recovered.get(_position(char["origin"]), "")
                        unreadable += c == ""
                    chars.append(c)
            lines.append("".join(chars))
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks), unreadable


def _position(origin) -> tuple[float, float]:
    return (round(origin[0], 1), round(origin[1], 1))


class GlyphNames:
    """Glyph id → character, read from the fonts embedded in the PDF.

    Each font is parsed at most once per document (parsing
    is the slow part), so this is shared by all pages.
    """

    def __init__(self, doc):
        self.doc = doc
        self.cache: dict[int, list[str] | None] = {}  # font xref → glyph names

    def candidates(self, page, font_name: str) -> list[list[str]]:
        """Every glyph-name list this run of text could be using.

        A page can embed the same font several times as
        different subsets ("ABCDEF+Roboto-Light",
        "GHIJKL+Roboto-Light"), each with its own glyph order,
        and the trace only gives the name. So we keep them all
        and only trust a glyph name they agree on (agreed_text).
        """
        lists = []
        for font in page.get_fonts():  # (xref, ext, type, basefont, name, encoding)
            xref, basefont = font[0], font[3]
            # The trace cuts long font names short
            # ("MathDesign-CH-Regular-It…"), so compare the start.
            if basefont.split("+")[-1].startswith(font_name):
                names = self._names(xref)
                if names:
                    lists.append(names)
        return lists

    @staticmethod
    def agreed_text(candidates: list[list[str]], glyph: int) -> str:
        """The glyph's character if every candidate agrees on it, else ""."""
        texts = {
            name_to_text(names[glyph])
            for names in candidates
            if 0 <= glyph < len(names) and names[glyph] != ".notdef"
        }
        return texts.pop() if len(texts) == 1 else ""

    def _names(self, xref: int) -> list[str] | None:
        if xref not in self.cache:
            self.cache[xref] = _font_glyph_names(self.doc, xref)
        return self.cache[xref]


def _font_glyph_names(doc, xref: int) -> list[str] | None:
    """Glyph names in glyph-id order, or None for fonts we can't read."""
    try:
        _name, ext, _type, buffer = doc.extract_font(xref)
        if not buffer:
            return None
        if ext in ("pfa", "pfb"):  # Type 1
            font = T1Font.__new__(T1Font)  # from bytes, not a file path
            font.data, font.encoding = buffer, "ascii" if ext == "pfa" else "binary"
            font.parse()
            return list(font.font["CharStrings"].keys())
        if ext in ("ttf", "otf"):  # TrueType / OpenType
            return TTFont(io.BytesIO(buffer)).getGlyphOrder()
    except Exception:  # a damaged or unusual font: just don't recover
        return None
    return None


def name_to_text(glyph_name: str) -> str:
    """'four.oldstyle' → '4', 'R.c2sc' → 'R', 'uniFB01' → 'fi'.

    The Adobe Glyph List ignores everything after the
    first full stop (style variants), and NFKC splits
    ligatures into their letters.
    """
    return unicodedata.normalize("NFKC", agl.toUnicode(glyph_name))


# Ligature characters (ﬀ ﬁ ﬂ ﬃ ﬄ ﬅ ﬆ) → plain letters, so
# "ﬁrst" matches a search for "first".
LIGATURES = {code: unicodedata.normalize("NFKC", chr(code)) for code in range(0xFB00, 0xFB07)}


def clean_text(text: str) -> str:
    """Tidy extracted text while keeping paragraph breaks.

    PDFs break lines wherever the layout did, often mid-
    sentence. A single newline becomes a space; a blank
    line (a real paragraph break) stays as one.
    """
    # Postgres text columns can't hold NUL bytes at all,
    # and soft hyphens are invisible noise.
    text = text.replace("\x00", "").replace("­", "").translate(LIGATURES)
    paragraphs = re.split(r"\n\s*\n", text)
    joined = (" ".join(p.split()) for p in paragraphs)
    return "\n\n".join(p for p in joined if p)
