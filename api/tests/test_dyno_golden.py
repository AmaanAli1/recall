"""Tests for the golden-set loader: the real file, and every way to break one."""

import re
from pathlib import Path

import pytest

from recall_api.dyno.golden import GoldenError, Question, Turn, load_golden
from recall_api.scripts.ingest_samples import API_DIR, load_manifest

COURSE = "00000000-0000-0000-0000-00000000c001"
DOCS = {"Erickson_Ch1_Recursion.pdf", "Erickson_Ch8_ShortestPaths.pdf"}


def write_golden(tmp_path: Path, questions: str, course: str = COURSE) -> Path:
    path = tmp_path / "golden.toml"
    path.write_text(f'course_id = "{course}"\n{questions}', encoding="utf-8")
    return path


def question(
    id="rec-01", document="Erickson_Ch1_Recursion.pdf", pages="[6]", text="How many moves?"
):
    return f"""
[[question]]
id = "{id}"
question = "{text}"
document = "{document}"
pages = {pages}
answer = "2^n - 1"
"""


def test_the_real_golden_set_loads():
    # The committed file, checked against the committed
    # manifest: a typo in either fails CI, not a Dyno run.
    known = {doc.name for doc in load_manifest(API_DIR / "samples.toml")}

    golden = load_golden(API_DIR.parent / "dyno" / "golden.toml", known)

    assert golden.course_id == COURSE
    kinds = [q.kind for q in golden.questions]
    # The original 20 are untouched; follow-ups and off-topic were added (PR H).
    assert (kinds.count("core"), kinds.count("follow_up"), kinds.count("off_topic")) == (20, 8, 5)
    assert [q.id for q in golden.questions[:20]][:2] == ["rec-01", "rec-02"]
    core = [q for q in golden.questions if q.kind == "core"]
    assert {q.document for q in core} == known  # every chapter is asked about
    # Each follow-up points at the same page as a core question.
    for fu in (q for q in golden.questions if q.kind == "follow_up"):
        assert any(c.document == fu.document and c.pages == fu.pages for c in core), fu.id


def test_reads_a_question(tmp_path):
    golden = load_golden(write_golden(tmp_path, question(pages="[8, 13]")), DOCS)

    assert golden.questions == [
        Question(
            id="rec-01",
            question="How many moves?",
            document="Erickson_Ch1_Recursion.pdf",
            pages=(8, 13),
            answer="2^n - 1",
        )
    ]


def test_a_hit_needs_the_document_and_the_page():
    q = Question("x", "?", "Erickson_Ch1_Recursion.pdf", (6, 7), "")

    assert q.is_hit("Erickson_Ch1_Recursion.pdf", 7)
    assert not q.is_hit("Erickson_Ch8_ShortestPaths.pdf", 7)  # same page, other chapter
    assert not q.is_hit("Erickson_Ch1_Recursion.pdf", 8)


@pytest.mark.parametrize(
    ("questions", "message"),
    [
        (question() + question(), "used twice"),
        (question(document="Erickson_Ch2_Missing.pdf"), "unknown document"),
        (question(pages="[]"), "non-empty list"),
        (question(pages="[0]"), "non-empty list"),
        (question(pages="[true]"), "non-empty list"),
        (question(text="  "), "question is empty"),
        (question().replace("answer", "anwser"), "question 1 (rec-01)"),  # misspelt field
        ("", "no [[question]] entries"),
    ],
)
def test_refuses_a_broken_file(tmp_path, questions, message):
    # re.escape: match= is a regex, and messages contain ( ) [ ].
    with pytest.raises(GoldenError, match=re.escape(message)):
        load_golden(write_golden(tmp_path, questions), DOCS)


def test_refuses_a_course_id_that_isnt_a_uuid(tmp_path):
    with pytest.raises(GoldenError, match="isn't a uuid"):
        load_golden(write_golden(tmp_path, question(), course="algorithms"), DOCS)


def test_refuses_a_file_that_isnt_toml(tmp_path):
    path = tmp_path / "golden.toml"
    path.write_text("course_id = ", encoding="utf-8")

    with pytest.raises(GoldenError, match="Couldn't read"):
        load_golden(path, DOCS)


# ---------- follow-ups and off-topic questions (PR H) ----------

FOLLOW_UP = """
[[question]]
id = "fu-01"
question = "Why can it take quadratic time?"
document = "Erickson_Ch1_Recursion.pdf"
pages = [10]
answer = "Bad pivots."
[[question.history]]
question = "How does quicksort work?"
answer = "Pick a pivot and recurse."
"""

OFF_TOPIC = """
[[question]]
id = "off-01"
question = "How do I bake bread?"
expect = "not_found"
answer = "Not in the course."
"""


def test_reads_a_follow_up_with_its_history(tmp_path):
    (q,) = load_golden(write_golden(tmp_path, FOLLOW_UP), DOCS).questions
    assert q.history == (Turn("How does quicksort work?", "Pick a pivot and recurse."),)
    assert q.kind == "follow_up" and q.expect == "answer"


def test_reads_an_off_topic_question(tmp_path):
    (q,) = load_golden(write_golden(tmp_path, OFF_TOPIC), DOCS).questions
    assert (q.kind, q.document, q.pages, q.history) == ("off_topic", "", (), ())


def test_a_plain_question_is_core(tmp_path):
    (q,) = load_golden(write_golden(tmp_path, question()), DOCS).questions
    assert q.kind == "core"


@pytest.mark.parametrize(
    ("toml", "message"),
    [
        # An off-topic question with a label (or a history) is a different test.
        (
            OFF_TOPIC.replace("expect =", 'document = "Erickson_Ch1_Recursion.pdf"\nexpect ='),
            "a not_found question has no document, pages or history",
        ),
        (
            OFF_TOPIC.replace("expect =", "pages = [3]\nexpect ="),
            "a not_found question has no document, pages or history",
        ),
        (
            OFF_TOPIC + '[[question.history]]\nquestion = "Q?"\nanswer = "A"\n',
            "a not_found question has no document, pages or history",
        ),
        (OFF_TOPIC.replace('"not_found"', '"nothing"'), "expect must be one of"),
        (
            FOLLOW_UP.replace('answer = "Pick a pivot and recurse."', 'answer = "  "'),
            "every history turn needs a question and an answer",
        ),
        (FOLLOW_UP.replace('answer = "Pick a pivot and recurse."', ""), "question 1 (fu-01)"),
        # A follow-up still needs its right page.
        (FOLLOW_UP.replace("pages = [10]\n", ""), "pages must be a non-empty list"),
    ],
)
def test_bad_follow_ups_and_off_topic_questions_are_refused(tmp_path, toml, message):
    with pytest.raises(GoldenError, match=re.escape(message)):
        load_golden(write_golden(tmp_path, toml), DOCS)
