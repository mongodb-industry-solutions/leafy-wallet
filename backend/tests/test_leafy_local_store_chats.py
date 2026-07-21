"""Integration tests for leafy-local-store's chat/chat-message HTTP API, run
against a real running instance (docker compose up -d ollama
objectbox-sync-server leafy-local-store). Not part of CI - these are for
local regression-checking only, and skip cleanly if the service isn't
reachable.

Records created here sync into the live chats/chatMessages Atlas
collections, so each test cleans up via DELETE
/local/v1/chats/{chatReference} (which cascades to its messages),
propagating the deletion through ObjectBox Sync back to Atlas too.
"""

import uuid

import httpx
import pytest

from tests.conftest import LOCAL_STORE_BASE as BASE, unique as _unique

pytestmark = pytest.mark.usefixtures("require_leafy_local_store")






def _create_chat(**overrides):
    payload = {
        "title": _unique("test chat"),
        "ownerPartyRef": _unique("test-owner"),
        "chatReference": _unique("test-chat-ref"),
        **overrides,
    }
    created = httpx.post(f"{BASE}/local/v1/chats", json=payload)
    return created, payload


@pytest.fixture
def chat():
    created, payload = _create_chat()
    assert created.status_code == 201
    yield created.json(), payload
    httpx.delete(f"{BASE}/local/v1/chats/{payload['chatReference']}")


def test_health_returns_chat_counts():
    response = httpx.get(f"{BASE}/local/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"
    assert "chat_count" in body
    assert "chat_message_count" in body


def test_chat_create_matches_local_id():
    created, payload = _create_chat()
    assert created.status_code == 201
    body = created.json()
    # localId mirrors ObjectBox's own `id` as a plain (non-PK) field, since
    # the PK doesn't survive the Sync Server's bridge to Atlas - see
    # local_store_service.cpp's LocalChat struct comment.
    assert body["localId"] == body["id"]
    httpx.delete(f"{BASE}/local/v1/chats/{payload['chatReference']}")


def test_chat_round_trips_its_owner_and_reference(chat):
    body, payload = chat
    assert body["ownerPartyRef"] == payload["ownerPartyRef"]
    assert body["chatReference"] == payload["chatReference"]


def test_chat_without_a_reference_gets_one_minted():
    """chatReference is the join key for messages, so a chat is never without one."""
    created = httpx.post(f"{BASE}/local/v1/chats", json={"title": _unique("test chat")})
    assert created.status_code == 201
    body = created.json()
    try:
        assert body["chatReference"]
        assert body["ownerPartyRef"] is None
    finally:
        httpx.delete(f"{BASE}/local/v1/chats/{body['chatReference']}")


def test_chat_is_listed_for_its_owner_only(chat):
    body, payload = chat

    mine = httpx.get(f"{BASE}/local/v1/chats", params={"ownerPartyRef": payload["ownerPartyRef"]})
    assert mine.status_code == 200
    assert [c["chatReference"] for c in mine.json()] == [payload["chatReference"]]

    stranger = httpx.get(
        f"{BASE}/local/v1/chats", params={"ownerPartyRef": _unique("test-owner-stranger")}
    ).json()
    assert all(c["chatReference"] != payload["chatReference"] for c in stranger)


def test_chat_create_list_and_delete():
    created, payload = _create_chat()
    assert created.status_code == 201
    chat_reference = payload["chatReference"]

    try:
        listed = httpx.get(f"{BASE}/local/v1/chats")
        assert listed.status_code == 200
        assert any(c["chatReference"] == chat_reference for c in listed.json())
    finally:
        deleted = httpx.delete(f"{BASE}/local/v1/chats/{chat_reference}")
        assert deleted.status_code == 204

    deleted_again = httpx.delete(f"{BASE}/local/v1/chats/{chat_reference}")
    assert deleted_again.status_code == 404


def test_delete_unknown_chat_returns_404():
    response = httpx.delete(f"{BASE}/local/v1/chats/{_unique('test-chat-ref-unknown')}")
    assert response.status_code == 404


def test_get_messages_for_unknown_chat_returns_404():
    response = httpx.get(f"{BASE}/local/v1/chats/{_unique('test-chat-ref-unknown')}/messages")
    assert response.status_code == 404


def test_create_message_for_unknown_chat_returns_404():
    response = httpx.post(
        f"{BASE}/local/v1/chats/{_unique('test-chat-ref-unknown')}/messages",
        json={"role": "user", "text": "hi"},
    )
    assert response.status_code == 404


def test_chat_message_create_list_and_delete(chat):
    _, payload = chat
    chat_reference = payload["chatReference"]

    created = httpx.post(
        f"{BASE}/local/v1/chats/{chat_reference}/messages",
        json={"role": "user", "text": "hello from the test suite"},
    )
    assert created.status_code == 201
    body = created.json()
    message_id = body["id"]
    assert body["chatReference"] == chat_reference
    assert body["role"] == "user"

    listed = httpx.get(f"{BASE}/local/v1/chats/{chat_reference}/messages")
    assert listed.status_code == 200
    assert any(m["id"] == message_id for m in listed.json())

    deleted = httpx.delete(f"{BASE}/local/v1/chats/{chat_reference}/messages/{message_id}")
    assert deleted.status_code == 204

    listed_after = httpx.get(f"{BASE}/local/v1/chats/{chat_reference}/messages")
    assert all(m["id"] != message_id for m in listed_after.json())

    deleted_again = httpx.delete(f"{BASE}/local/v1/chats/{chat_reference}/messages/{message_id}")
    assert deleted_again.status_code == 404


def test_posting_a_message_bumps_the_chats_updated_at(chat):
    body, payload = chat
    posted = httpx.post(
        f"{BASE}/local/v1/chats/{payload['chatReference']}/messages",
        json={"role": "user", "text": "hi"},
    )
    assert posted.status_code == 201

    listed = httpx.get(
        f"{BASE}/local/v1/chats", params={"ownerPartyRef": payload["ownerPartyRef"]}
    ).json()
    assert listed[0]["updatedAt"] > body["updatedAt"]


def test_create_message_missing_required_field_returns_400(chat):
    _, payload = chat
    response = httpx.post(
        f"{BASE}/local/v1/chats/{payload['chatReference']}/messages", json={"role": "user"}
    )
    assert response.status_code == 400


def test_create_message_invalid_role_returns_400(chat):
    _, payload = chat
    response = httpx.post(
        f"{BASE}/local/v1/chats/{payload['chatReference']}/messages",
        json={"role": "bot", "text": "hi"},
    )
    assert response.status_code == 400


def test_delete_message_from_wrong_chat_returns_404(chat):
    _, payload = chat
    other_created, other_payload = _create_chat()
    assert other_created.status_code == 201

    try:
        message = httpx.post(
            f"{BASE}/local/v1/chats/{payload['chatReference']}/messages",
            json={"role": "user", "text": "mine"},
        ).json()

        response = httpx.delete(
            f"{BASE}/local/v1/chats/{other_payload['chatReference']}/messages/{message['id']}"
        )
        assert response.status_code == 404
    finally:
        httpx.delete(f"{BASE}/local/v1/chats/{other_payload['chatReference']}")


def test_messages_are_scoped_to_their_own_chat(chat):
    """The join key is chatReference, so a sibling chat's messages never leak in."""
    _, payload = chat
    other_created, other_payload = _create_chat()
    assert other_created.status_code == 201

    try:
        httpx.post(
            f"{BASE}/local/v1/chats/{payload['chatReference']}/messages",
            json={"role": "user", "text": "mine"},
        )
        httpx.post(
            f"{BASE}/local/v1/chats/{other_payload['chatReference']}/messages",
            json={"role": "user", "text": "theirs"},
        )

        mine = httpx.get(f"{BASE}/local/v1/chats/{payload['chatReference']}/messages").json()
        assert [m["text"] for m in mine] == ["mine"]
    finally:
        httpx.delete(f"{BASE}/local/v1/chats/{other_payload['chatReference']}")


def test_delete_chat_cascades_its_messages(chat):
    _, payload = chat
    httpx.post(
        f"{BASE}/local/v1/chats/{payload['chatReference']}/messages",
        json={"role": "user", "text": "hi"},
    )
    before = httpx.get(f"{BASE}/local/v1/health").json()["chat_message_count"]

    deleted = httpx.delete(f"{BASE}/local/v1/chats/{payload['chatReference']}")
    assert deleted.status_code == 204

    after = httpx.get(f"{BASE}/local/v1/health").json()["chat_message_count"]
    assert after == before - 1
