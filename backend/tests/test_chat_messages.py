import pytest

BASE = "/api/v1/chat-messages"


@pytest.fixture
def chat_id(client):
    chat_id = client.post("/api/v1/chats", json={"title": "Test conversation"}).json()["_id"]
    yield chat_id
    client.delete(f"/api/v1/chats/{chat_id}")


def test_chat_message_crud_lifecycle(client, chat_id):
    payload = {"chatId": chat_id, "role": "user", "text": "Split the dinner bill with Maria"}
    created = client.post(f"{BASE}", json=payload)
    assert created.status_code == 201
    body = created.json()
    message_id = body["_id"]
    assert body["chatId"] == chat_id
    assert body["role"] == "user"
    assert body["text"] == "Split the dinner bill with Maria"

    fetched = client.get(f"{BASE}/{message_id}")
    assert fetched.status_code == 200
    assert fetched.json()["text"] == "Split the dinner bill with Maria"

    listed = client.get(f"{BASE}", params={"chatId": chat_id})
    assert listed.status_code == 200
    assert any(m["_id"] == message_id for m in listed.json())

    deleted = client.delete(f"{BASE}/{message_id}")
    assert deleted.status_code == 204

    missing = client.get(f"{BASE}/{message_id}")
    assert missing.status_code == 404


def test_list_messages_filters_by_chat_id(client, chat_id):
    other_chat_id = client.post("/api/v1/chats", json={"title": "Other conversation"}).json()["_id"]
    try:
        own_message = client.post(
            f"{BASE}", json={"chatId": chat_id, "role": "user", "text": "mine"}
        ).json()
        other_message = client.post(
            f"{BASE}", json={"chatId": other_chat_id, "role": "user", "text": "not mine"}
        ).json()

        listed = client.get(f"{BASE}", params={"chatId": chat_id}).json()
        listed_ids = {m["_id"] for m in listed}
        assert own_message["_id"] in listed_ids
        assert other_message["_id"] not in listed_ids
    finally:
        client.delete(f"/api/v1/chats/{other_chat_id}")


def test_create_message_unknown_chat_returns_404(client):
    response = client.post(
        f"{BASE}",
        json={"chatId": "64b7f0f1f0f1f0f1f0f1f0f1", "role": "user", "text": "hi"},
    )
    assert response.status_code == 404


def test_create_message_invalid_role_returns_422(client, chat_id):
    response = client.post(f"{BASE}", json={"chatId": chat_id, "role": "bot", "text": "hi"})
    assert response.status_code == 422


def test_create_message_missing_required_field_returns_422(client, chat_id):
    response = client.post(f"{BASE}", json={"chatId": chat_id, "role": "user"})
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
