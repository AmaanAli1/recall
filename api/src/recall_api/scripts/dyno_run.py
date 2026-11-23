"""Dyno v0: score retrieval on the golden set.

Run from the api/ folder, on Amaan's laptop only:

    uv run python -m recall_api.scripts.dyno_run --dry-run
    uv run python -m recall_api.scripts.dyno_run --ref <project-ref> --change "Baseline"

--dry-run checks dyno/golden.toml against samples.toml and
prints what it would ask: no OpenAI, no database.
A real run embeds every question (one OpenAI call), asks
match_chunks() for the top 10 chunks of each, scores
recall@5 and MRR, and APPENDS the run to
web/src/data/dyno-runs.json, which /dyno reads.

Why the admin connection, read-only (decision DV4): the
sample course belongs to no visitor, and signing in as a
throwaway visitor on every run would leave anonymous users
behind. `conn.read_only = True` makes Postgres itself
refuse any write in this session, so a bug here can't
change data. Same --ref check as the ingest script.
"""

import argparse
import json
import subprocess
import sys
import time
from collections.abc import Callable
from datetime import date
from pathlib import Path

from recall_api.dyno.golden import GoldenError, GoldenSet, load_golden
from recall_api.dyno.metrics import bootstrap_ci, first_hit_rank, hit_at_k, reciprocal_rank
from recall_api.ingest.chunk import MAX_TOKENS, OVERLAP_TOKENS, TARGET_TOKENS
from recall_api.ingest.embed import MODEL as EMBED_MODEL
from recall_api.ingest.embed import EmbeddingsClient, embed_texts, make_client
from recall_api.scripts.ingest_samples import (
    API_DIR,
    EMBED_PRICE_PER_MILLION,
    IngestError,
    ScriptSettings,
    load_manifest,
    project_ref,
    vector_literal,
)

REPO_DIR = API_DIR.parent
GOLDEN_PATH = REPO_DIR / "dyno" / "golden.toml"
RUNS_PATH = REPO_DIR / "web" / "src" / "data" / "dyno-runs.json"

TOP_K = 10  # chunks retrieved per question (MRR looks this deep)
RECALL_K = 5  # recall@5
KEEP_TOP = 5  # retrieved chunks saved per question, to study misses

# One retrieved chunk: (document name, page, similarity).
Hit = tuple[str, int, float]
# "Give me the top k chunks of this course for this vector."
# The real one queries Postgres; tests pass a fake.
Search = Callable[[list[float], str, int], list[Hit]]

MATCH_SQL = """
select document_name, page, similarity
  from public.match_chunks(%s::extensions.vector, %s::uuid, %s::integer)
"""

READY_DOCUMENTS_SQL = """
select name from public.documents
 where course_id = %s::uuid and session_id is null and status = 'ready'
"""


# ---------- Scoring (no network) ----------


def score(golden: GoldenSet, vectors: list[list[float]], search: Search) -> list[dict]:
    """One result per question: the first hit's rank + what came back."""
    results = []
    for question, vector in zip(golden.questions, vectors, strict=True):
        hits = search(vector, golden.course_id, TOP_K)
        rank = first_hit_rank(question, [(document, page) for document, page, _ in hits])
        results.append(
            {
                "id": question.id,
                "rank": rank,  # None (null in JSON) = not in the top 10
                "top": [
                    {"file": document, "page": page, "score": round(similarity, 3)}
                    for document, page, similarity in hits[:KEEP_TOP]
                ],
            }
        )
    return results


def summarize(results: list[dict]) -> dict:
    """recall@5 and MRR with their 95% intervals, rounded for the page."""
    ranks = [r["rank"] for r in results]
    metrics = {
        "recall5": bootstrap_ci([hit_at_k(rank, RECALL_K) for rank in ranks]),
        "mrr": bootstrap_ci([reciprocal_rank(rank) for rank in ranks]),
    }
    return {
        name: {"value": round(e.value, 3), "low": round(e.low, 3), "high": round(e.high, 3)}
        for name, e in metrics.items()
    }


def setup() -> dict:
    """What this run measured (the run's Details panel on /dyno).

    Read from the code's own constants, so a later chunking
    change shows up here without anyone remembering to
    edit a string.
    """
    return {
        "chunking": f"{TARGET_TOKENS}-token chunks (max {MAX_TOKENS}, "
        f"{OVERLAP_TOKENS} overlap), one page each",
        "retrieval": "cosine similarity (pgvector)",
        "topK": TOP_K,
        "reranker": "none",
        "rewriting": "none",
        "embedModel": EMBED_MODEL,
    }


def git_commit() -> str:
    """The short commit this script ran from, or "unknown"."""
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True,
            text=True,
            check=True,
            cwd=REPO_DIR,
        )
    except (OSError, subprocess.CalledProcessError):
        return "unknown"
    return out.stdout.strip() or "unknown"


# ---------- Saving ----------


def append_run(path: Path, run: dict) -> dict:
    """Add the run to the JSON list (creating it if needed); returns it with its id.

    Old runs are read back and written out unchanged: a run,
    once recorded, is history (the baseline is run 1).
    """
    runs = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
    run = {"id": f"R{len(runs) + 1}", **run}
    runs.append(run)
    path.parent.mkdir(parents=True, exist_ok=True)
    # indent=2 + a final newline: small, readable git diffs.
    path.write_text(json.dumps(runs, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return run


# ---------- The run ----------


def run(
    golden: GoldenSet,
    *,
    client: EmbeddingsClient,
    search: Search,
    change: str,
    runs_path: Path,
    out: Callable[[str], None] = print,
) -> dict:
    start = time.perf_counter()
    # One embedding call for all questions, and the SAME
    # helper and model the live /v1/answer uses for a
    # question (no "name · page" prefix: that's for passages).
    embedded = embed_texts(client, [q.question for q in golden.questions])
    results = score(golden, embedded.vectors, search)
    metrics = summarize(results)

    for r in results:
        found = f"rank {r['rank']}" if r["rank"] else "MISS (not in top 10)"
        out(f"  {r['id']:<10} {found}")
    for name, label in (("recall5", "recall@5"), ("mrr", "MRR")):
        m = metrics[name]
        out(f"{label}: {m['value']:.2f} (95% interval {m['low']:.2f}-{m['high']:.2f})")

    saved = append_run(
        runs_path,
        {
            "date": date.today().isoformat(),
            "change": change,
            "commit": git_commit(),
            "n": len(results),
            "metrics": metrics,
            "setup": setup(),
            "tokens": embedded.tokens,
            "costUsd": round(embedded.tokens * EMBED_PRICE_PER_MILLION / 1_000_000, 6),
            "durationS": round(time.perf_counter() - start, 1),
            "questions": results,
        },
    )
    out(f"Saved {saved['id']} to {runs_path}.")
    return saved


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Score retrieval on Dyno's golden set.")
    parser.add_argument("--dry-run", action="store_true", help="check the golden set only")
    parser.add_argument("--ref", help="the project ref you mean to read from")
    parser.add_argument("--change", help='what this run tests, e.g. "Baseline"')
    parser.add_argument("--golden", type=Path, default=GOLDEN_PATH)
    parser.add_argument("--manifest", type=Path, default=API_DIR / "samples.toml")
    parser.add_argument("--runs", type=Path, default=RUNS_PATH)
    args = parser.parse_args(argv)

    try:
        known = {doc.name for doc in load_manifest(args.manifest)}
        golden = load_golden(args.golden, known)
        print(f"Golden set: {len(golden.questions)} questions.")
        if args.dry_run:
            for q in golden.questions:
                print(f"  {q.id:<10} {q.document} p. {', '.join(map(str, q.pages))}")
            return 0

        # Every run says what it tested, so the runs table
        # never shows a run nobody can explain.
        if not args.change or not args.change.strip():
            print('Refusing: say what this run tests, e.g. --change "Baseline".')
            return 2

        settings = ScriptSettings()
        url = settings.admin_database_url.get_secret_value()
        target = project_ref(url)
        if args.ref is None or args.ref != target:
            print(f"Refusing: ADMIN_DATABASE_URL points at {target!r}, but --ref is {args.ref!r}.")
            return 2
        print(f"Reading from project {target} (read-only).")

        import psycopg  # only needed for a real run

        with psycopg.connect(url, prepare_threshold=None) as conn:
            # Must be set before the first query opens a
            # transaction; from then on every statement runs
            # in a READ ONLY transaction.
            conn.read_only = True

            # A golden document missing from the database would
            # score 0 for "no reason": refuse instead.
            rows = conn.execute(READY_DOCUMENTS_SQL, (golden.course_id,)).fetchall()
            missing = {q.document for q in golden.questions} - {name for (name,) in rows}
            if missing:
                print(f"Refusing: not loaded in {target}: {', '.join(sorted(missing))}.")
                return 1

            def search(vector: list[float], course_id: str, k: int) -> list[Hit]:
                return conn.execute(MATCH_SQL, (vector_literal(vector), course_id, k)).fetchall()

            client = make_client(settings.openai_api_key.get_secret_value())
            run(
                golden,
                client=client,
                search=search,
                change=args.change.strip(),
                runs_path=args.runs,
            )
        return 0
    except (GoldenError, IngestError) as error:
        print(f"Error: {error}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
