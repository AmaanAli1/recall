"""Step 3: turn passages into embeddings (lists of 1,536 numbers).

The OpenAI SDK already retries rate limits (429) and
server errors (5xx) with backoff; we only raise its retry
count when creating the client (see `make_client`).
"""

from dataclasses import dataclass
from typing import Any, Protocol

MODEL = "text-embedding-3-small"
DIMENSIONS = 1536  # must match chunks.embedding vector(1536)
BATCH_SIZE = 100  # passages per API call


class EmbeddingsClient(Protocol):
    """The one part of OpenAI's client we use.

    Typing against this instead of the real class lets the
    tests pass in a small fake with the same shape.
    """

    @property
    def embeddings(self) -> Any: ...


@dataclass(frozen=True)
class Embedded:
    vectors: list[list[float]]  # same order as the input texts
    tokens: int  # what OpenAI says it used (billing)


def embed_texts(client: EmbeddingsClient, texts: list[str]) -> Embedded:
    vectors: list[list[float]] = []
    tokens = 0
    for start in range(0, len(texts), BATCH_SIZE):
        batch = texts[start : start + BATCH_SIZE]
        response = client.embeddings.create(model=MODEL, input=batch)
        # Each result says which input it belongs to; sort by
        # that instead of trusting the order of the list.
        data = sorted(response.data, key=lambda item: item.index)
        if len(data) != len(batch):
            raise RuntimeError(f"Expected {len(batch)} embeddings, got {len(data)}.")
        for item in data:
            if len(item.embedding) != DIMENSIONS:
                raise RuntimeError(f"Expected {DIMENSIONS} dimensions, got {len(item.embedding)}.")
            vectors.append(item.embedding)
        tokens += response.usage.total_tokens
    return Embedded(vectors=vectors, tokens=tokens)


def make_client(api_key: str):
    """A real OpenAI client, with more patience than the default."""
    from openai import OpenAI  # imported here so tests never need the key

    return OpenAI(api_key=api_key, max_retries=5)
