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

Three groups, scored separately and never averaged together:
- core (the original 20): `metrics` + `questions`, so every
  run stays comparable with run 1 (the baseline);
- follow-ups: each is rewritten with the API's own
  rewrite_question(), then scored twice, as typed and
  rewritten (before/after from the same run) -> `followUps`;
- off-topic: "correctly not found" when the best match is
  below the API's not-found threshold -> `offTopic`.

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

from recall_api.dyno.golden import GoldenError, GoldenSet, Question, Turn, load_golden
from recall_api.dyno.metrics import bootstrap_ci, first_hit_rank, hit_at_k, reciprocal_rank
from recall_api.ingest.chunk import MAX_TOKENS, OVERLAP_TOKENS, TARGET_TOKENS
from recall_api.ingest.embed import MODEL as EMBED_MODEL
from recall_api.ingest.embed import EmbeddingsClient, embed_texts, make_client
from recall_api.rewrite import Turn as RewriteTurn
from recall_api.rewrite import rewrite_question
from recall_api.scripts.ingest_samples import (
    API_DIR,
    EMBED_PRICE_PER_MILLION,
    IngestError,
    ScriptSettings,
    load_manifest,
    project_ref,
    vector_literal,
)
from recall_api.settings import Settings

REPO_DIR = API_DIR.parent
GOLDEN_PATH = REPO_DIR / "dyno" / "golden.toml"
RUNS_PATH = REPO_DIR / "web" / "src" / "data" / "dyno-runs.json"

TOP_K = 10  # chunks retrieved per question (MRR looks this deep)
RECALL_K = 5  # recall@5
KEEP_TOP = 5  # retrieved chunks saved per question, to study misses

# Read from the API's own settings (their defaults), so Dyno
# measures what /v1/answer runs. If a Lambda overrides one
# with an env var, the run's setup says which value Dyno used.
ANSWER_MODEL: str = Settings.model_fields["openai_answer_model"].default
NOT_FOUND_BELOW: float = Settings.model_fields["answer_min_similarity"].default

# One retrieved chunk: (document name, page, similarity).
Hit = tuple[str, int, float]
# "Give me the top k chunks of this course for this vector."
# The real one queries Postgres; tests pass a fake.
Search = Callable[[list[float], str, int], list[Hit]]
# "Rewrite this follow-up": (rewritten or None, tokens used).
# The real one calls rewrite_question(); tests pass a fake.
Rewriter = Callable[[tuple[Turn, ...], str], tuple[str | None, int]]

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


def _top(hits: list[Hit]) -> list[dict]:
    return [
        {"file": document, "page": page, "score": round(similarity, 3)}
        for document, page, similarity in hits[:KEEP_TOP]
    ]


def score_follow_ups(
    questions: list[Question],
    typed: list[list[float]],
    rewritten: list[list[float]],
    rewrites: list[str | None],
    course_id: str,
    search: Search,
) -> list[dict]:
    """Each follow-up ranked twice: as the student typed it, and rewritten.

    `rank` is the rewritten one, because that's what the API
    searches with now; `rankAsTyped` is the "before".
    """
    results = []
    for q, typed_vector, rewritten_vector, text in zip(
        questions, typed, rewritten, rewrites, strict=True
    ):
        typed_hits = search(typed_vector, course_id, TOP_K)
        hits = search(rewritten_vector, course_id, TOP_K)
        results.append(
            {
                "id": q.id,
                "rankAsTyped": first_hit_rank(q, [(d, p) for d, p, _ in typed_hits]),
                "rank": first_hit_rank(q, [(d, p) for d, p, _ in hits]),
                "rewritten": text,  # None (null) = kept as typed
                "top": _top(hits),
            }
        )
    return results


def score_off_topic(
    questions: list[Question], vectors: list[list[float]], course_id: str, search: Search
) -> list[dict]:
    """Off-topic questions: is the best match below the not-found threshold?

    The same test /v1/answer makes before calling the answer
    model, so "notFound" here means "the visitor would be
    told it's not in the course".
    """
    results = []
    for q, vector in zip(questions, vectors, strict=True):
        hits = search(vector, course_id, TOP_K)
        best = hits[0][2] if hits else 0.0
        results.append(
            {
                "id": q.id,
                "bestScore": round(best, 3),
                "notFound": best < NOT_FOUND_BELOW,
                "top": _top(hits),
            }
        )
    return results


def summarize_off_topic(results: list[dict], core: list[dict]) -> dict:
    """How many off-topic questions were "not found", and the margin.

    highestScore = the off-topic question that came closest
    to being answered; lowestCoreScore = the real question
    whose best match was weakest. A threshold between the two
    separates them; if they overlap, no threshold can.
    """
    core_best = [r["top"][0]["score"] for r in core if r["top"]]
    return {
        "n": len(results),
        "threshold": NOT_FOUND_BELOW,
        "notFound": sum(1 for r in results if r["notFound"]),
        "highestScore": max((r["bestScore"] for r in results), default=0.0),
        "lowestCoreScore": min(core_best, default=0.0),
        "questions": results,
    }


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
        "rewriting": f"{ANSWER_MODEL}, follow-ups only",
        "embedModel": EMBED_MODEL,
    }


def documents_needed(golden: GoldenSet) -> set[str]:
    """The documents the golden set's right pages are in.

    Off-topic questions have no document (""), so they're
    left out: otherwise "" would count as a document that
    isn't loaded, and every run would refuse.
    """
    return {q.document for q in golden.questions if q.kind != "off_topic"}


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
    rewrite: Rewriter,
    change: str,
    runs_path: Path,
    out: Callable[[str], None] = print,
) -> dict:
    start = time.perf_counter()
    core = [q for q in golden.questions if q.kind == "core"]
    follow_ups = [q for q in golden.questions if q.kind == "follow_up"]
    off_topic = [q for q in golden.questions if q.kind == "off_topic"]

    # 1. Rewrite each follow-up, exactly as the API would.
    rewrites: list[str | None] = []
    rewrite_tokens = 0
    for q in follow_ups:
        text, used = rewrite(q.history, q.question)
        rewrites.append(text)
        rewrite_tokens += used

    # 2. One embedding call for everything, and the SAME helper
    #    and model the live /v1/answer uses for a question (no
    #    "name · page" prefix: that's for passages). The order
    #    of `texts` is the order the vectors come back in.
    texts = (
        [q.question for q in core]
        + [q.question for q in follow_ups]
        + [text or q.question for q, text in zip(follow_ups, rewrites, strict=True)]
        + [q.question for q in off_topic]
    )
    embedded = embed_texts(client, texts)
    vectors = iter(embedded.vectors)

    def take(n: int) -> list[list[float]]:
        return [next(vectors) for _ in range(n)]

    # 3. Score each group on its own.
    results = score(GoldenSet(golden.course_id, core), take(len(core)), search)
    metrics = summarize(results)
    typed_vectors, rewritten_vectors = take(len(follow_ups)), take(len(follow_ups))
    fu_results = score_follow_ups(
        follow_ups, typed_vectors, rewritten_vectors, rewrites, golden.course_id, search
    )
    off_results = score_off_topic(off_topic, take(len(off_topic)), golden.course_id, search)

    def line(label: str, m: dict) -> str:
        return f"{label}: {m['value']:.2f} (95% interval {m['low']:.2f}-{m['high']:.2f})"

    def shown(rank: int | None) -> str:
        return f"rank {rank}" if rank else "MISS"

    out(f"Core ({len(results)}):")
    for r in results:
        found = f"rank {r['rank']}" if r["rank"] else "MISS (not in top 10)"
        out(f"  {r['id']:<10} {found}")
    for name, label in (("recall5", "recall@5"), ("mrr", "MRR")):
        out(line(label, metrics[name]))

    extra: dict = {}
    if fu_results:
        as_typed = summarize([{"rank": r["rankAsTyped"]} for r in fu_results])
        rewritten = summarize(fu_results)
        out(f"Follow-ups ({len(fu_results)}): as typed -> rewritten")
        for r in fu_results:
            ranks = f"{shown(r['rankAsTyped'])} -> {shown(r['rank'])}"
            out(f"  {r['id']:<10} {ranks}  {r['rewritten']!r}")
        out(line("  recall@5 as typed", as_typed["recall5"]))
        out(line("  recall@5 rewritten", rewritten["recall5"]))
        out(line("  MRR as typed", as_typed["mrr"]))
        out(line("  MRR rewritten", rewritten["mrr"]))
        extra["followUps"] = {
            "n": len(fu_results),
            "asTyped": as_typed,
            "rewritten": rewritten,
            "questions": fu_results,
        }
    if off_results:
        off = summarize_off_topic(off_results, results)
        out(f"Off-topic ({off['n']}): not found when the best match < {off['threshold']}")
        for r in off_results:
            verdict = "not found (right)" if r["notFound"] else "WOULD ANSWER"
            out(f"  {r['id']:<10} best {r['bestScore']:.3f}  {verdict}")
        out(
            f"  {off['notFound']}/{off['n']} not found; highest off-topic "
            f"{off['highestScore']:.3f} vs weakest core {off['lowestCoreScore']:.3f}"
        )
        extra["offTopic"] = off

    saved = append_run(
        runs_path,
        {
            "date": date.today().isoformat(),
            "change": change,
            "commit": git_commit(),
            "n": len(results),
            "metrics": metrics,
            "setup": setup(),
            # Embedding tokens and their cost. Rewrite tokens are
            # listed on their own: the answer model's price isn't
            # in the code, and a guessed cost would be made up.
            "tokens": embedded.tokens,
            "costUsd": round(embedded.tokens * EMBED_PRICE_PER_MILLION / 1_000_000, 6),
            "rewriteTokens": rewrite_tokens,
            "durationS": round(time.perf_counter() - start, 1),
            "questions": results,  # core only: n and metrics are about these
            **extra,
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
                if q.kind == "off_topic":
                    print(f"  {q.id:<10} off-topic: expect not found (< {NOT_FOUND_BELOW})")
                    continue
                pages = ", ".join(map(str, q.pages))
                after = f" (after: {q.history[-1].question!r})" if q.history else ""
                print(f"  {q.id:<10} {q.document} p. {pages}{after}")
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
            missing = documents_needed(golden) - {name for (name,) in rows}
            if missing:
                print(f"Refusing: not loaded in {target}: {', '.join(sorted(missing))}.")
                return 1

            def search(vector: list[float], course_id: str, k: int) -> list[Hit]:
                return conn.execute(MATCH_SQL, (vector_literal(vector), course_id, k)).fetchall()

            client = make_client(settings.openai_api_key.get_secret_value())

            def rewrite(history: tuple[Turn, ...], question: str) -> tuple[str | None, int]:
                # The API's own function, model and prompt.
                turns = [RewriteTurn(question=t.question, answer=t.answer) for t in history]
                return rewrite_question(client, ANSWER_MODEL, turns, question)

            run(
                golden,
                client=client,
                search=search,
                rewrite=rewrite,
                change=args.change.strip(),
                runs_path=args.runs,
            )
        return 0
    except (GoldenError, IngestError) as error:
        print(f"Error: {error}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
