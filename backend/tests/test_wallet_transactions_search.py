import asyncio
import time
from datetime import datetime, timezone

import pytest
from pymongo.errors import OperationFailure

from db.client import get_db
from services.transactions import NOTE_EMBEDDING_INDEX
from services.embeddings import get_embedding

COLLECTION = "walletTransactions"

BASE = "/api/v1/wallet-transactions"

TRANSACTION_PAYLOAD = {
    "leafyPayTransferReference": "search-test-ref",
    "ownerPartyRef": "search-test-owner",
    "counterpartyArrangementReference": "search-test-counterparty",
    "amount": 10.0,
    "currency": "EUR",
    "direction": "sent",
}


def _seed(reference, note, owner=TRANSACTION_PAYLOAD["ownerPartyRef"]):
    """Insert a searchable transaction straight into Atlas.

    Writes reach this collection through ObjectBox Sync now, so there is no
    HTTP write route to seed through; the embedding is generated here the way
    the device generates it before syncing up.
    """
    db = get_db()
    doc = {
        **TRANSACTION_PAYLOAD,
        "leafyPayTransferReference": reference,
        "ownerPartyRef": owner,
        "note": note,
        "noteEmbedding": asyncio.run(get_embedding(note)),
        "createdAt": datetime.now(timezone.utc),
        "settledAt": None,
    }
    doc["_id"] = db.insert_one(COLLECTION, doc)
    return doc


def _drop(*docs):
    db = get_db()
    for doc in docs:
        db.delete_one(COLLECTION, {"_id": doc["_id"]})


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
    food = _seed("search-food", "Dinner with the team")
    bill = _seed("search-bill", "Monthly rent payment")

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
        _drop(food, bill)


def test_search_respects_owner_party_ref_filter(client):
    mine = _seed("search-mine", "Dinner with the team")
    other_owner = _seed("search-other-owner", "Dinner with the team", owner="someone-elses-party-ref")

    try:
        results = _search_until(
            client,
            {"q": "food with a friend", "ownerPartyRef": "search-test-owner"},
            lambda results: len(results) >= 1,
        )
        assert len(results) >= 1
        assert all(r["ownerPartyRef"] == "search-test-owner" for r in results)
    finally:
        _drop(mine, other_owner)
