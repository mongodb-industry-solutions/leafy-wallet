"""Integration tests for leafy-local-store's account-balance-cache HTTP API,
run against a real running instance (docker compose up -d leafy-embed
objectbox-sync-server leafy-local-store). Not part of CI - these are for
local regression-checking only, and skip cleanly if the service isn't
reachable.

Unlike contacts/transactions, this entity is purely local (no
OBXEntityFlags_SYNC_ENABLED, no Atlas collection) - nothing here ever syncs,
so cleanup only needs the local DELETE, not an Atlas check.
"""


import httpx
import pytest

from tests.conftest import LOCAL_STORE_BASE as BASE, unique as _unique

pytestmark = pytest.mark.usefixtures("require_leafy_local_store")


def test_put_creates_then_lists():
    ref = _unique("acct")
    payload = {
        "ownerPartyRef": "owner-1",
        "label": "Main account",
        "currency": "EUR",
        "balanceValue": 120.5,
        "maskedIban": "**** 1234",
        "isDefault": True,
    }
    try:
        created = httpx.put(f"{BASE}/local/v1/accounts/{ref}", json=payload)
        assert created.status_code == 201
        body = created.json()
        assert body["accountReference"] == ref
        assert body["balanceValue"] == 120.5
        assert body["maskedIban"] == "**** 1234"
        assert body["isDefault"] is True

        listed = httpx.get(f"{BASE}/local/v1/accounts")
        assert listed.status_code == 200
        assert any(a["accountReference"] == ref for a in listed.json())
    finally:
        httpx.delete(f"{BASE}/local/v1/accounts/{ref}")


def test_put_again_updates_in_place_not_duplicated():
    ref = _unique("acct")
    try:
        first = httpx.put(
            f"{BASE}/local/v1/accounts/{ref}",
            json={"ownerPartyRef": "owner-1", "label": "Main", "currency": "EUR", "balanceValue": 100.0},
        )
        assert first.status_code == 201
        first_id = first.json()["id"]

        second = httpx.put(
            f"{BASE}/local/v1/accounts/{ref}",
            json={"ownerPartyRef": "owner-1", "label": "Main", "currency": "EUR", "balanceValue": 50.0},
        )
        assert second.status_code == 200
        assert second.json()["id"] == first_id
        assert second.json()["balanceValue"] == 50.0

        listed = httpx.get(f"{BASE}/local/v1/accounts").json()
        matches = [a for a in listed if a["accountReference"] == ref]
        assert len(matches) == 1
        assert matches[0]["balanceValue"] == 50.0
    finally:
        httpx.delete(f"{BASE}/local/v1/accounts/{ref}")


def test_put_missing_required_field_returns_400():
    ref = _unique("acct")
    response = httpx.put(f"{BASE}/local/v1/accounts/{ref}", json={"ownerPartyRef": "owner-1"})
    assert response.status_code == 400


def test_delete_removes_account():
    ref = _unique("acct")
    httpx.put(
        f"{BASE}/local/v1/accounts/{ref}",
        json={"ownerPartyRef": "owner-1", "label": "Main", "currency": "EUR", "balanceValue": 10.0},
    )

    deleted = httpx.delete(f"{BASE}/local/v1/accounts/{ref}")
    assert deleted.status_code == 204

    listed = httpx.get(f"{BASE}/local/v1/accounts").json()
    assert all(a["accountReference"] != ref for a in listed)
