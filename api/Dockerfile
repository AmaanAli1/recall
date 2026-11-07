# The API's container image. Written in Phase 2, first
# built in Phase 5 (Docker Desktop / AWS).
#
# Two stages: "builder" has uv and installs the
# dependencies; the final image copies only the
# finished virtual environment, so uv and build
# leftovers never ship.

# ---------- Stage 1: install ----------
FROM python:3.12-slim AS builder

# uv comes as a ready-made binary from its own image.
COPY --from=ghcr.io/astral-sh/uv:0.11 /uv /bin/uv

# Compile .py files now (faster start), copy files
# instead of linking, and use the image's Python
# instead of downloading another one.
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

WORKDIR /app

# Dependencies first, on their own layer: as long as
# pyproject.toml and uv.lock don't change, Docker
# reuses this layer and rebuilds take seconds.
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

# Then our own code.
COPY README.md ./
COPY src ./src
RUN uv sync --locked --no-dev

# ---------- Stage 2: run ----------
FROM python:3.12-slim

# A normal user: if the app were ever compromised, it
# wouldn't be root inside the container.
RUN useradd --create-home --uid 10001 app

COPY --from=builder --chown=app:app /app /app
ENV PATH="/app/.venv/bin:$PATH"

USER app
WORKDIR /app
EXPOSE 8000

# 0.0.0.0 = accept connections from outside the
# container (the load balancer); 127.0.0.1 wouldn't.
CMD ["uvicorn", "recall_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
