"""Step 2: cut each page into passages ("chunks").

Rules (decision D4):
- A chunk never spans two pages, so its page number is
  always exact.
- About 400 tokens per chunk, never more than 500.
- Neighbouring chunks of the same page share ~50 tokens,
  so a sentence near a cut still appears whole in one.
- Pages with almost no text (a chapter title page) are
  skipped: a near-empty passage just adds noise.

Token counts are an estimate (about 4 characters per
token for English). Exact counting (tiktoken) needs a
download on first use; the estimate is close enough to
size passages, and the real usage comes back from
OpenAI anyway.
"""

import math
import re
from collections.abc import Iterable
from dataclasses import dataclass

from recall_api.ingest.pdf import Page

TARGET_TOKENS = 400
MAX_TOKENS = 500
OVERLAP_TOKENS = 50
MIN_PAGE_TOKENS = 40


@dataclass(frozen=True)
class Chunk:
    page: int  # the citation
    index: int  # position in the whole document: 0, 1, 2…
    text: str
    tokens: int  # estimated


def estimate_tokens(text: str) -> int:
    return max(1, math.ceil(len(text) / 4))


def chunk_document(pages: Iterable[Page]) -> list[Chunk]:
    """All chunks of a document, numbered across pages."""
    chunks: list[Chunk] = []
    for page in pages:
        for text in chunk_page(page.text):
            chunks.append(
                Chunk(page=page.number, index=len(chunks), text=text, tokens=estimate_tokens(text))
            )
    return chunks


def chunk_page(text: str) -> list[str]:
    """One page's text → passages, following the rules above."""
    if estimate_tokens(text) < MIN_PAGE_TOKENS:
        return []

    chunks: list[str] = []
    current: list[str] = []  # the sentences of the chunk being built
    for sentence in _sentences(text):
        if current and estimate_tokens(" ".join([*current, sentence])) > TARGET_TOKENS:
            chunks.append(" ".join(current))
            # Start the next chunk with the last sentences of
            # this one (the overlap), unless that would push it
            # past the hard maximum.
            current = _tail(current, OVERLAP_TOKENS)
            if estimate_tokens(" ".join([*current, sentence])) > MAX_TOKENS:
                current = []
        current.append(sentence)
    if current:
        chunks.append(" ".join(current))
    return chunks


def _sentences(text: str) -> list[str]:
    """Split at sentence ends and paragraph breaks.

    A "sentence" longer than the maximum (a long formula or
    a list with no full stops) is cut at spaces, so every
    piece fits in a chunk on its own.
    """
    parts = re.split(r"(?<=[.!?])\s+|\n{2,}", text)
    pieces: list[str] = []
    for part in (p.strip() for p in parts):
        if not part:
            continue
        while estimate_tokens(part) > MAX_TOKENS:
            cut = part.rfind(" ", 0, MAX_TOKENS * 4)
            if cut <= 0:  # one enormous "word": cut it anyway
                cut = MAX_TOKENS * 4
            pieces.append(part[:cut].strip())
            part = part[cut:].strip()
        if part:
            pieces.append(part)
    return pieces


def _tail(sentences: list[str], budget: int) -> list[str]:
    """The last few sentences that fit in `budget` tokens."""
    tail: list[str] = []
    for sentence in reversed(sentences):
        if estimate_tokens(" ".join([sentence, *tail])) > budget:
            break
        tail.insert(0, sentence)
    return tail


def embedding_input(document_name: str, chunk: Chunk) -> str:
    """What we actually embed: the passage plus where it's from.

    The stored text stays clean (it's shown in the Sources
    pane); the name and page only help the embedding place
    the passage in context.
    """
    return f"{document_name} · page {chunk.page}\n{chunk.text}"
