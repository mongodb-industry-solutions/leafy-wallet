"""Integration tests for leafy-local-store's payment-request HTTP API, run
against a real running instance (docker compose up -d leafy-embed
objectbox-sync-server leafy-local-store). Not part of CI - these are for
local regression-checking only, and skip cleanly if the service isn't
reachable.

Leafy Pay owns requests; this store holds the replica plus any composed offline.
Records created here sync into the live Atlas collections, so each test cleans up
via DELETE, propagating the deletion through ObjectBox Sync back to Atlas too.
"""

import uuid

import httpx
import pytest

from tests.conftest import LOCAL_STORE_BASE as BASE, unique as _unique

pytestmark = pytest.mark.usefixtures("require_leafy_local_store")






def _create_request(**overrides):
    payload = {
        "requestReference": f"local-{uuid.uuid4()}",
        "requesterPartyRef": _unique("test-requester"),
        "requesterName": "Amara Okafor",
        "payerCounterpartyRef": _unique("test-arr"),
        "amount": 25.5,
        "note": "Dinner split",
        **overrides,
    }
    created = httpx.post(f"{BASE}/local/v1/requests", json=payload)
    return created, payload


@pytest.fixture
def request_fixture():
    created, payload = _create_request()
    assert created.status_code == 201
    request_id = created.json()["id"]
    yield created.json(), payload
    httpx.delete(f"{BASE}/local/v1/requests/{request_id}")


def test_health_reports_request_count():
    response = httpx.get(f"{BASE}/local/v1/health")
    assert response.status_code == 200
    assert "request_count" in response.json()


def test_request_composed_offline_is_queued_for_replay(request_fixture):
    body, _ = request_fixture
    # Leafy Pay has not seen it yet, so it carries Leafy Pay's own opening status and no payer:
    # only Leafy Pay can resolve the contact into the party who will be asked to pay.
    assert body["localSyncStatus"] == "local_pending"
    assert body["status"] == "created"
    assert body["payerPartyRef"] == ""
    assert body["amount"] == 25.5
    assert body["currency"] == "EUR"
    assert body["leafyPayTransferReference"] is None
    assert body["resolvedAt"] is None


def test_queued_requests_are_findable_by_sync_status(request_fixture):
    _, payload = request_fixture
    queued = httpx.get(
        f"{BASE}/local/v1/requests", params={"localSyncStatus": "local_pending"}
    ).json()
    assert any(r["requestReference"] == payload["requestReference"] for r in queued)


def test_request_is_listed_in_its_requesters_outbox(request_fixture):
    _, payload = request_fixture
    outbox = httpx.get(
        f"{BASE}/local/v1/requests", params={"requesterPartyRef": payload["requesterPartyRef"]}
    ).json()
    assert any(r["requestReference"] == payload["requestReference"] for r in outbox)

    stranger = httpx.get(
        f"{BASE}/local/v1/requests", params={"requesterPartyRef": _unique("test-stranger")}
    ).json()
    assert all(r["requestReference"] != payload["requestReference"] for r in stranger)


def test_queued_request_reaches_nobodys_inbox(request_fixture):
    """A queued request has no payer yet, so it must not surface as money anyone owes.

    Only Leafy Pay can resolve the contact into a party, so rows carrying a payer arrive by sync
    from Atlas (covered in test_leafy_local_store_sync.py), never from this endpoint.
    """
    body, payload = request_fixture
    assert body["payerPartyRef"] == ""

    inbox = httpx.get(
        f"{BASE}/local/v1/requests", params={"payerPartyRef": payload["requesterPartyRef"]}
    ).json()
    assert all(r["requestReference"] != payload["requestReference"] for r in inbox)


def test_create_requires_the_contact_being_asked():
    created, _ = _create_request(payerCounterpartyRef=None)
    assert created.status_code in (400, 500)


def test_replayed_request_can_be_dropped(request_fixture):
    """Once Leafy Pay holds the real request, the local stand-in is deleted, not resolved."""
    body, payload = request_fixture
    assert httpx.delete(f"{BASE}/local/v1/requests/{body['id']}").status_code == 204
    remaining = httpx.get(
        f"{BASE}/local/v1/requests", params={"requesterPartyRef": payload["requesterPartyRef"]}
    ).json()
    assert all(r["requestReference"] != payload["requestReference"] for r in remaining)


def test_contact_round_trips_with_only_a_masked_hint():
    """Contacts keep the mask Leafy Pay returns and never the address it was resolved from."""
    created = httpx.post(
        f"{BASE}/local/v1/contacts",
        json={
            "ownerPartyRef": _unique("test-owner"),
            "counterpartyArrangementReference": _unique("test-arr"),
            "counterpartyLabel": "Luis",
            "counterpartyLookupType": "email",
            "counterpartyLookupHint": "l***@back.es",
        },
    )
    assert created.status_code == 201
    try:
        body = created.json()
        assert body["counterpartyLookupHint"] == "l***@back.es"
        assert "counterpartyLookupDigest" not in body
    finally:
        httpx.delete(f"{BASE}/local/v1/contacts/{body['id']}")


def test_phone_contact_round_trips():
    created = httpx.post(
        f"{BASE}/local/v1/contacts",
        json={
            "ownerPartyRef": _unique("test-owner"),
            "counterpartyArrangementReference": _unique("test-arr"),
            "counterpartyLabel": "Carlos",
            "counterpartyLookupType": "phone",
            "counterpartyLookupHint": "+34 6** *** 678",
        },
    )
    assert created.status_code == 201
    try:
        assert created.json()["counterpartyLookupType"] == "phone"
        assert created.json()["counterpartyLookupHint"] == "+34 6** *** 678"
    finally:
        httpx.delete(f"{BASE}/local/v1/contacts/{created.json()['id']}")


def test_offline_send_is_buffered_as_local_pending():
    reference = f"local-{uuid.uuid4()}"
    created = httpx.post(
        f"{BASE}/local/v1/transactions/send",
        json={
            "leafyPayTransferReference": reference,
            "ownerPartyRef": _unique("test-owner"),
            "counterpartyArrangementReference": _unique("test-arr"),
            "amount": 12.5,
            "currency": "EUR",
            "direction": "sent",
            "note": "Coffee",
        },
    )
    assert created.status_code == 201
    try:
        assert created.json()["localSyncStatus"] == "local_pending"
        assert created.json()["leafyPayStatus"] == "pending"
        assert created.json()["leafyPayTransferReference"] == reference
    finally:
        httpx.delete(f"{BASE}/local/v1/transactions/{created.json()['id']}")
