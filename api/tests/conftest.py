"""Shared test helpers. pytest loads conftest.py by itself,
and every test can ask for these fixtures by name."""

import pymupdf
import pytest


@pytest.fixture
def make_pdf():
    """Build a real PDF in memory: one string per page.

    Lets every test use a PDF whose exact text and page
    numbers we know, with no sample files and no network.
    """

    def build(pages: list[str], password: str | None = None) -> bytes:
        doc = pymupdf.open()
        for text in pages:
            page = doc.new_page()
            # A box the size of the page, so long text wraps
            # onto several lines, like a real document.
            page.insert_textbox(pymupdf.Rect(50, 50, 550, 800), text, fontsize=9)
        if password:
            return doc.tobytes(encryption=pymupdf.PDF_ENCRYPT_AES_256, user_pw=password)
        return doc.tobytes()

    return build
