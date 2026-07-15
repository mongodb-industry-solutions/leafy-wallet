BASE = "/api/v1/chats"

CHAT_PAYLOAD = {"title": "Splitting dinner with Maria"}


def test_chat_crud_lifecycle(client):
    created = client.post(f"{BASE}", json=CHAT_PAYLOAD)
    assert created.status_code == 201
    body = created.json()
    chat_id = body["_id"]
    assert body["title"] == "Splitting dinner with Maria"
    assert body["createdAt"] == body["updatedAt"]

    try:
        fetched = client.get(f"{BASE}/{chat_id}")
        assert fetched.status_code == 200
        assert fetched.json()["title"] == "Splitting dinner with Maria"

        listed = client.get(f"{BASE}")
        assert listed.status_code == 200
        assert any(c["_id"] == chat_id for c in listed.json())

        updated = client.patch(f"{BASE}/{chat_id}", json={"title": "Dinner with Maria"})
        assert updated.status_code == 200
        assert updated.json()["title"] == "Dinner with Maria"
        assert updated.json()["updatedAt"] != body["updatedAt"]

        empty_patch = client.patch(f"{BASE}/{chat_id}", json={})
        assert empty_patch.status_code == 400
    finally:
        deleted = client.delete(f"{BASE}/{chat_id}")
        assert deleted.status_code == 204

    missing = client.get(f"{BASE}/{chat_id}")
    assert missing.status_code == 404


def test_delete_chat_cascades_its_messages(client):
    chat_id = client.post(f"{BASE}", json=CHAT_PAYLOAD).json()["_id"]
    message = client.post(
        "/api/v1/chat-messages", json={"chatId": chat_id, "role": "user", "text": "hi"}
    )
    assert message.status_code == 201

    deleted = client.delete(f"{BASE}/{chat_id}")
    assert deleted.status_code == 204

    remaining = client.get("/api/v1/chat-messages", params={"chatId": chat_id})
    assert remaining.json() == []


def test_get_chat_invalid_id_returns_404(client):
    response = client.get(f"{BASE}/not-a-valid-object-id")
    assert response.status_code == 404


def test_get_chat_unknown_id_returns_404(client):
    response = client.get(f"{BASE}/64b7f0f1f0f1f0f1f0f1f0f1")
    assert response.status_code == 404


def test_delete_unknown_chat_returns_404(client):
    response = client.delete(f"{BASE}/64b7f0f1f0f1f0f1f0f1f0f1")
    assert response.status_code == 404


def test_patch_unknown_chat_returns_404(client):
    response = client.patch(f"{BASE}/64b7f0f1f0f1f0f1f0f1f0f1", json={"title": "Ghost chat"})
    assert response.status_code == 404


def test_create_chat_missing_required_field_returns_422(client):
    response = client.post(f"{BASE}", json={})
    assert response.status_code == 422
