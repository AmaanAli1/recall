"""Tests for the chunker (step 2): the D4 rules."""

from recall_api.ingest.chunk import (
    MAX_TOKENS,
    Chunk,
    chunk_document,
    chunk_page,
    embedding_input,
    estimate_tokens,
)
from recall_api.ingest.pdf import Page


def sentences(n: int, tag: str) -> str:
    """n distinct sentences of ~12 tokens each, e.g. 'P2 sentence 7 …'."""
    return " ".join(f"{tag} sentence {i} says something about graphs." for i in range(n))


def test_a_near_empty_page_gives_no_chunks():
    assert chunk_page("Chapter 3") == []


def test_a_short_page_is_one_chunk():
    text = sentences(10, "P1")

    assert chunk_page(text) == [text]


def test_chunks_never_mix_pages():
    pages = [Page(1, sentences(80, "P1")), Page(2, sentences(80, "P2"))]

    for chunk in chunk_document(pages):
        other = "P2" if chunk.page == 1 else "P1"
        assert other not in chunk.text


def test_no_chunk_is_over_the_maximum():
    chunks = chunk_document([Page(1, sentences(300, "P1"))])

    assert len(chunks) > 1
    assert all(c.tokens <= MAX_TOKENS for c in chunks)


def test_neighbouring_chunks_overlap():
    first, second, *_ = chunk_page(sentences(120, "P1"))
    first_of_second = second.split(". ")[0]
    last_of_first = first.split(". ")[-1]

    # The next chunk starts a few sentences back, inside the
    # previous one, so the cut point appears whole in both.
    assert first_of_second in first
    assert last_of_first in second


def test_indexes_count_across_the_whole_document():
    pages = [Page(1, sentences(80, "P1")), Page(2, ""), Page(3, sentences(80, "P3"))]
    chunks = chunk_document(pages)

    assert [c.index for c in chunks] == list(range(len(chunks)))
    assert {c.page for c in chunks} == {1, 3}  # the blank page 2 is skipped


def test_a_huge_sentence_with_no_full_stops_is_still_cut():
    text = "word " * 3000  # ~3,750 tokens, no punctuation at all

    pieces = chunk_page(text)

    assert len(pieces) > 1
    assert all(estimate_tokens(p) <= MAX_TOKENS for p in pieces)


def test_embedding_input_names_the_document_and_page():
    chunk = Chunk(page=4, index=0, text="Greedy fails here.", tokens=5)

    expected = "Erickson_Ch4.pdf · page 4\nGreedy fails here."
    assert embedding_input("Erickson_Ch4.pdf", chunk) == expected
