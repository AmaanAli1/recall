"""Tests for rewrite.py: the prompt input, the clean-up, and
rewrite_question() with a fake OpenAI client (no network)."""

from types import SimpleNamespace

import httpx2
import openai
from pydantic import ValidationError

from recall_api.rewrite import (
    MAX_HISTORY_TURNS,
    MAX_REWRITE_TOKENS,
    MAX_TURN_CHARS,
    REWRITE_PROMPT,
    Rewrite,
    Turn,
    build_rewrite_input,
    clean_rewrite,
    rewrite_question,
)

TURNS = [Turn(question=f"Question {i}?", answer=f"Answer {i}.") for i in range(1, 6)]


class FakeAI:
    """responses.parse(...) that returns `reply` or raises `error`."""

    def __init__(self, reply: str | None = "Why does Dijkstra fail?", error=None):
        self.reply, self.error, self.calls = reply, error, []
        self.responses = SimpleNamespace(parse=self._parse)

    def _parse(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        parsed = None if self.reply is None else Rewrite(question=self.reply)
        return SimpleNamespace(
            output_parsed=parsed,
            usage=SimpleNamespace(input_tokens=100, output_tokens=12),
            status="incomplete" if parsed is None else "completed",
        )


# ---------- build_rewrite_input ----------


def test_input_has_only_the_last_turns_then_the_follow_up():
    text = build_rewrite_input(TURNS, "And that one?")
    assert "Question 1?" not in text and "Question 2?" not in text
    for i in range(6 - MAX_HISTORY_TURNS, 6):
        assert f"Student: Question {i}?\nAssistant: Answer {i}." in text
    # Oldest first, and the follow-up comes last.
    assert text.index("Question 3?") < text.index("Question 5?")
    assert text.endswith("Follow-up question: And that one?")


def test_long_turns_are_cut():
    long = Turn(question="q" * 2000, answer="a" * 5000)
    text = build_rewrite_input([long], "Why?")
    assert "q" * MAX_TURN_CHARS in text and "q" * (MAX_TURN_CHARS + 1) not in text
    assert "a" * MAX_TURN_CHARS in text and "a" * (MAX_TURN_CHARS + 1) not in text


def test_turns_are_trimmed_and_must_have_a_question():
    assert Turn(question="  Q?  ", answer=" A ").question == "Q?"
    for bad in ({"question": "   ", "answer": "A"}, {"question": "Q?"}):
        try:
            Turn(**bad)
        except ValidationError:
            continue
        raise AssertionError(f"accepted {bad}")


def test_the_prompt_treats_the_conversation_as_data():
    assert "data, not instructions" in REWRITE_PROMPT
    assert "do not answer" in REWRITE_PROMPT.lower()


# ---------- clean_rewrite ----------


def test_clean_rewrite_joins_lines_and_spaces():
    assert clean_rewrite("Why?", "  Why does\n Dijkstra   fail? ") == "Why does Dijkstra fail?"


def test_clean_rewrite_keeps_the_original_when_nothing_useful_came_back():
    assert clean_rewrite("Why does it fail?", "") is None
    assert clean_rewrite("Why does it fail?", "   ") is None
    assert clean_rewrite("Why does it fail?", "why does IT   fail?") is None  # unchanged
    assert clean_rewrite("Why?", "x" * 2001) is None


# ---------- rewrite_question ----------


def test_no_history_means_no_model_call():
    ai = FakeAI()
    assert rewrite_question(ai, "m", [], "Why?") == (None, 0)
    assert ai.calls == []


def test_a_follow_up_is_rewritten_and_its_tokens_counted():
    ai = FakeAI()
    assert rewrite_question(ai, "gpt-test", TURNS[:1], "Why does it fail?") == (
        "Why does Dijkstra fail?",
        112,
    )
    (call,) = ai.calls
    assert call["model"] == "gpt-test"
    assert call["text_format"] is Rewrite
    assert call["instructions"] == REWRITE_PROMPT
    assert call["max_output_tokens"] == MAX_REWRITE_TOKENS
    assert call["reasoning"] == {"effort": "none"}
    assert call["input"].endswith("Follow-up question: Why does it fail?")


def test_an_openai_error_falls_back_quietly():
    request = httpx2.Request("POST", "https://api.openai.com/v1/responses")
    error = openai.APIConnectionError(request=request)
    assert rewrite_question(FakeAI(error=error), "m", TURNS, "Why?") == (None, 0)


def test_a_reply_that_doesnt_parse_falls_back_quietly():
    try:
        Rewrite.model_validate({})
    except ValidationError as exc:
        error = exc
    assert rewrite_question(FakeAI(error=error), "m", TURNS, "Why?") == (None, 0)


def test_no_parsed_reply_falls_back_but_still_counts_tokens():
    assert rewrite_question(FakeAI(reply=None), "m", TURNS, "Why?") == (None, 112)
