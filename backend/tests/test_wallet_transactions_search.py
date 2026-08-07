import asyncio
import time

import pytest
from pymongo.errors import OperationFailure

from db.client import get_db
from services.transactions import NOTE_EMBEDDING_INDEX
from services.embeddings import get_embedding

BASE = "/api/v1/wallet-transactions"

TRANSACTION_PAYLOAD = {
    "leafyPayTransferReference": "search-test-ref",
    "ownerPartyRef": "search-test-owner",
    "counterpartyArrangementReference": "search-test-counterparty",
    "amount": 10.0,
    "currency": "EUR",
    "direction": "sent",
}


def _search_until(client, params, predicate, attempts=30, delay=2.0):
    """Atlas Search indexes newly written documents asynchronously, so a
    search run immediately after an insert can miss it. Poll briefly until
    `predicate` matches or we give up. Tolerates transient non-200s during
    Atlas Search warm-up by retrying, only asserting on the final attempt.
    """
    response = None
    for _ in range(attempts):
        response = client.get(f"{BASE}/search", params=params)
        if response.status_code == 200:
            results = response.json()
            if predicate(results):
                return results
        time.sleep(delay)
    assert response is not None, "no search attempts were made"
    assert response.status_code == 200, response.text
    return response.json()


@pytest.fixture(scope="module", autouse=True)
def _require_vector_index_and_embeddings(client):
    db = get_db()
    try:
        indexes = list(db.get_collection("walletTransactions").list_search_indexes(NOTE_EMBEDDING_INDEX))
    except OperationFailure as exc:
        pytest.skip(f"Atlas Vector Search not available on this cluster: {exc}")

    if not indexes or not indexes[0].get("queryable"):
        pytest.skip(
            f"Vector search index '{NOTE_EMBEDDING_INDEX}' not provisioned/queryable; "
            "run scripts/create_vector_index.py"
        )

    # Search embeds the query text, so skip cleanly (rather than asserting 503s) when the
    # embedding provider isn't reachable, e.g. in CI where none is configured. A short
    # explicit timeout keeps this fast instead of blocking on get_embedding()'s full 30s.
    try:
        embedding = asyncio.run(asyncio.wait_for(get_embedding("embedding reachability check"), timeout=5.0))
    except asyncio.TimeoutError:
        embedding = None
    if embedding is None:
        pytest.skip("Embedding provider unreachable; skipping semantic search tests")


def test_search_ranks_semantically_similar_note_first(client):
    food = client.post(
        BASE,
        json={**TRANSACTION_PAYLOAD, "leafyPayTransferReference": "search-food", "note": "Dinner with the team"},
    )
    bill = client.post(
        BASE,
        json={**TRANSACTION_PAYLOAD, "leafyPayTransferReference": "search-bill", "note": "Monthly rent payment"},
    )
    assert food.status_code == 201
    assert bill.status_code == 201

    try:
        results = _search_until(
            client,
            {"q": "food with a friend", "ownerPartyRef": "search-test-owner"},
            lambda results: any(r["note"] == "Dinner with the team" for r in results),
        )
        notes = [r["note"] for r in results]
        assert "Dinner with the team" in notes
        if "Monthly rent payment" in notes:
            assert notes.index("Dinner with the team") < notes.index("Monthly rent payment")
    finally:
        client.delete(f"{BASE}/{food.json()['_id']}")
        client.delete(f"{BASE}/{bill.json()['_id']}")


def test_search_respects_owner_party_ref_filter(client):
    mine = client.post(
        BASE,
        json={**TRANSACTION_PAYLOAD, "leafyPayTransferReference": "search-mine", "note": "Dinner with the team"},
    )
    other_owner = client.post(
        BASE,
        json={
            **TRANSACTION_PAYLOAD,
            "leafyPayTransferReference": "search-other-owner",
            "ownerPartyRef": "someone-elses-party-ref",
            "note": "Dinner with the team",
        },
    )
    assert mine.status_code == 201
    assert other_owner.status_code == 201

    try:
        results = _search_until(
            client,
            {"q": "food with a friend", "ownerPartyRef": "search-test-owner"},
            lambda results: len(results) >= 1,
        )
        assert len(results) >= 1
        assert all(r["ownerPartyRef"] == "search-test-owner" for r in results)
    finally:
        client.delete(f"{BASE}/{mine.json()['_id']}")
        client.delete(f"{BASE}/{other_owner.json()['_id']}")
