"""Integration tests for leafy-local-store's HTTP API, run against a real
running instance (docker compose up -d leafy-embed objectbox-sync-server
leafy-local-store). Not part of CI - deploying ObjectBox there isn't worth
it (see backend/README.md's "ObjectBox Offline Sync (PoC)" section) - these
are for local regression-checking only, and skip cleanly if the service
isn't reachable.

Records created here sync into the live walletTransactions/walletContacts
Atlas collections, so each test cleans up via DELETE /local/v1/.../{id},
which propagates the deletion through ObjectBox Sync back to Atlas too.
"""

import uuid

import httpx
import pytest

from tests.conftest import LOCAL_STORE_BASE as BASE, unique as _unique

pytestmark = pytest.mark.usefixtures("require_leafy_local_store")






def test_health_returns_counts():
    response = httpx.get(f"{BASE}/local/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"
    assert "transaction_count" in body
    assert "contact_count" in body


def test_search_missing_q_returns_400():
    response = httpx.get(f"{BASE}/local/v1/transactions/search")
    assert response.status_code == 400


def test_send_missing_required_field_returns_400():
    payload = {
        "leafyPayTransferReference": _unique("missing-field"),
        "ownerPartyRef": "party-test-suite",
        "counterpartyArrangementReference": "arr-test-suite",
        "currency": "USD",
        "direction": "sent",
        # amount deliberately omitted
    }
    response = httpx.post(f"{BASE}/local/v1/transactions/send", json=payload)
    assert response.status_code == 400


def test_delete_unknown_transaction_returns_404():
    response = httpx.delete(f"{BASE}/local/v1/transactions/999999999")
    assert response.status_code == 404


def test_transaction_send_and_search_ranks_semantically():
    owner = _unique("party")
    food = httpx.post(
        f"{BASE}/local/v1/transactions/send",
        json={
            "leafyPayTransferReference": _unique("food"),
            "ownerPartyRef": owner,
            "counterpartyArrangementReference": "arr-test-suite",
            "amount": 12.0,
            "currency": "USD",
            "direction": "sent",
            "note": "Dinner with the team",
        },
    )
    rent = httpx.post(
        f"{BASE}/local/v1/transactions/send",
        json={
            "leafyPayTransferReference": _unique("rent"),
            "ownerPartyRef": owner,
            "counterpartyArrangementReference": "arr-test-suite",
            "amount": 900.0,
            "currency": "USD",
            "direction": "sent",
            "note": "Monthly rent payment",
        },
    )
    assert food.status_code == 201
    assert rent.status_code == 201

    try:
        response = httpx.get(
            f"{BASE}/local/v1/transactions/search",
            params={"q": "food with a friend", "ownerPartyRef": owner, "limit": 5},
        )
        assert response.status_code == 200
        scores_by_note = {r["note"]: r["score"] for r in response.json()}
        assert "Dinner with the team" in scores_by_note
        assert "Monthly rent payment" in scores_by_note
        # score is a *distance* here (lower = more similar) - opposite of
        # Atlas's $vectorSearch convention, see backend/README.md.
        assert scores_by_note["Dinner with the team"] < scores_by_note["Monthly rent payment"]
    finally:
        httpx.delete(f"{BASE}/local/v1/transactions/{food.json()['id']}")
        httpx.delete(f"{BASE}/local/v1/transactions/{rent.json()['id']}")


def test_transactions_search_respects_owner_party_ref_filter():
    mine_owner = _unique("party-mine")
    other_owner = _unique("party-other")
    mine = httpx.post(
        f"{BASE}/local/v1/transactions/send",
        json={
            "leafyPayTransferReference": _unique("mine"),
            "ownerPartyRef": mine_owner,
            "counterpartyArrangementReference": "arr-test-suite",
            "amount": 20.0,
            "currency": "USD",
            "direction": "sent",
            "note": "Dinner with the team",
        },
    )
    other = httpx.post(
        f"{BASE}/local/v1/transactions/send",
        json={
            "leafyPayTransferReference": _unique("other"),
            "ownerPartyRef": other_owner,
            "counterpartyArrangementReference": "arr-test-suite",
            "amount": 20.0,
            "currency": "USD",
            "direction": "sent",
            "note": "Dinner with the team",
        },
    )
    assert mine.status_code == 201
    assert other.status_code == 201

    try:
        response = httpx.get(
            f"{BASE}/local/v1/transactions/search",
            params={"q": "food", "ownerPartyRef": mine_owner, "limit": 10},
        )
        assert response.status_code == 200
        results = response.json()
        assert all(r["ownerPartyRef"] == mine_owner for r in results)
        assert any(
            r["leafyPayTransferReference"] == mine.json()["leafyPayTransferReference"]
            for r in results
        )
    finally:
        httpx.delete(f"{BASE}/local/v1/transactions/{mine.json()['id']}")
        httpx.delete(f"{BASE}/local/v1/transactions/{other.json()['id']}")


def test_contact_send_list_and_delete():
    owner = _unique("party")
    created = httpx.post(
        f"{BASE}/local/v1/contacts",
        json={
            "ownerPartyRef": owner,
            "counterpartyArrangementReference": "arr-test-suite",
            "counterpartyLabel": "Test Contact",
            "counterpartyLookupType": "email",
            "counterpartyLookupHint": "t***@example.com",
        },
    )
    assert created.status_code == 201
    contact_id = created.json()["id"]

    try:
        listed = httpx.get(f"{BASE}/local/v1/contacts")
        assert listed.status_code == 200
        assert any(c["id"] == contact_id for c in listed.json())
    finally:
        deleted = httpx.delete(f"{BASE}/local/v1/contacts/{contact_id}")
        assert deleted.status_code == 204

    deleted_again = httpx.delete(f"{BASE}/local/v1/contacts/{contact_id}")
    assert deleted_again.status_code == 404
