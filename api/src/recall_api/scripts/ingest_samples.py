"""Load the sample PDFs (api/samples.toml) into Supabase.

Run from the api/ folder, on Amaan's laptop only:

    uv run python -m recall_api.scripts.ingest_samples --dry-run
    uv run python -m recall_api.scripts.ingest_samples --ref <project-ref>

--dry-run reads and chunks every PDF and prints what it
would load, with no OpenAI call and no database.
--ref must match the project in ADMIN_DATABASE_URL, the
same habit as checking supabase/.temp/project-ref before
`db push`: you say which database you mean, and the
script refuses if the connection string disagrees.

Why a script with an admin connection (decision D1):
sample rows have session_id = NULL, which no visitor can
write. This is the only code that uses admin rights, and
it never runs anywhere but here.
"""

import argparse
import hashlib
import re
import sys
import tomllib
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

from recall_api.ingest.chunk import Chunk, chunk_document, embedding_input
from recall_api.ingest.embed import EmbeddingsClient, embed_texts, make_client
from recall_api.ingest.pdf import read_pdf

# This file is api/src/recall_api/scripts/ingest_samples.py,
# so three folders up is api/.
API_DIR = Path(__file__).resolve().parents[3]
EMBED_PRICE_PER_MILLION = 0.02  # text-embedding-3-small, USD


class IngestError(Exception):
    """Something wrong with the inputs; the message says what."""


@dataclass(frozen=True)
class SampleDoc:
    course_id: str
    file: str  # file name inside api/samples/
    name: str  # display name, shown in citations
    source_url: str
    license: str
    sha256: str  # of the file's bytes, lowercase hex


class ScriptSettings(BaseSettings):
    """Only this script needs these, so the server never asks for them."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Supabase → Connect → Session pooler (port 5432), with
    # the database password filled in. Admin rights.
    admin_database_url: SecretStr
    openai_api_key: SecretStr


# ---------- Inputs ----------


def load_manifest(path: Path) -> list[SampleDoc]:
    try:
        raw = tomllib.loads(path.read_text(encoding="utf-8"))
    except (OSError, tomllib.TOMLDecodeError) as error:
        raise IngestError(f"Couldn't read {path}: {error}") from error

    docs = []
    for i, entry in enumerate(raw.get("document", []), start=1):
        try:
            doc = SampleDoc(**entry)
        except TypeError as error:  # a missing or unknown field
            raise IngestError(f"document {i} in {path.name}: {error}") from error
        try:
            uuid.UUID(doc.course_id)
        except ValueError as error:
            raise IngestError(f"{doc.name}: course_id isn't a uuid") from error
        if not re.fullmatch(r"[0-9a-f]{64}", doc.sha256.lower()):
            raise IngestError(f"{doc.name}: sha256 must be 64 hex characters")
        docs.append(doc)
    if not docs:
        raise IngestError(f"{path.name} lists no [[document]] entries")
    return docs


def read_sample(doc: SampleDoc, samples_dir: Path) -> bytes:
    """The file's bytes, after checking they're the file we listed."""
    path = samples_dir / doc.file
    try:
        data = path.read_bytes()
    except OSError as error:
        raise IngestError(f"{doc.name}: can't open {path}") from error
    actual = hashlib.sha256(data).hexdigest()
    # Lowercase both: PowerShell's Get-FileHash prints uppercase.
    if actual != doc.sha256.lower():
        raise IngestError(f"{doc.name}: sha256 is {actual}, samples.toml says {doc.sha256}")
    return data


def project_ref(database_url: str) -> str | None:
    """The Supabase project ref inside a connection string.

    Pooler URLs carry it in the user name (postgres.<ref>@…),
    direct ones in the host (db.<ref>.supabase.co).
    """
    match = re.search(r"postgres\.([a-z0-9]{20})[:@]", database_url) or re.search(
        r"db\.([a-z0-9]{20})\.supabase\.co", database_url
    )
    return match.group(1) if match else None


def vector_literal(vector: list[float]) -> str:
    """pgvector's text form, e.g. '[0.1,-0.2,…]'. Cast in SQL with ::extensions.vector."""
    return "[" + ",".join(repr(float(x)) for x in vector) + "]"


# ---------- Database ----------

ALREADY_LOADED_SQL = """
select 1 from public.documents
 where course_id = %s and session_id is null and sha256 = %s
"""

INSERT_DOCUMENT_SQL = """
insert into public.documents (course_id, session_id, name, pages, sha256, status)
values (%s, null, %s, %s, %s, 'ready')
returning id
"""

INSERT_CHUNK_SQL = """
insert into public.chunks (document_id, page, chunk_index, content, token_count, embedding)
values (%s, %s, %s, %s, %s, %s::extensions.vector)
"""


def already_loaded(conn, doc: SampleDoc) -> bool:
    row = conn.execute(ALREADY_LOADED_SQL, (doc.course_id, doc.sha256.lower())).fetchone()
    return row is not None


def save_document(conn, doc: SampleDoc, pages: int, chunks: list[Chunk], vectors) -> None:
    """The document and all its chunks, in ONE transaction:
    if anything fails, nothing is saved (no half-loaded PDFs)."""
    with conn.transaction():
        (document_id,) = conn.execute(
            INSERT_DOCUMENT_SQL, (doc.course_id, doc.name, pages, doc.sha256.lower())
        ).fetchone()
        with conn.cursor() as cur:
            cur.executemany(
                INSERT_CHUNK_SQL,
                [
                    (document_id, c.page, c.index, c.text, c.tokens, vector_literal(v))
                    for c, v in zip(chunks, vectors, strict=True)
                ],
            )


# ---------- The run ----------


def run(
    docs: list[SampleDoc],
    samples_dir: Path,
    *,
    conn=None,
    client: EmbeddingsClient | None = None,
    out: Callable[[str], None] = print,
) -> None:
    """Parse, chunk and (unless conn is None: dry run) embed + save each document."""
    dry_run = conn is None
    total_tokens = 0
    for doc in docs:
        pages = read_pdf(read_sample(doc, samples_dir))
        chunks = chunk_document(pages)
        if not chunks:
            raise IngestError(f"{doc.name}: no text found (a scanned PDF needs OCR first)")
        estimate = sum(c.tokens for c in chunks)
        dropped = sum(p.unreadable for p in pages)
        out(
            f"{doc.name}: {len(pages)} pages -> {len(chunks)} chunks "
            f"(~{estimate:,} tokens, {dropped} unreadable characters dropped)"
        )

        if dry_run:
            first = chunks[0]
            out(f"    first chunk, page {first.page}: {first.text[:100]!r}")
            total_tokens += estimate
            continue

        if already_loaded(conn, doc):
            out("    already loaded, skipped")
            continue
        assert client is not None
        embedded = embed_texts(client, [embedding_input(doc.name, c) for c in chunks])
        save_document(conn, doc, len(pages), chunks, embedded.vectors)
        total_tokens += embedded.tokens
        out(f"    saved ({embedded.tokens:,} tokens embedded)")

    cost = total_tokens * EMBED_PRICE_PER_MILLION / 1_000_000
    label = "would embed about" if dry_run else "embedded"
    out(f"Done: {label} {total_tokens:,} tokens (~${cost:.4f}).")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Load the sample PDFs into Supabase.")
    parser.add_argument("--dry-run", action="store_true", help="parse and chunk only")
    parser.add_argument("--ref", help="the project ref you mean to write to")
    parser.add_argument("--manifest", type=Path, default=API_DIR / "samples.toml")
    parser.add_argument("--samples", type=Path, default=API_DIR / "samples")
    args = parser.parse_args(argv)

    try:
        docs = load_manifest(args.manifest)
        if args.dry_run:
            run(docs, args.samples)
            return 0

        settings = ScriptSettings()
        url = settings.admin_database_url.get_secret_value()
        target = project_ref(url)
        if args.ref is None or args.ref != target:
            print(f"Refusing: ADMIN_DATABASE_URL points at {target!r}, but --ref is {args.ref!r}.")
            return 2
        print(f"Writing to project {target}.")

        import psycopg  # only needed for a real run

        client = make_client(settings.openai_api_key.get_secret_value())
        # autocommit=True: each document's own transaction
        # (in save_document) commits by itself, so a failure
        # on document 3 doesn't undo documents 1 and 2.
        # prepare_threshold=None: no server-side prepared
        # statements, which poolers can't always keep.
        with psycopg.connect(url, autocommit=True, prepare_threshold=None) as conn:
            run(docs, args.samples, conn=conn, client=client)
        return 0
    except IngestError as error:
        print(f"Error: {error}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
