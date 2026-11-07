"""Settings: every value the service needs from its environment.

pydantic-settings reads them from environment variables
(how AWS will pass them) or from api/.env (on your
laptop; gitignored). Each field's type is checked when
Settings() is created, so a missing or malformed value
fails loudly at startup instead of halfway through a
request.
"""

from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        # Ignore other variables in .env instead of failing.
        extra="ignore",
    )

    # Which Supabase project: staging or production.
    # Field names match the variables case-insensitively,
    # so SUPABASE_URL fills supabase_url.
    supabase_url: str

    # The publishable key (sb_publishable_...). Public by
    # design: RLS still applies, because every request
    # also carries the visitor's own token (decision D1).
    # NEVER the secret key.
    supabase_publishable_key: str

    # SecretStr: printing or logging the settings shows
    # '**********', not the value. Read it on purpose
    # with .get_secret_value().
    openai_api_key: SecretStr

    # Shared with Next.js only: proves a request came
    # from our route handler, not from someone who
    # found the URL (decision D2).
    internal_key: SecretStr

    # One env var to swap the answer model (a ready-made
    # Dyno experiment later).
    openai_answer_model: str = "gpt-5.4-mini"


@lru_cache
def get_settings() -> Settings:
    """Build Settings once, then reuse it.

    Called by the endpoints that need it (Phase 4), not at
    import time, so `/health` and the tests work without
    any secrets set.
    """
    return Settings()
