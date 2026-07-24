from db.client import get_db

BASE = "/api/v1/wallet-requests"

PAYEE = "11111111-1111-1111-1111-111111111111"
PAYER = "22222222-2222-2222-2222-222222222222"

# Mirrors one Leafy Pay request. The collection is keyed by `requestReference`, Leafy Pay's own:
# this store replicates requests, it does not mint them.
REQUEST_PAYLOAD = {
    "requestReference": "rtp-test-0001",
    "requesterPartyRef": PAYEE,
    "requesterName": "Amara Okafor",
    "payerPartyRef": PAYER,
    "payerCounterpartyRef": "arr-0001",
    "amount": 25.5,
    "currency": "EUR",
    "note": "Dinner split",
    "status": "presented",
}


def _cleanup(reference):
    get_db().delete_one("walletRequests", {"requestReference": reference})


def test_request_is_mirrored_and_readable_from_both_boxes(client):
    created = client.post(BASE, json=REQUEST_PAYLOAD)
    assert created.status_code == 200
    body = created.json()
    assert body["status"] == "presented"
    assert body["localSyncStatus"] == "synced"
    assert body["createdAt"] is not None
    assert body["resolvedAt"] is None

    try:
        inbox = client.get(BASE, params={"payerPartyRef": PAYER})
        assert inbox.status_code == 200
        assert any(r["requestReference"] == REQUEST_PAYLOAD["requestReference"] for r in inbox.json())

        outbox = client.get(BASE, params={"requesterPartyRef": PAYEE})
        assert outbox.status_code == 200
        assert any(r["requestReference"] == REQUEST_PAYLOAD["requestReference"] for r in outbox.json())
    finally:
        _cleanup(REQUEST_PAYLOAD["requestReference"])


def test_rewriting_a_request_converges_instead_of_duplicating(client):
    """The app re-posts every request it reads from Leafy Pay, so writes must be idempotent."""
    client.post(BASE, json=REQUEST_PAYLOAD)
    try:
        settled = client.post(
            BASE,
            json={
                **REQUEST_PAYLOAD,
                "status": "payment_settled",
                "leafyPayTransferReference": "exec-1",
            },
        )
        assert settled.status_code == 200
        assert settled.json()["status"] == "payment_settled"

        stored = client.get(BASE, params={"requesterPartyRef": PAYEE}).json()
        matching = [r for r in stored if r["requestReference"] == REQUEST_PAYLOAD["requestReference"]]
        assert len(matching) == 1
        assert matching[0]["leafyPayTransferReference"] == "exec-1"
    finally:
        _cleanup(REQUEST_PAYLOAD["requestReference"])


def test_each_side_fills_its_own_party_ref_without_erasing_the_other(client):
    """Both sides mirror the same request, so a blank ref must not wipe what the other stored.

    Otherwise whoever refreshes second empties the first one's offline inbox.
    """
    payer_side = {**REQUEST_PAYLOAD, "requesterPartyRef": ""}
    assert client.post(BASE, json=payer_side).status_code == 200
    try:
        requester_side = {**REQUEST_PAYLOAD, "payerPartyRef": ""}
        assert client.post(BASE, json=requester_side).status_code == 200

        stored = client.get(BASE, params={"payerPartyRef": PAYER}).json()
        matching = [r for r in stored if r["requestReference"] == REQUEST_PAYLOAD["requestReference"]]
        assert len(matching) == 1
        assert matching[0]["requesterPartyRef"] == PAYEE
    finally:
        _cleanup(REQUEST_PAYLOAD["requestReference"])


def test_request_is_not_in_another_partys_inbox(client):
    client.post(BASE, json=REQUEST_PAYLOAD)
    try:
        inbox = client.get(BASE, params={"payerPartyRef": "33333333-3333-3333-3333-333333333333"})
        assert all(r["requestReference"] != REQUEST_PAYLOAD["requestReference"] for r in inbox.json())
    finally:
        _cleanup(REQUEST_PAYLOAD["requestReference"])


def test_queued_request_is_findable_by_its_sync_status(client):
    """A request composed offline is replayed into Leafy Pay on reconnect, so it must be findable."""
    queued = {
        **REQUEST_PAYLOAD,
        "requestReference": "local-test-0001",
        "payerPartyRef": "",
        "status": "created",
        "localSyncStatus": "local_pending",
    }
    client.post(BASE, json=queued)
    try:
        pending = client.get(BASE, params={"localSyncStatus": "local_pending"})
        assert any(r["requestReference"] == "local-test-0001" for r in pending.json())
    finally:
        _cleanup("local-test-0001")


def test_orphaned_request_can_be_pruned(client):
    created = client.post(BASE, json=REQUEST_PAYLOAD)
    request_id = created.json()["_id"]
    assert client.delete(f"{BASE}/{request_id}").status_code == 204
    remaining = client.get(BASE, params={"requesterPartyRef": PAYEE}).json()
    assert all(r["requestReference"] != REQUEST_PAYLOAD["requestReference"] for r in remaining)


def test_non_positive_amount_is_rejected(client):
    assert client.post(BASE, json={**REQUEST_PAYLOAD, "amount": 0}).status_code == 422


def test_status_outside_the_leafy_pay_lifecycle_is_rejected(client):
    """The replica cannot invent a status Leafy Pay does not have."""
    assert client.post(BASE, json={**REQUEST_PAYLOAD, "status": "paid"}).status_code == 422
