BASE = "/api/v1/wallet-requests"

REQUEST_PAYLOAD = {
    "requesterPartyRef": "11111111-1111-1111-1111-111111111111",
    "requesterName": "Amara Okafor",
    "requesterDigest": "a" * 64,
    "targetDigest": "b" * 64,
    "amount": 25.5,
    "currency": "EUR",
    "note": "Dinner split",
}


def test_request_crud_lifecycle(client):
    created = client.post(f"{BASE}", json=REQUEST_PAYLOAD)
    assert created.status_code == 201
    body = created.json()
    request_id = body["_id"]
    assert body["status"] == "pending"
    assert body["requestReference"]
    assert body["resolvedAt"] is None
    assert body["leafyPayTransferReference"] is None

    try:
        fetched = client.get(f"{BASE}/{request_id}")
        assert fetched.status_code == 200
        assert fetched.json()["amount"] == 25.5

        # The target's inbox: they find this by digesting their own session email.
        inbox = client.get(
            f"{BASE}", params={"targetDigest": REQUEST_PAYLOAD["targetDigest"], "status": "pending"}
        )
        assert inbox.status_code == 200
        assert any(r["_id"] == request_id for r in inbox.json())

        outbox = client.get(
            f"{BASE}", params={"requesterPartyRef": REQUEST_PAYLOAD["requesterPartyRef"]}
        )
        assert outbox.status_code == 200
        assert any(r["_id"] == request_id for r in outbox.json())

        paid = client.patch(
            f"{BASE}/{request_id}",
            json={"status": "paid", "leafyPayTransferReference": "tx-ref-1"},
        )
        assert paid.status_code == 200
        assert paid.json()["status"] == "paid"
        assert paid.json()["leafyPayTransferReference"] == "tx-ref-1"
        assert paid.json()["resolvedAt"] is not None

        # Resolving twice would let a second transfer settle the same request.
        replayed = client.patch(f"{BASE}/{request_id}", json={"status": "declined"})
        assert replayed.status_code == 409
    finally:
        deleted = client.delete(f"{BASE}/{request_id}")
        assert deleted.status_code == 204

    missing = client.get(f"{BASE}/{request_id}")
    assert missing.status_code == 404


def test_pending_request_is_not_in_another_targets_inbox(client):
    created = client.post(f"{BASE}", json=REQUEST_PAYLOAD)
    request_id = created.json()["_id"]
    try:
        inbox = client.get(f"{BASE}", params={"targetDigest": "c" * 64})
        assert all(r["_id"] != request_id for r in inbox.json())
    finally:
        client.delete(f"{BASE}/{request_id}")


def test_empty_patch_returns_400(client):
    created = client.post(f"{BASE}", json=REQUEST_PAYLOAD)
    request_id = created.json()["_id"]
    try:
        assert client.patch(f"{BASE}/{request_id}", json={}).status_code == 400
    finally:
        client.delete(f"{BASE}/{request_id}")


def test_non_positive_amount_is_rejected(client):
    response = client.post(f"{BASE}", json={**REQUEST_PAYLOAD, "amount": 0})
    assert response.status_code == 422


def test_get_request_invalid_id_returns_404(client):
    response = client.get(f"{BASE}/not-a-valid-object-id")
    assert response.status_code == 404
