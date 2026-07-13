BASE = "/api/v1/wallet-contacts"

CONTACT_PAYLOAD = {
    "ownerPartyRef": "11111111-1111-1111-1111-111111111111",
    "counterpartyArrangementReference": "22222222-2222-2222-2222-222222222222",
    "counterpartyLabel": "Jane Doe",
    "counterpartyLookupType": "email",
    "counterpartyLookupHint": "j***@example.com",
}


def test_contact_crud_lifecycle(client):
    created = client.post(f"{BASE}", json=CONTACT_PAYLOAD)
    assert created.status_code == 201
    body = created.json()
    contact_id = body["_id"]
    assert body["counterpartyLabel"] == "Jane Doe"
    assert body["createdAt"] == body["updatedAt"]

    try:
        fetched = client.get(f"{BASE}/{contact_id}")
        assert fetched.status_code == 200
        assert fetched.json()["counterpartyLabel"] == "Jane Doe"

        listed = client.get(
            f"{BASE}", params={"ownerPartyRef": CONTACT_PAYLOAD["ownerPartyRef"]}
        )
        assert listed.status_code == 200
        assert any(c["_id"] == contact_id for c in listed.json())

        updated = client.patch(
            f"{BASE}/{contact_id}", json={"counterpartyLabel": "Jane Updated"}
        )
        assert updated.status_code == 200
        assert updated.json()["counterpartyLabel"] == "Jane Updated"
        assert updated.json()["updatedAt"] != body["updatedAt"]

        empty_patch = client.patch(f"{BASE}/{contact_id}", json={})
        assert empty_patch.status_code == 400
    finally:
        deleted = client.delete(f"{BASE}/{contact_id}")
        assert deleted.status_code == 204

    missing = client.get(f"{BASE}/{contact_id}")
    assert missing.status_code == 404


def test_get_contact_invalid_id_returns_404(client):
    response = client.get(f"{BASE}/not-a-valid-object-id")
    assert response.status_code == 404


def test_get_contact_unknown_id_returns_404(client):
    response = client.get(f"{BASE}/64b7f0f1f0f1f0f1f0f1f0f1")
    assert response.status_code == 404


def test_delete_unknown_contact_returns_404(client):
    response = client.delete(f"{BASE}/64b7f0f1f0f1f0f1f0f1f0f1")
    assert response.status_code == 404


def test_patch_unknown_contact_returns_404(client):
    response = client.patch(
        f"{BASE}/64b7f0f1f0f1f0f1f0f1f0f1", json={"counterpartyLabel": "Ghost"}
    )
    assert response.status_code == 404


def test_create_contact_invalid_lookup_type_returns_422(client):
    payload = {**CONTACT_PAYLOAD, "counterpartyLookupType": "sms"}
    response = client.post(f"{BASE}", json=payload)
    assert response.status_code == 422


def test_create_contact_missing_required_field_returns_422(client):
    payload = {k: v for k, v in CONTACT_PAYLOAD.items() if k != "ownerPartyRef"}
    response = client.post(f"{BASE}", json=payload)
    assert response.status_code == 422
