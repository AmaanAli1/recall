# dyno

Recall's evaluation harness. v0 measures **retrieval only**: for each golden
question, where does a chunk from the right page land in `match_chunks()`'s
ranking? It reports recall@5 and MRR@10 with 95% bootstrap intervals.

- `golden.toml`: the golden set (questions + the pages that answer them).
  Fixed once a run uses it: add new questions as new ids, never reword one
  to raise a score.
- Code: `api/src/recall_api/dyno/` (loader, metrics) and
  `api/src/recall_api/scripts/dyno_run.py` (the run), tested in
  `api/tests/test_dyno_*.py`.
- Results: `web/src/data/dyno-runs.json` (one entry per run, appended; run 1
  is the baseline). `/dyno` reads it at build time.

Run from `api/` on the laptop (read-only connection, same `--ref` check as
the ingest script):

    uv run python -m recall_api.scripts.dyno_run --dry-run
    uv run python -m recall_api.scripts.dyno_run --ref <project-ref> --change "Baseline"

Planned for v1: faithfulness and correctness (LLM-as-judge), a paired
bootstrap to compare runs, the CI redline gate.
