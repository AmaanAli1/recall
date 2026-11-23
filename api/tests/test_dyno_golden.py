"""Tests for the golden-set loader: the real file, and every way to break one."""

import re
from pathlib import Path

import pytest

from recall_api.dyno.golden import GoldenError, Question, load_golden
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
    assert len(golden.questions) == 20
    assert {q.document for q in golden.questions} == known  # every chapter is asked about


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
