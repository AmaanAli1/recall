"""Tests for read_pdf / clean_text (step 1)."""

from pathlib import Path

import pytest

from recall_api.ingest.pdf import (
    GlyphNames,
    PdfError,
    clean_text,
    is_unknown,
    name_to_text,
    read_pdf,
)

# A real Erickson chapter, if it has been downloaded (it's
# gitignored, so this is only there on Amaan's laptop).
GREEDY = Path(__file__).resolve().parents[1] / "samples" / "04-greedy.pdf"


def test_pages_are_numbered_from_one_with_their_own_text(make_pdf):
    pages = read_pdf(make_pdf(["Greedy algorithms.", "Dynamic programming.", "Shortest paths."]))

    assert [p.number for p in pages] == [1, 2, 3]
    assert pages[1].text == "Dynamic programming."


def test_a_blank_page_is_kept_with_empty_text(make_pdf):
    # Kept so later page numbers stay right; the chunker skips it.
    pages = read_pdf(make_pdf(["First.", "", "Third."]))

    assert [p.text for p in pages] == ["First.", "", "Third."]


def test_a_file_that_is_not_a_pdf_is_refused():
    with pytest.raises(PdfError, match="isn't a PDF"):
        read_pdf(b"PK\x03\x04 this is really a .docx")


def test_a_truncated_pdf_is_refused(make_pdf):
    with pytest.raises(PdfError):
        read_pdf(make_pdf(["Some text."])[:40])


def test_a_password_protected_pdf_is_refused(make_pdf):
    with pytest.raises(PdfError, match="password"):
        read_pdf(make_pdf(["Secret."], password="hunter2"))


def test_clean_text_joins_lines_and_keeps_paragraphs():
    raw = "Merge sort splits\nthe array   in half.\n\n\nThen it merges.\x00"

    assert clean_text(raw) == "Merge sort splits the array in half.\n\nThen it merges."


def test_clean_text_splits_ligatures_into_letters():
    assert clean_text("\ufb01rst e\ufb00ect") == "first effect"


@pytest.mark.parametrize(
    ("glyph_name", "text"),
    [
        ("four.oldstyle", "4"),  # old-style digit
        ("one.Alt.oldstyle", "1"),
        ("R.c2sc", "R"),  # small capital
        ("uniFB01", "fi"),  # the fi ligature
        ("lessequal", "\u2264"),  # ≤
        ("g42", ""),  # a made-up name: unknown, not a guess
    ],
)
def test_glyph_names_become_characters(glyph_name, text):
    assert name_to_text(glyph_name) == text


def test_what_counts_as_unknown():
    assert is_unknown("\uffff") and is_unknown("\ufffd") and is_unknown("\uf8ff")
    assert not is_unknown("a") and not is_unknown("\u2264")


def test_a_glyph_is_recovered_only_when_all_candidates_agree():
    same = [["a", "four.oldstyle"], ["b", "four.oldstyle"]]
    different = [["a", "four.oldstyle"], ["b", "seven.oldstyle"]]

    assert GlyphNames.agreed_text(same, 1) == "4"
    assert GlyphNames.agreed_text(different, 1) == ""  # dropped, never guessed
    assert GlyphNames.agreed_text(same, 99) == ""  # glyph id out of range


@pytest.mark.skipif(not GREEDY.exists(), reason="sample PDF not downloaded")
def test_the_real_greedy_chapter_reads_cleanly():
    pages = read_pdf(GREEDY.read_bytes())
    text = "\n".join(p.text for p in pages)

    assert not any(is_unknown(c) for c in text)
    assert "Greed clarifies" in text  # the fi ligature
    assert "4.1 Storing Files on Tape" in text  # old-style digits in a heading
    assert "Lemma 4.1." in text
    assert "\u2264" in text  # ≤ from the private-use area
    assert sum(p.unreadable for p in pages) <= 10
