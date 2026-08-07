"""Integration tests for leafy-local-store's spending-summary HTTP API, run
against a real running instance (docker compose up -d leafy-embed
objectbox-sync-server leafy-local-store). Not part of CI - these are for
local regression-checking only, and skip cleanly if the service isn't
reachable.

GET /local/v1/transactions/summary is the offline twin of the backend's
GET /wallet-transactions/summary, so these assert the contract that
backend/services/transactions.py's spending_by_contact() defines: one row per
counterparty, largest total first.

Records created here sync into the live walletTransactions Atlas collection,
so each test cleans up via DELETE /local/v1/transactions/{id}, propagating
the deletion through ObjectBox Sync back to Atlas too.
"""


import httpx
import pytest

from tests.conftest import LOCAL_STORE_BASE as BASE, unique as _unique

pytestmark = pytest.mark.usefixtures("require_leafy_local_store")






def _send(owner, counterparty, amount, direction="sent", currency="EUR"):
    created = httpx.post(
        f"{BASE}/local/v1/transactions/send",
        json={
            "leafyPayTransferReference": _unique("test-transfer"),
            "ownerPartyRef": owner,
            "counterpartyArrangementReference": counterparty,
            "amount": amount,
            "currency": currency,
            "direction": direction,
        },
    )
    assert created.status_code == 201
    return created.json()["id"]


@pytest.fixture
def spender():
    """An owner with a known ledger: 35.35 sent to alice over 3, 100.50 to bob, 7.77 received.

    The alice total is deliberately three amounts that sum to a float needing
    rounding (10.10 + 20.20 + 5.05 == 35.349999999999994).
    """
    owner = _unique("test-owner")
    alice, bob, carol = _unique("test-arr-alice"), _unique("test-arr-bob"), _unique("test-arr-carol")
    ids = [
        _send(owner, alice, 10.10),
        _send(owner, alice, 20.20),
        _send(owner, alice, 5.05),
        _send(owner, bob, 100.50),
        _send(owner, carol, 7.77, direction="received"),
    ]
    try:
        yield owner, alice, bob, carol
    finally:
        for transaction_id in ids:
            httpx.delete(f"{BASE}/local/v1/transactions/{transaction_id}")


def test_summary_groups_and_sorts_by_total_descending(spender):
    owner, alice, bob, _ = spender
    response = httpx.get(f"{BASE}/local/v1/transactions/summary", params={"ownerPartyRef": owner})
    assert response.status_code == 200

    assert response.json() == [
        {
            "counterpartyArrangementReference": bob,
            "total": 100.50,
            "count": 1,
            "currency": "EUR",
        },
        {
            "counterpartyArrangementReference": alice,
            "total": 35.35,
            "count": 3,
            "currency": "EUR",
        },
    ]


def test_summary_defaults_to_sent_and_excludes_received(spender):
    owner, _, _, carol = spender
    rows = httpx.get(f"{BASE}/local/v1/transactions/summary", params={"ownerPartyRef": owner}).json()
    assert all(row["counterpartyArrangementReference"] != carol for row in rows)


def test_summary_direction_received(spender):
    owner, _, _, carol = spender
    rows = httpx.get(
        f"{BASE}/local/v1/transactions/summary",
        params={"ownerPartyRef": owner, "direction": "received"},
    ).json()
    assert [row["counterpartyArrangementReference"] for row in rows] == [carol]
    assert rows[0]["total"] == 7.77
    assert rows[0]["count"] == 1


def test_summary_is_scoped_to_its_owner(spender):
    owner, _, _, _ = spender
    assert httpx.get(
        f"{BASE}/local/v1/transactions/summary", params={"ownerPartyRef": owner}
    ).json()

    stranger = httpx.get(
        f"{BASE}/local/v1/transactions/summary", params={"ownerPartyRef": _unique("test-owner")}
    )
    assert stranger.status_code == 200
    assert stranger.json() == []


def test_summary_requires_an_owner_party_ref():
    assert httpx.get(f"{BASE}/local/v1/transactions/summary").status_code == 400


def test_summary_rejects_an_unknown_direction():
    response = httpx.get(
        f"{BASE}/local/v1/transactions/summary",
        params={"ownerPartyRef": _unique("test-owner"), "direction": "sideways"},
    )
    assert response.status_code == 400
