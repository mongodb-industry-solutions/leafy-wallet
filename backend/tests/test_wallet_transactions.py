from datetime import datetime

BASE = "/api/v1/wallet-transactions"

TRANSACTION_PAYLOAD = {
    "leafyPayTransferReference": "33333333-3333-3333-3333-333333333333",
    "ownerPartyRef": "11111111-1111-1111-1111-111111111111",
    "counterpartyArrangementReference": "22222222-2222-2222-2222-222222222222",
    "amount": 20.0,
    "currency": "EUR",
    "note": "Dinner split",
    "direction": "sent",
}


def test_transaction_crud_lifecycle(client):
    created = client.post(f"{BASE}", json=TRANSACTION_PAYLOAD)
    assert created.status_code == 201
    body = created.json()
    transaction_id = body["_id"]
    assert body["leafyPayStatus"] == "pending"
    assert body["localSyncStatus"] == "synced"
    assert body["settledAt"] is None

    try:
        fetched = client.get(f"{BASE}/{transaction_id}")
        assert fetched.status_code == 200

        listed = client.get(
            f"{BASE}",
            params={"ownerPartyRef": TRANSACTION_PAYLOAD["ownerPartyRef"], "direction": "sent"},
        )
        assert listed.status_code == 200
        assert any(t["_id"] == transaction_id for t in listed.json())

        updated = client.patch(
            f"{BASE}/{transaction_id}",
            json={"leafyPayStatus": "settled", "settledAt": "2026-07-13T12:00:00Z"},
        )
        assert updated.status_code == 200
        assert updated.json()["leafyPayStatus"] == "settled"

        empty_patch = client.patch(f"{BASE}/{transaction_id}", json={})
        assert empty_patch.status_code == 400
    finally:
        deleted = client.delete(f"{BASE}/{transaction_id}")
        assert deleted.status_code == 204

    missing = client.get(f"{BASE}/{transaction_id}")
    assert missing.status_code == 404


def test_transaction_without_note_has_no_embedding(client):
    payload = {
        **TRANSACTION_PAYLOAD,
        "leafyPayTransferReference": "44444444-4444-4444-4444-444444444444",
        "direction": "received",
        "note": None,
    }
    created = client.post(f"{BASE}", json=payload)
    assert created.status_code == 201
    body = created.json()
    assert body["noteEmbedding"] is None
    client.delete(f"{BASE}/{body['_id']}")


def test_get_transaction_invalid_id_returns_404(client):
    response = client.get(f"{BASE}/not-a-valid-object-id")
    assert response.status_code == 404


def test_patch_unknown_transaction_returns_404(client):
    response = client.patch(
        f"{BASE}/64b7f0f1f0f1f0f1f0f1f0f1", json={"leafyPayStatus": "settled"}
    )
    assert response.status_code == 404


def test_settling_without_explicit_settledAt_is_autostamped(client):
    payload = {
        **TRANSACTION_PAYLOAD,
        "leafyPayTransferReference": "55555555-5555-5555-5555-555555555555",
        "note": None,
    }
    created = client.post(f"{BASE}", json=payload)
    assert created.status_code == 201
    transaction_id = created.json()["_id"]

    try:
        updated = client.patch(f"{BASE}/{transaction_id}", json={"leafyPayStatus": "settled"})
        assert updated.status_code == 200
        body = updated.json()
        assert body["leafyPayStatus"] == "settled"
        assert body["settledAt"] is not None
    finally:
        client.delete(f"{BASE}/{transaction_id}")


def test_settling_with_explicit_settledAt_keeps_provided_value(client):
    payload = {
        **TRANSACTION_PAYLOAD,
        "leafyPayTransferReference": "66666666-6666-6666-6666-666666666666",
        "note": None,
    }
    created = client.post(f"{BASE}", json=payload)
    transaction_id = created.json()["_id"]

    try:
        updated = client.patch(
            f"{BASE}/{transaction_id}",
            json={"leafyPayStatus": "settled", "settledAt": "2026-01-01T00:00:00Z"},
        )
        assert updated.status_code == 200
        settled_at = datetime.fromisoformat(updated.json()["settledAt"])
        assert settled_at == datetime.fromisoformat("2026-01-01T00:00:00+00:00")
    finally:
        client.delete(f"{BASE}/{transaction_id}")


def test_list_transactions_filtered_by_leafy_pay_status(client):
    payload = {
        **TRANSACTION_PAYLOAD,
        "leafyPayTransferReference": "77777777-7777-7777-7777-777777777777",
        "note": None,
    }
    created = client.post(f"{BASE}", json=payload)
    transaction_id = created.json()["_id"]

    try:
        client.patch(f"{BASE}/{transaction_id}", json={"leafyPayStatus": "settled"})

        settled = client.get(f"{BASE}", params={"leafyPayStatus": "settled"})
        assert any(t["_id"] == transaction_id for t in settled.json())

        pending = client.get(f"{BASE}", params={"leafyPayStatus": "pending"})
        assert not any(t["_id"] == transaction_id for t in pending.json())
    finally:
        client.delete(f"{BASE}/{transaction_id}")


def test_create_transaction_invalid_status_returns_422(client):
    payload = {
        **TRANSACTION_PAYLOAD,
        "leafyPayTransferReference": "88888888-8888-8888-8888-888888888888",
        "leafyPayStatus": "synced",
    }
    response = client.post(f"{BASE}", json=payload)
    assert response.status_code == 422


def test_create_transaction_invalid_direction_returns_422(client):
    payload = {
        **TRANSACTION_PAYLOAD,
        "leafyPayTransferReference": "99999999-9999-9999-9999-999999999999",
        "direction": "outgoing",
    }
    response = client.post(f"{BASE}", json=payload)
    assert response.status_code == 422


def test_create_transaction_note_too_long_returns_422(client):
    payload = {
        **TRANSACTION_PAYLOAD,
        "leafyPayTransferReference": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "note": "x" * 141,
    }
    response = client.post(f"{BASE}", json=payload)
    assert response.status_code == 422


def test_create_transaction_missing_required_field_returns_422(client):
    payload = {k: v for k, v in TRANSACTION_PAYLOAD.items() if k != "amount"}
    response = client.post(f"{BASE}", json=payload)
    assert response.status_code == 422


def test_transaction_with_note_stores_returned_embedding(client, monkeypatch):
    async def fake_get_embedding(note):
        return [0.1, 0.2, 0.3]

    monkeypatch.setattr("routers.wallet_transactions.get_embedding", fake_get_embedding)

    payload = {
        **TRANSACTION_PAYLOAD,
        "leafyPayTransferReference": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    }
    created = client.post(f"{BASE}", json=payload)
    assert created.status_code == 201
    body = created.json()
    assert body["noteEmbedding"] == [0.1, 0.2, 0.3]
    client.delete(f"{BASE}/{body['_id']}")
