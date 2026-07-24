import asyncio

import httpx

from services import embeddings


class FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self._payload


def test_get_embedding_returns_vector_on_success(monkeypatch):
    captured = {}

    async def fake_post(self, url, json=None, headers=None):
        captured["url"] = url
        captured["json"] = json
        return FakeResponse({"embeddings": [[0.1, 0.2, 0.3]]})

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    result = asyncio.run(embeddings.get_embedding("Dinner split"))

    assert result == [0.1, 0.2, 0.3]
    assert captured["url"] == f"{embeddings.OLLAMA_BASE_URL}/api/embed"
    assert captured["json"] == {
        "model": embeddings.OLLAMA_EMBEDDING_MODEL,
        "input": "Dinner split",
    }


def test_get_embedding_returns_none_when_ollama_unreachable(monkeypatch):
    async def fake_post(self, url, json=None, headers=None):
        raise httpx.ConnectError("connection refused", request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    assert asyncio.run(embeddings.get_embedding("Dinner split")) is None


def test_get_embedding_returns_none_on_http_status_error(monkeypatch):
    async def fake_post(self, url, json=None, headers=None):
        return httpx.Response(status_code=500, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    assert asyncio.run(embeddings.get_embedding("Dinner split")) is None


# Deployed pods run no Ollama container, so anything but APP_ENV=local has to reach Voyage instead.
def test_deployed_calls_voyage_with_the_bearer_key_and_matching_width(monkeypatch):
    captured = {}

    async def fake_post(self, url, json=None, headers=None):
        captured["url"] = url
        captured["json"] = json
        captured["headers"] = headers
        return FakeResponse({"data": [{"index": 0, "embedding": [0.4, 0.5]}]})

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    monkeypatch.setenv("APP_ENV", "staging")
    monkeypatch.setenv("VOYAGE_API_KEY", "unit-test-value")

    result = asyncio.run(embeddings.get_embedding("Dinner split"))

    assert result == [0.4, 0.5]
    assert captured["url"] == embeddings.VOYAGE_URL
    assert captured["headers"] == {"Authorization": "Bearer unit-test-value"}
    assert captured["json"]["input"] == ["Dinner split"]
    assert captured["json"]["output_dimension"] == embeddings.VOYAGE_DIMENSIONS


def test_deployed_without_a_key_degrades_instead_of_raising(monkeypatch):
    async def fake_post(self, url, json=None, headers=None):
        raise AssertionError("must not call out with no key configured")

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    monkeypatch.setenv("APP_ENV", "prod")
    monkeypatch.delenv("VOYAGE_API_KEY", raising=False)

    assert asyncio.run(embeddings.get_embedding("Dinner split")) is None


def test_dimensions_follow_the_environment(monkeypatch):
    # The ObjectBox HNSW index and the Atlas index are both built from this.
    assert embeddings.embedding_dimensions() == embeddings.LOCAL_DIMENSIONS
    monkeypatch.setenv("APP_ENV", "staging")
    assert embeddings.embedding_dimensions() == embeddings.VOYAGE_DIMENSIONS
