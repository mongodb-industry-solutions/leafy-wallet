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


def _capturing_post(captured, payload=None):
    async def fake_post(self, url, json=None, headers=None):
        captured["url"] = url
        captured["json"] = json
        captured["headers"] = headers
        return FakeResponse(payload or {"data": [{"index": 0, "embedding": [0.1, 0.2, 0.3]}]})

    return fake_post


def test_get_embedding_returns_vector_on_success(monkeypatch):
    captured = {}
    monkeypatch.setattr(httpx.AsyncClient, "post", _capturing_post(captured))

    result = asyncio.run(embeddings.get_embedding("Dinner split"))

    assert result == [0.1, 0.2, 0.3]
    assert captured["url"] == f"{embeddings.EMBEDDINGS_URL}/v1/embeddings"
    assert captured["json"] == {
        "model": embeddings.EMBEDDING_MODEL,
        "input": ["Dinner split"],
        "input_type": "document",
        "output_dimension": embeddings.EMBEDDING_DIMENSIONS,
    }


# Voyage embeds queries and stored text asymmetrically, so the search path has to say which it is.
def test_input_type_reaches_the_provider(monkeypatch):
    captured = {}
    monkeypatch.setattr(httpx.AsyncClient, "post", _capturing_post(captured))

    asyncio.run(embeddings.get_embedding("coffee", input_type="query"))

    assert captured["json"]["input_type"] == "query"


# The local leafy-embed container serves the same contract without authentication.
def test_no_authorization_header_when_no_key_is_configured(monkeypatch):
    captured = {}
    monkeypatch.setattr(httpx.AsyncClient, "post", _capturing_post(captured))
    monkeypatch.delenv("VOYAGE_API_KEY", raising=False)

    asyncio.run(embeddings.get_embedding("Dinner split"))

    assert captured["headers"] is None


def test_bearer_key_is_sent_when_configured(monkeypatch):
    captured = {}
    monkeypatch.setattr(httpx.AsyncClient, "post", _capturing_post(captured))
    monkeypatch.setenv("VOYAGE_API_KEY", "unit-test-value")

    asyncio.run(embeddings.get_embedding("Dinner split"))

    assert captured["headers"] == {"Authorization": "Bearer unit-test-value"}


def test_get_embedding_returns_none_when_provider_unreachable(monkeypatch):
    async def fake_post(self, url, json=None, headers=None):
        raise httpx.ConnectError("connection refused", request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    assert asyncio.run(embeddings.get_embedding("Dinner split")) is None


def test_get_embedding_returns_none_on_http_status_error(monkeypatch):
    async def fake_post(self, url, json=None, headers=None):
        return httpx.Response(status_code=500, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)

    assert asyncio.run(embeddings.get_embedding("Dinner split")) is None


def test_get_embedding_returns_none_on_unexpected_payload(monkeypatch):
    captured = {}
    monkeypatch.setattr(httpx.AsyncClient, "post", _capturing_post(captured, payload={"data": []}))

    assert asyncio.run(embeddings.get_embedding("Dinner split")) is None


# Pins the literal, since the ObjectBox HNSW index and the Atlas index are built from it. The
# request carrying it is already covered above.
def test_indexed_vector_width_is_1024():
    assert embeddings.EMBEDDING_DIMENSIONS == 1024
