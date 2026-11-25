"""Load and check Dyno's golden set (dyno/golden.toml).

The golden set is the answer key: questions with the
page(s) that answer them. A typo here doesn't crash
anything later, it just scores 0 (a document name nobody
matches, a page 0 nobody retrieves), so every rule is
checked up front and a broken file is refused with a
message that says where.

Three kinds of question (since 2026-11-25):
- core: a stand-alone question with its right page(s);
- follow-up: the same, plus `history` (the earlier turn of
  the chat) and a vague question that needs it ("why can
  it take quadratic time?"): measures query rewriting;
- off-topic: `expect = "not_found"`, no document or pages:
  the course doesn't answer it, so the best match should
  fall below the not-found threshold.
"""

import tomllib
import uuid
from dataclasses import dataclass
from pathlib import Path


class GoldenError(Exception):
    """Something wrong with golden.toml; the message says what."""


EXPECTS = ("answer", "not_found")


@dataclass(frozen=True)
class Turn:
    """An earlier exchange in a follow-up's chat (our own words)."""

    question: str
    answer: str


@dataclass(frozen=True)
class Question:
    id: str  # "rec-01": stable, never reused
    question: str
    document: str  # display name, as match_chunks() returns it
    pages: tuple[int, ...]  # viewer pages; a hit on ANY counts
    answer: str  # short reference answer (for checking; v1 grading)
    # Defaults keep the 20 core questions (and old tests) as
    # they were: no history, an answer expected.
    history: tuple[Turn, ...] = ()
    expect: str = "answer"  # or "not_found" (off-topic)

    @property
    def kind(self) -> str:
        """Which group: core, follow_up or off_topic (scored separately, never averaged)."""
        if self.expect == "not_found":
            return "off_topic"
        return "follow_up" if self.history else "core"

    def is_hit(self, document: str, page: int) -> bool:
        """Does a retrieved chunk from (document, page) answer this?

        BOTH must match: every chapter has a page 5, so a
        page number alone would count wrong chapters as hits.
        """
        return document == self.document and page in self.pages


@dataclass(frozen=True)
class GoldenSet:
    course_id: str  # every question is asked in this course
    questions: list[Question]


def load_golden(path: Path, known_documents: set[str]) -> GoldenSet:
    """Read golden.toml; `known_documents` are the names in samples.toml."""
    try:
        raw = tomllib.loads(path.read_text(encoding="utf-8"))
    except (OSError, tomllib.TOMLDecodeError) as error:
        raise GoldenError(f"Couldn't read {path}: {error}") from error

    course_id = raw.get("course_id", "")
    try:
        uuid.UUID(course_id)
    except ValueError as error:
        raise GoldenError(f"course_id isn't a uuid: {course_id!r}") from error

    questions: list[Question] = []
    seen: set[str] = set()
    for i, entry in enumerate(raw.get("question", []), start=1):
        where = f"question {i} ({entry.get('id', 'no id')})"
        try:
            history = tuple(Turn(**turn) for turn in entry.get("history", ()))
            # TOML gives lists; tuples can't be changed by
            # accident later (the dataclass is frozen too).
            # Off-topic questions have no document or pages.
            q = Question(
                **{
                    "document": "",
                    **entry,
                    "pages": tuple(entry.get("pages", ())),
                    "history": history,
                }
            )
        except TypeError as error:  # a missing or unknown field
            raise GoldenError(f"{where}: {error}") from error

        if q.id in seen:
            raise GoldenError(f"{where}: id {q.id!r} is used twice")
        seen.add(q.id)
        if not q.question.strip():
            raise GoldenError(f"{where}: the question is empty")
        if q.expect not in EXPECTS:
            raise GoldenError(f"{where}: expect must be one of {EXPECTS}, not {q.expect!r}")
        for turn in q.history:
            if not turn.question.strip() or not turn.answer.strip():
                raise GoldenError(f"{where}: every history turn needs a question and an answer")
        if q.expect == "not_found":
            # Nothing in the course answers it, so a label or a
            # history would be a mistake (or a different test).
            if q.document or q.pages or q.history:
                raise GoldenError(
                    f"{where}: a not_found question has no document, pages or history"
                )
            questions.append(q)
            continue
        if q.document not in known_documents:
            raise GoldenError(f"{where}: unknown document {q.document!r} (see samples.toml)")
        # bool is a kind of int in Python (True == 1), so rule
        # it out by name: `pages = [true]` is a typo, not page 1.
        if not q.pages or not all(
            isinstance(p, int) and not isinstance(p, bool) and p >= 1 for p in q.pages
        ):
            raise GoldenError(f"{where}: pages must be a non-empty list of page numbers (1, 2, …)")
        questions.append(q)

    if not questions:
        raise GoldenError(f"{path.name} has no [[question]] entries")
    return GoldenSet(course_id=course_id, questions=questions)
