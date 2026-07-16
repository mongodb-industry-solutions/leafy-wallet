import time
from datetime import datetime, timezone

import pytest
from bson import ObjectId

from db.client import get_db

BASE = "/api/v1/chat-messages"

OWNER = "chat-message-test-owner"
UNKNOWN_CHAT_REFERENCE = "00000000-0000-0000-0000-000000000000"


@pytest.fixture
def chat(client):
    chat = client.post(
        "/api/v1/chats", json={"ownerPartyRef": OWNER, "title": "Test conversation"}
    ).json()
    yield chat
    client.delete(f"/api/v1/chats/{chat['_id']}")


def _message_payload(chat, text="hello", role="user"):
    return {
        "chatId": chat["_id"],
        "chatReference": chat["chatReference"],
        "role": role,
        "text": text,
    }


def test_chat_message_crud_lifecycle(client, chat):
    payload = _message_payload(chat, text="Split the dinner bill with Maria")
    created = client.post(f"{BASE}", json=payload)
    assert created.status_code == 201
    body = created.json()
    message_id = body["_id"]
    assert body["chatId"] == chat["_id"]
    assert body["chatReference"] == chat["chatReference"]
    assert body["role"] == "user"
    assert body["text"] == "Split the dinner bill with Maria"

    fetched = client.get(f"{BASE}/{message_id}")
    assert fetched.status_code == 200
    assert fetched.json()["text"] == "Split the dinner bill with Maria"

    listed = client.get(f"{BASE}", params={"chatId": chat["_id"]})
    assert listed.status_code == 200
    assert any(m["_id"] == message_id for m in listed.json())

    deleted = client.delete(f"{BASE}/{message_id}")
    assert deleted.status_code == 204

    missing = client.get(f"{BASE}/{message_id}")
    assert missing.status_code == 404


def test_message_inherits_owner_from_its_chat(client, chat):
    created = client.post(f"{BASE}", json=_message_payload(chat))
    assert created.status_code == 201
    try:
        assert created.json()["ownerPartyRef"] == OWNER
    finally:
        client.delete(f"{BASE}/{created.json()['_id']}")


def test_list_messages_filters_by_chat_reference(client, chat):
    other_chat = client.post(
        "/api/v1/chats", json={"ownerPartyRef": OWNER, "title": "Other conversation"}
    ).json()
    try:
        own_message = client.post(f"{BASE}", json=_message_payload(chat, text="mine")).json()
        other_message = client.post(
            f"{BASE}", json=_message_payload(other_chat, text="not mine")
        ).json()

        listed = client.get(f"{BASE}", params={"chatReference": chat["chatReference"]}).json()
        listed_ids = {m["_id"] for m in listed}
        assert own_message["_id"] in listed_ids
        assert other_message["_id"] not in listed_ids
        assert all(m["chatReference"] == chat["chatReference"] for m in listed)
    finally:
        client.delete(f"/api/v1/chats/{other_chat['_id']}")


def test_list_messages_filters_by_chat_id(client, chat):
    other_chat = client.post(
        "/api/v1/chats", json={"ownerPartyRef": OWNER, "title": "Other conversation"}
    ).json()
    try:
        own_message = client.post(f"{BASE}", json=_message_payload(chat, text="mine")).json()
        other_message = client.post(
            f"{BASE}", json=_message_payload(other_chat, text="not mine")
        ).json()

        listed = client.get(f"{BASE}", params={"chatId": chat["_id"]}).json()
        listed_ids = {m["_id"] for m in listed}
        assert own_message["_id"] in listed_ids
        assert other_message["_id"] not in listed_ids
    finally:
        client.delete(f"/api/v1/chats/{other_chat['_id']}")


def test_messages_are_returned_oldest_first(client, chat):
    texts = ["first turn", "second turn", "third turn"]
    for text in texts:
        assert client.post(f"{BASE}", json=_message_payload(chat, text=text)).status_code == 201
        # BSON dates hold milliseconds; without a gap two turns can share a
        # timestamp and the sort order between them becomes arbitrary.
        time.sleep(0.01)

    listed = client.get(f"{BASE}", params={"chatReference": chat["chatReference"]}).json()
    assert [m["text"] for m in listed] == texts
    assert [m["createdAt"] for m in listed] == sorted(m["createdAt"] for m in listed)


def test_list_messages_omits_the_raw_embedding_vector(client, chat):
    created = client.post(f"{BASE}", json=_message_payload(chat, text="keep this out of the list"))
    assert created.status_code == 201
    assert "textEmbedding" not in created.json()

    listed = client.get(f"{BASE}", params={"chatReference": chat["chatReference"]}).json()
    assert all("textEmbedding" not in m for m in listed)


def test_message_stores_a_text_embedding(client, chat):
    """The vector is server-generated and never returned by the API, so this
    asserts against the stored document. Skips when Ollama is unreachable,
    since the embedding is then legitimately None.
    """
    created = client.post(f"{BASE}", json=_message_payload(chat, text="Dinner with the team"))
    assert created.status_code == 201
    message_id = created.json()["_id"]

    try:
        stored = get_db().find("chatMessages", {"_id": ObjectId(message_id)})[0]
        if stored.get("textEmbedding") is None:
            pytest.skip("Ollama unreachable; message stored without an embedding")
        assert len(stored["textEmbedding"]) > 0
        assert all(isinstance(value, float) for value in stored["textEmbedding"][:5])
    finally:
        client.delete(f"{BASE}/{message_id}")


def test_create_message_is_accepted_when_ollama_is_unavailable(client, chat, monkeypatch):
    """A message must still be written when the embedding can't be computed —
    `get_embedding` returning None is the documented degraded path.
    """
    async def _no_embedding(text):
        return None

    monkeypatch.setattr("routers.chat_messages.get_embedding", _no_embedding)

    created = client.post(f"{BASE}", json=_message_payload(chat, text="written while ollama is down"))
    assert created.status_code == 201
    client.delete(f"{BASE}/{created.json()['_id']}")


def test_message_on_an_ownerless_synced_chat_is_accepted(client):
    """Chats synced in from leafy-local-store carry no ownerPartyRef, so
    posting to one must not fail on the owner copy.
    """
    db = get_db()
    chat_reference = "ownerless-chat-reference-test"
    now = datetime.now(timezone.utc)
    chat_id = db.insert_one(
        "chats", {"chatReference": chat_reference, "title": "Synced chat", "createdAt": now, "updatedAt": now}
    )

    try:
        created = client.post(
            f"{BASE}",
            json={
                "chatId": str(chat_id),
                "chatReference": chat_reference,
                "role": "user",
                "text": "posted to a synced chat",
            },
        )
        assert created.status_code == 201
        assert created.json()["ownerPartyRef"] is None
    finally:
        db.delete_many("chatMessages", {"chatReference": chat_reference})
        db.delete_many("chats", {"chatReference": chat_reference})


def test_create_message_unknown_chat_returns_404(client):
    response = client.post(
        f"{BASE}",
        json={
            "chatId": "64b7f0f1f0f1f0f1f0f1f0f1",
            "chatReference": UNKNOWN_CHAT_REFERENCE,
            "role": "user",
            "text": "hi",
        },
    )
    assert response.status_code == 404


def test_create_message_invalid_role_returns_422(client, chat):
    response = client.post(f"{BASE}", json=_message_payload(chat, role="bot"))
    assert response.status_code == 422


def test_create_message_missing_required_field_returns_422(client, chat):
    payload = _message_payload(chat)
    del payload["text"]
    response = client.post(f"{BASE}", json=payload)
    assert response.status_code == 422


def test_create_message_missing_chat_reference_returns_422(client, chat):
    payload = _message_payload(chat)
    del payload["chatReference"]
    response = client.post(f"{BASE}", json=payload)
    assert response.status_code == 422


def test_get_message_invalid_id_returns_404(client):
    response = client.get(f"{BASE}/not-a-valid-object-id")
    assert response.status_code == 404


def test_get_message_unknown_id_returns_404(client):
    response = client.get(f"{BASE}/64b7f0f1f0f1f0f1f0f1f0f1")
    assert response.status_code == 404


def test_delete_unknown_message_returns_404(client):
    response = client.delete(f"{BASE}/64b7f0f1f0f1f0f1f0f1f0f1")
    assert response.status_code == 404
