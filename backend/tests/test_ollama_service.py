import asyncio

import httpx

from services import ollama


class FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self._payload


def test_get_embedding_returns_vector_on_success(monkeypatch):
    captured = {}

    async def fake_post(self, url, json):
        captured["url"] = url
        captured["json"] = json
        return FakeResponse({"embeddings": [[0.1, 0.2, 0.3]]})

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    result = asyncio.run(ollama.get_embedding("Dinner split"))

    assert result == [0.1, 0.2, 0.3]
    assert captured["url"] == f"{ollama.OLLAMA_BASE_URL}/api/embed"
    assert captured["json"] == {"model": ollama.OLLAMA_EMBEDDING_MODEL, "input": "Dinner split"}


def test_get_embedding_returns_none_when_ollama_unreachable(monkeypatch):
    async def fake_post(self, url, json):
        raise httpx.ConnectError("connection refused", request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    result = asyncio.run(ollama.get_embedding("Dinner split"))

    assert result is None
