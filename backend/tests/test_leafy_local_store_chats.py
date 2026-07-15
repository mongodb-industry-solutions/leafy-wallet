"""Integration tests for leafy-local-store's chat/chat-message HTTP API, run
against a real running instance (docker compose up -d ollama
objectbox-sync-server leafy-local-store). Not part of CI — these are for
local regression-checking only, and skip cleanly if the service isn't
reachable.

Records created here sync into the live chats/chatMessages Atlas
collections, so each test cleans up via DELETE /local/v1/chats/{id} (which
cascades to its messages), propagating the deletion through ObjectBox Sync
back to Atlas too.
"""

import uuid

import httpx
import pytest

BASE = "http://localhost:8090"


@pytest.fixture(scope="module", autouse=True)
def _require_leafy_local_store():
    try:
        response = httpx.get(f"{BASE}/local/v1/health", timeout=2.0)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        pytest.skip(f"leafy-local-store not reachable at {BASE}: {exc}")


def _unique(prefix):
    return f"{prefix}-{uuid.uuid4()}"


@pytest.fixture
def chat_id():
    created = httpx.post(f"{BASE}/local/v1/chats", json={"title": _unique("test chat")})
    assert created.status_code == 201
    chat_id = created.json()["id"]
    yield chat_id
    httpx.delete(f"{BASE}/local/v1/chats/{chat_id}")


def test_health_returns_chat_counts():
    response = httpx.get(f"{BASE}/local/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"
    assert "chat_count" in body
    assert "chat_message_count" in body


def test_chat_create_matches_local_id():
    created = httpx.post(f"{BASE}/local/v1/chats", json={"title": _unique("test chat")})
    assert created.status_code == 201
    body = created.json()
    # localId mirrors ObjectBox's own `id` as a plain (non-PK) field, since
    # the PK doesn't survive the Sync Server's bridge to Atlas — see
    # local_store_service.cpp's LocalChat struct comment.
    assert body["localId"] == body["id"]
    httpx.delete(f"{BASE}/local/v1/chats/{body['id']}")


def test_chat_create_list_and_delete():
    created = httpx.post(f"{BASE}/local/v1/chats", json={"title": _unique("test chat")})
    assert created.status_code == 201
    chat_id = created.json()["id"]

    try:
        listed = httpx.get(f"{BASE}/local/v1/chats")
        assert listed.status_code == 200
        assert any(c["id"] == chat_id for c in listed.json())
    finally:
        deleted = httpx.delete(f"{BASE}/local/v1/chats/{chat_id}")
        assert deleted.status_code == 204

    deleted_again = httpx.delete(f"{BASE}/local/v1/chats/{chat_id}")
    assert deleted_again.status_code == 404


def test_delete_unknown_chat_returns_404():
    response = httpx.delete(f"{BASE}/local/v1/chats/999999999")
    assert response.status_code == 404


def test_get_messages_for_unknown_chat_returns_404():
    response = httpx.get(f"{BASE}/local/v1/chats/999999999/messages")
    assert response.status_code == 404


def test_create_message_for_unknown_chat_returns_404():
    response = httpx.post(
        f"{BASE}/local/v1/chats/999999999/messages", json={"role": "user", "text": "hi"}
    )
    assert response.status_code == 404


def test_chat_message_create_list_and_delete(chat_id):
    created = httpx.post(
        f"{BASE}/local/v1/chats/{chat_id}/messages",
        json={"role": "user", "text": "hello from the test suite"},
    )
    assert created.status_code == 201
    body = created.json()
    message_id = body["id"]
    assert body["chatId"] == chat_id
    assert body["role"] == "user"

    listed = httpx.get(f"{BASE}/local/v1/chats/{chat_id}/messages")
    assert listed.status_code == 200
    assert any(m["id"] == message_id for m in listed.json())

    deleted = httpx.delete(f"{BASE}/local/v1/chats/{chat_id}/messages/{message_id}")
    assert deleted.status_code == 204

    listed_after = httpx.get(f"{BASE}/local/v1/chats/{chat_id}/messages")
    assert all(m["id"] != message_id for m in listed_after.json())

    deleted_again = httpx.delete(f"{BASE}/local/v1/chats/{chat_id}/messages/{message_id}")
    assert deleted_again.status_code == 404


def test_create_message_missing_required_field_returns_400(chat_id):
    response = httpx.post(f"{BASE}/local/v1/chats/{chat_id}/messages", json={"role": "user"})
    assert response.status_code == 400


def test_create_message_invalid_role_returns_400(chat_id):
    response = httpx.post(
        f"{BASE}/local/v1/chats/{chat_id}/messages", json={"role": "bot", "text": "hi"}
    )
    assert response.status_code == 400


def test_delete_message_from_wrong_chat_returns_404(chat_id):
    other_created = httpx.post(f"{BASE}/local/v1/chats", json={"title": _unique("other chat")})
    other_chat_id = other_created.json()["id"]

    try:
        message = httpx.post(
            f"{BASE}/local/v1/chats/{chat_id}/messages", json={"role": "user", "text": "mine"}
        ).json()

        response = httpx.delete(f"{BASE}/local/v1/chats/{other_chat_id}/messages/{message['id']}")
        assert response.status_code == 404
    finally:
        httpx.delete(f"{BASE}/local/v1/chats/{other_chat_id}")


def test_delete_chat_cascades_its_messages(chat_id):
    httpx.post(f"{BASE}/local/v1/chats/{chat_id}/messages", json={"role": "user", "text": "hi"})
    before = httpx.get(f"{BASE}/local/v1/health").json()["chat_message_count"]

    deleted = httpx.delete(f"{BASE}/local/v1/chats/{chat_id}")
    assert deleted.status_code == 204

    after = httpx.get(f"{BASE}/local/v1/health").json()["chat_message_count"]
    assert after == before - 1
