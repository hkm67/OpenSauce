import importlib
import json
import sys
from io import BytesIO
from unittest.mock import patch


def _fresh_llm():
    sys.modules.pop("src.llm", None)
    return importlib.import_module("src.llm")


def _fake_response(payload):
    body = json.dumps(payload).encode("utf-8")
    return BytesIO(body)


def test_chat_returns_none_when_key_missing(monkeypatch):
    monkeypatch.delenv("CLOD_API_KEY", raising=False)
    llm = _fresh_llm()
    assert llm.chat([{"role": "user", "content": "hi"}]) is None
    assert llm.is_enabled() is False


def test_chat_extracts_assistant_message(monkeypatch):
    monkeypatch.setenv("CLOD_API_KEY", "test-key")
    llm = _fresh_llm()
    fake = _fake_response(
        {"choices": [{"message": {"role": "assistant", "content": "hello there"}}]}
    )

    with patch.object(llm, "urlopen", return_value=fake) as mock_open:
        result = llm.chat([{"role": "user", "content": "hi"}])

    assert result == "hello there"
    request = mock_open.call_args[0][0]
    assert request.headers["Authorization"] == "Bearer test-key"
    assert "/chat/completions" in request.full_url


def test_chat_json_parses_object(monkeypatch):
    monkeypatch.setenv("CLOD_API_KEY", "test-key")
    llm = _fresh_llm()
    fake = _fake_response(
        {"choices": [{"message": {"content": '{"answer": 42}'}}]}
    )

    with patch.object(llm, "urlopen", return_value=fake):
        assert llm.chat_json([{"role": "user", "content": "x"}]) == {"answer": 42}


def test_chat_swallows_http_errors(monkeypatch):
    monkeypatch.setenv("CLOD_API_KEY", "test-key")
    llm = _fresh_llm()

    def boom(*_args, **_kwargs):
        raise OSError("connection refused")

    with patch.object(llm, "urlopen", side_effect=boom):
        assert llm.chat([{"role": "user", "content": "x"}]) is None
