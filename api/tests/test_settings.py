"""Tests for Settings.

_env_file=None stops pydantic-settings from reading a
real api/.env on your laptop, so the tests only see
the variables they set themselves.
"""

import pytest
from pydantic import ValidationError

from recall_api.settings import Settings

ALL_SET = {
    "SUPABASE_URL": "https://example.supabase.co",
    "SUPABASE_PUBLISHABLE_KEY": "sb_publishable_test",
    "OPENAI_API_KEY": "sk-test-not-real",
    "INTERNAL_KEY": "internal-test-not-real",
}


def set_env(monkeypatch, values):
    for name, value in values.items():
        monkeypatch.setenv(name, value)


def test_reads_values_from_the_environment(monkeypatch):
    set_env(monkeypatch, ALL_SET)

    settings = Settings(_env_file=None)

    assert settings.supabase_url == "https://example.supabase.co"
    assert settings.openai_api_key.get_secret_value() == "sk-test-not-real"
    # Not set, so the default applies.
    assert settings.openai_answer_model == "gpt-5.4-mini"


def test_secrets_are_hidden_when_printed(monkeypatch):
    set_env(monkeypatch, ALL_SET)

    shown = repr(Settings(_env_file=None))

    assert "sk-test-not-real" not in shown
    assert "internal-test-not-real" not in shown


def test_a_missing_secret_fails_at_startup(monkeypatch):
    set_env(monkeypatch, ALL_SET)
    monkeypatch.delenv("OPENAI_API_KEY")

    with pytest.raises(ValidationError):
        Settings(_env_file=None)
