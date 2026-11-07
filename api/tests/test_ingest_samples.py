"""Tests for the ingest script: inputs, safety checks, dry run.

The real database run is checked by hand against staging
(it needs the admin connection string, which never leaves
the laptop). Everything before that is tested here.
"""

import hashlib
from pathlib import Path

import pytest

from recall_api.scripts.ingest_samples import (
    IngestError,
    load_manifest,
    main,
    project_ref,
    read_sample,
    run,
    vector_literal,
)

COURSE = "00000000-0000-0000-0000-00000000c001"


def write_sample(tmp_path: Path, pdf: bytes, sha: str | None = None) -> Path:
    """A samples folder with one PDF, and a manifest listing it."""
    (tmp_path / "samples").mkdir()
    (tmp_path / "samples" / "dp.pdf").write_bytes(pdf)
    manifest = tmp_path / "samples.toml"
    manifest.write_text(
        f"""
[[document]]
course_id = "{COURSE}"
file = "dp.pdf"
name = "Erickson_Ch3_DynamicProgramming.pdf"
source_url = "https://example.org/03-dynprog.pdf"
license = "CC BY 4.0"
sha256 = "{sha or hashlib.sha256(pdf).hexdigest()}"
""",
        encoding="utf-8",
    )
    return manifest


def long_text(tag):
    return " ".join(f"{tag} line {i} about memoization and subproblems." for i in range(60))


def test_project_ref_from_a_pooler_url():
    url = "postgresql://postgres.sikrkiebrudfqylhgdlu:pw@aws-0-us-east-1.pooler.supabase.com:5432/postgres"

    assert project_ref(url) == "sikrkiebrudfqylhgdlu"


def test_project_ref_from_a_direct_url():
    url = "postgresql://postgres:pw@db.ztulgqetgkzyecohcfgh.supabase.co:5432/postgres"

    assert project_ref(url) == "ztulgqetgkzyecohcfgh"


def test_project_ref_unknown():
    assert project_ref("postgresql://localhost/postgres") is None


def test_vector_literal_is_pgvector_text():
    assert vector_literal([0.5, -1, 2.25]) == "[0.5,-1.0,2.25]"


def test_manifest_loads(tmp_path, make_pdf):
    docs = load_manifest(write_sample(tmp_path, make_pdf(["x"])))

    assert docs[0].name == "Erickson_Ch3_DynamicProgramming.pdf"


def test_manifest_with_a_bad_course_id_is_refused(tmp_path, make_pdf):
    manifest = write_sample(tmp_path, make_pdf(["x"]))
    manifest.write_text(manifest.read_text().replace(COURSE, "algorithms"))

    with pytest.raises(IngestError, match="uuid"):
        load_manifest(manifest)


def test_a_changed_file_is_refused(tmp_path, make_pdf):
    # The PDF on disk must be the one we listed: a different
    # edition would silently change every page number.
    manifest = write_sample(tmp_path, make_pdf(["x"]), sha="a" * 64)
    doc = load_manifest(manifest)[0]

    with pytest.raises(IngestError, match="sha256 is"):
        read_sample(doc, tmp_path / "samples")


def test_dry_run_reports_pages_and_chunks(tmp_path, make_pdf):
    manifest = write_sample(tmp_path, make_pdf([long_text("P1"), long_text("P2")]))
    lines: list[str] = []

    run(load_manifest(manifest), tmp_path / "samples", out=lines.append)

    assert lines[0].startswith("Erickson_Ch3_DynamicProgramming.pdf: 2 pages ->")
    assert "page 1" in lines[1]
    assert lines[-1].startswith("Done: would embed about")


def test_a_real_run_refuses_a_mismatched_ref(tmp_path, make_pdf, monkeypatch, capsys):
    manifest = write_sample(tmp_path, make_pdf(["x"]))
    monkeypatch.setenv(
        "ADMIN_DATABASE_URL",
        "postgresql://postgres.ztulgqetgkzyecohcfgh:pw@aws-0-us-east-1.pooler.supabase.com:5432/postgres",
    )
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-not-real")
    monkeypatch.chdir(tmp_path)  # so no real api/.env is read

    code = main(["--manifest", str(manifest), "--ref", "sikrkiebrudfqylhgdlu"])

    assert code == 2
    assert "Refusing" in capsys.readouterr().out
