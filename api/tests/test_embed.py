"""Tests for embed_texts (step 3), with a fake OpenAI client.

The fake has the same shape as the real one
(client.embeddings.create(...) → .data[i].embedding,
.data[i].index, .usage.total_tokens), so no key, no
network and no cost.
"""

from types import SimpleNamespace

import pytest

from recall_api.ingest.embed import BATCH_SIZE, DIMENSIONS, embed_texts


class FakeEmbeddings:
    def __init__(self, dims=DIMENSIONS, shuffle=False):
        self.calls: list[list[str]] = []
        self.dims = dims
        self.shuffle = shuffle

    def create(self, model, input):
        self.calls.append(input)
        # Vector i starts with the input's number, so tests
        # can tell which text each vector belongs to.
        data = [
            SimpleNamespace(index=i, embedding=[float(text.split()[-1])] + [0.0] * (self.dims - 1))
            for i, text in enumerate(input)
        ]
        if self.shuffle:
            data.reverse()
        return SimpleNamespace(data=data, usage=SimpleNamespace(total_tokens=3 * len(input)))


def fake_client(**kwargs):
    return SimpleNamespace(embeddings=FakeEmbeddings(**kwargs))


def texts(n):
    return [f"passage {i}" for i in range(n)]


def test_sends_batches_of_at_most_100():
    client = fake_client()

    embed_texts(client, texts(250))

    assert [len(batch) for batch in client.embeddings.calls] == [BATCH_SIZE, BATCH_SIZE, 50]


def test_vectors_come_back_in_input_order_even_if_shuffled():
    result = embed_texts(fake_client(shuffle=True), texts(5))

    assert [v[0] for v in result.vectors] == [0.0, 1.0, 2.0, 3.0, 4.0]


def test_adds_up_the_tokens_openai_reports():
    assert embed_texts(fake_client(), texts(250)).tokens == 750


def test_nothing_to_embed_makes_no_call():
    client = fake_client()

    assert embed_texts(client, []).vectors == []
    assert client.embeddings.calls == []


def test_wrong_dimensions_stop_the_run():
    # A different model (or a mistake) would give vectors the
    # vector(1536) column can't hold: fail loudly, early.
    with pytest.raises(RuntimeError, match="1536 dimensions"):
        embed_texts(fake_client(dims=3072), texts(2))
