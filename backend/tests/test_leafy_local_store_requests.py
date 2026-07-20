"""Integration tests for leafy-local-store's payment-request HTTP API, run
against a real running instance (docker compose up -d ollama
objectbox-sync-server leafy-local-store). Not part of CI - these are for
local regression-checking only, and skip cleanly if the service isn't
reachable.

Records created here sync into the live walletRequests/walletContacts Atlas
collections, so each test cleans up via DELETE, propagating the deletion
through ObjectBox Sync back to Atlas too.
"""

import uuid

import httpx
import pytest

BASE = "http://localhost:8090"


@pytest.fixture(scope="module", autouse=True)
def _require_leafy_local_store():
    try:
        response = httpx.get(f"{BASE}/local/v1/health", timeout=2.0)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        pytest.skip(f"leafy-local-store not reachable at {BASE}: {exc}")


def _unique(prefix):
    return f"{prefix}-{uuid.uuid4()}"


def _create_request(**overrides):
    payload = {
        "requestReference": _unique("test-req"),
        "requesterPartyRef": _unique("test-requester"),
        "requesterName": "Amara Okafor",
        "requesterDigest": _unique("digest-amara"),
        "targetDigest": _unique("digest-luis"),
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


def test_created_request_starts_pending(request_fixture):
    body, _ = request_fixture
    assert body["status"] == "pending"
    assert body["amount"] == 25.5
    assert body["currency"] == "EUR"
    assert body["leafyPayTransferReference"] is None
    assert body["resolvedAt"] is None


def test_request_is_listed_for_its_target_digest_only(request_fixture):
    body, payload = request_fixture

    inbox = httpx.get(
        f"{BASE}/local/v1/requests",
        params={"targetDigest": payload["targetDigest"], "status": "pending"},
    ).json()
    assert any(r["requestReference"] == payload["requestReference"] for r in inbox)

    stranger = httpx.get(
        f"{BASE}/local/v1/requests", params={"targetDigest": _unique("digest-stranger")}
    ).json()
    assert all(r["requestReference"] != payload["requestReference"] for r in stranger)


def test_request_is_listed_in_its_requesters_outbox(request_fixture):
    _, payload = request_fixture
    outbox = httpx.get(
        f"{BASE}/local/v1/requests", params={"requesterPartyRef": payload["requesterPartyRef"]}
    ).json()
    assert any(r["requestReference"] == payload["requestReference"] for r in outbox)


def test_resolving_a_request_records_the_transfer(request_fixture):
    body, _ = request_fixture
    resolved = httpx.put(
        f"{BASE}/local/v1/requests/{body['id']}",
        json={"status": "paid", "leafyPayTransferReference": "test-transfer-ref"},
    )
    assert resolved.status_code == 200
    assert resolved.json()["status"] == "paid"
    assert resolved.json()["leafyPayTransferReference"] == "test-transfer-ref"
    assert resolved.json()["resolvedAt"] is not None


def test_a_resolved_request_cannot_be_resolved_again(request_fixture):
    body, _ = request_fixture
    assert httpx.put(f"{BASE}/local/v1/requests/{body['id']}", json={"status": "declined"}).status_code == 200
    replayed = httpx.put(f"{BASE}/local/v1/requests/{body['id']}", json={"status": "paid"})
    assert replayed.status_code == 409


def test_resolve_requires_a_status(request_fixture):
    body, _ = request_fixture
    assert httpx.put(f"{BASE}/local/v1/requests/{body['id']}", json={}).status_code == 400


def test_create_requires_a_target_digest():
    created, _ = _create_request(targetDigest=None)
    assert created.status_code in (400, 500)


def test_resolving_an_unknown_request_returns_404():
    assert httpx.put(f"{BASE}/local/v1/requests/999999", json={"status": "paid"}).status_code == 404


def test_contact_lookup_digest_round_trips():
    """A contact synced down from Atlas keeps the digest a request is addressed to."""
    digest = _unique("digest-luis")
    created = httpx.post(
        f"{BASE}/local/v1/contacts",
        json={
            "ownerPartyRef": _unique("test-owner"),
            "counterpartyArrangementReference": _unique("test-arr"),
            "counterpartyLabel": "Luis",
            "counterpartyLookupType": "email",
            "counterpartyLookupHint": "l***@back.es",
            "counterpartyLookupDigest": digest,
        },
    )
    assert created.status_code == 201
    try:
        assert created.json()["counterpartyLookupDigest"] == digest
    finally:
        httpx.delete(f"{BASE}/local/v1/contacts/{created.json()['id']}")


def test_phone_contact_stores_a_null_digest():
    created = httpx.post(
        f"{BASE}/local/v1/contacts",
        json={
            "ownerPartyRef": _unique("test-owner"),
            "counterpartyArrangementReference": _unique("test-arr"),
            "counterpartyLabel": "Carlos",
            "counterpartyLookupType": "phone",
            "counterpartyLookupHint": "***678",
            "counterpartyLookupDigest": None,
        },
    )
    assert created.status_code == 201
    try:
        assert created.json()["counterpartyLookupDigest"] is None
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
