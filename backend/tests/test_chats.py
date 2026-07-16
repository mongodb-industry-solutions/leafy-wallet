BASE = "/api/v1/chats"

OWNER = "chat-test-owner"
CHAT_PAYLOAD = {"ownerPartyRef": OWNER, "title": "Splitting dinner with Maria"}


def test_chat_crud_lifecycle(client):
    created = client.post(f"{BASE}", json=CHAT_PAYLOAD)
    assert created.status_code == 201
    body = created.json()
    chat_id = body["_id"]
    assert body["title"] == "Splitting dinner with Maria"
    assert body["ownerPartyRef"] == OWNER
    assert body["chatReference"]
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


def test_chat_reference_is_server_generated_and_not_client_supplied(client):
    spoofed = client.post(f"{BASE}", json={**CHAT_PAYLOAD, "chatReference": "spoofed-reference"})
    assert spoofed.status_code == 201
    body = spoofed.json()
    try:
        assert body["chatReference"] != "spoofed-reference"
    finally:
        client.delete(f"{BASE}/{body['_id']}")


def test_list_chats_filters_by_owner(client):
    mine = client.post(f"{BASE}", json=CHAT_PAYLOAD).json()
    theirs = client.post(
        f"{BASE}", json={**CHAT_PAYLOAD, "ownerPartyRef": "some-other-owner"}
    ).json()

    try:
        listed = client.get(f"{BASE}", params={"ownerPartyRef": OWNER})
        assert listed.status_code == 200
        listed_ids = {c["_id"] for c in listed.json()}
        assert mine["_id"] in listed_ids
        # One user must never read another user's chat history.
        assert theirs["_id"] not in listed_ids
        assert all(c["ownerPartyRef"] == OWNER for c in listed.json())
    finally:
        client.delete(f"{BASE}/{mine['_id']}")
        client.delete(f"{BASE}/{theirs['_id']}")


def test_delete_chat_cascades_its_messages(client):
    chat = client.post(f"{BASE}", json=CHAT_PAYLOAD).json()
    message = client.post(
        "/api/v1/chat-messages",
        json={
            "chatId": chat["_id"],
            "chatReference": chat["chatReference"],
            "role": "user",
            "text": "hi",
        },
    )
    assert message.status_code == 201

    deleted = client.delete(f"{BASE}/{chat['_id']}")
    assert deleted.status_code == 204

    remaining = client.get(
        "/api/v1/chat-messages", params={"chatReference": chat["chatReference"]}
    )
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


def test_create_chat_missing_owner_returns_422(client):
    response = client.post(f"{BASE}", json={"title": "Ownerless chat"})
    assert response.status_code == 422
