"""Integration tests for the MCP server (backend/mcp_server/server.py), run
against real MongoDB Atlas - same skip-if-unreachable convention as the rest
of this suite. Uses mcp.shared.memory's in-memory client/server session
helper rather than spinning up a real HTTP server: it connects a real
ClientSession directly to our FastMCP instance over in-memory streams, so
this exercises the actual MCP protocol (tool discovery, JSON schemas, tool
call dispatch), not just the underlying service functions directly.
"""

import asyncio
import json
import time
from datetime import datetime, timedelta, timezone

import pytest
from mcp.shared.memory import create_connected_server_and_client_session
from pymongo.errors import OperationFailure

from db.client import get_db
from mcp_server.server import mcp
from services.embeddings import get_embedding
from services.fraud import BURST_THRESHOLD
from services.transactions import HISTORY_COLLECTION, HISTORY_EMBEDDING_INDEX
from tests.conftest import unique as _unique

pytestmark = pytest.mark.filterwarnings("ignore::DeprecationWarning")


@pytest.fixture(scope="module", autouse=True)
def _require_atlas():
    db = get_db()
    try:
        db.client.admin.command("ping")
    except Exception as exc:
        pytest.skip(f"MongoDB Atlas not reachable, skipping MCP integration tests: {exc}")


@pytest.fixture
def _require_vector_index_and_embeddings():
    """Same skip conditions as test_wallet_transactions_search.py - only
    needed for the search_transactions test, not the contacts ones."""
    db = get_db()
    try:
        indexes = list(db.get_collection(HISTORY_COLLECTION).list_search_indexes(HISTORY_EMBEDDING_INDEX))
    except OperationFailure as exc:
        pytest.skip(f"Atlas Vector Search not available on this cluster: {exc}")

    if not indexes or not indexes[0].get("queryable"):
        pytest.skip(
            f"Vector search index '{HISTORY_EMBEDDING_INDEX}' not provisioned/queryable; "
            "run scripts/create_vector_index.py"
        )

    try:
        embedding = asyncio.run(asyncio.wait_for(get_embedding("embedding reachability check"), timeout=5.0))
    except asyncio.TimeoutError:
        embedding = None
    if embedding is None:
        pytest.skip("Embedding provider unreachable; skipping semantic search tests")


def _run(coro):
    return asyncio.run(coro)


def test_lists_every_tool():
    async def go():
        async with create_connected_server_and_client_session(mcp) as session:
            tools = await session.list_tools()
            return {t.name for t in tools.tools}

    assert _run(go()) == {
        "search_transactions",
        "get_contacts",
        "get_spending_by_contact",
        "list_transactions",
        "get_transaction_velocity",
    }


def test_get_contacts_returns_matching_documents():
    db = get_db()
    owner = _unique("mcp-owner")
    ref = _unique("mcp-contact-ref")
    now = datetime.now(timezone.utc)
    db.insert_one(
        "walletContacts",
        {
            "ownerPartyRef": owner,
            "counterpartyArrangementReference": ref,
            "counterpartyLabel": "Maria Gomez",
            "counterpartyLookupType": "email",
            "counterpartyLookupHint": "m***@example.com",
            "createdAt": now,
            "updatedAt": now,
        },
    )

    try:
        async def go():
            async with create_connected_server_and_client_session(mcp) as session:
                return await session.call_tool("get_contacts", {"owner_party_ref": owner})

        result = _run(go())
        assert result.isError is False
        docs = [json.loads(c.text) for c in result.content]
        assert any(d["counterpartyArrangementReference"] == ref for d in docs)
    finally:
        db.delete_many("walletContacts", {"counterpartyArrangementReference": ref})


def test_get_contacts_q_filter_excludes_non_matching():
    db = get_db()
    owner = _unique("mcp-owner")
    now = datetime.now(timezone.utc)
    ref_a, ref_b = _unique("mcp-ref-a"), _unique("mcp-ref-b")
    db.insert_many(
        "walletContacts",
        [
            {
                "ownerPartyRef": owner,
                "counterpartyArrangementReference": ref_a,
                "counterpartyLabel": "Alpha Match",
                "counterpartyLookupType": "email",
                "counterpartyLookupHint": "a***@example.com",
                "createdAt": now,
                "updatedAt": now,
            },
            {
                "ownerPartyRef": owner,
                "counterpartyArrangementReference": ref_b,
                "counterpartyLabel": "Bravo Other",
                "counterpartyLookupType": "email",
                "counterpartyLookupHint": "b***@example.com",
                "createdAt": now,
                "updatedAt": now,
            },
        ],
    )

    try:
        async def go():
            async with create_connected_server_and_client_session(mcp) as session:
                return await session.call_tool("get_contacts", {"owner_party_ref": owner, "q": "alpha"})

        result = _run(go())
        docs = [json.loads(c.text) for c in result.content]
        refs = {d["counterpartyArrangementReference"] for d in docs}
        assert ref_a in refs
        assert ref_b not in refs
    finally:
        db.delete_many("walletContacts", {"ownerPartyRef": owner})


def test_search_transactions_missing_required_arg_is_error():
    async def go():
        async with create_connected_server_and_client_session(mcp) as session:
            return await session.call_tool("search_transactions", {"q": "coffee"})

    result = _run(go())
    assert result.isError is True


def test_search_transactions_finds_semantically_similar_note(_require_vector_index_and_embeddings):
    db = get_db()
    owner = _unique("mcp-search-owner")
    ref = _unique("mcp-search-ref")
    db.insert_one(
        HISTORY_COLLECTION,
        {
            "leafyPayTransferReference": ref,
            "ownerPartyRef": owner,
            "counterpartyArrangementReference": "mcp-search-counterparty",
            "amount": 12.0,
            "currency": "EUR",
            "note": "Dinner with the team",
            "noteEmbedding": _run(get_embedding("Dinner with the team")),
            "direction": "sent",
            "leafyPayStatus": "settled",
            "localSyncStatus": "synced",
            "createdAt": datetime.now(timezone.utc),
            "settledAt": None,
        },
    )

    try:
        async def call():
            async with create_connected_server_and_client_session(mcp) as session:
                return await session.call_tool(
                    "search_transactions", {"q": "food with a friend", "owner_party_ref": owner}
                )

        # Atlas Search indexes newly written documents asynchronously - poll
        # briefly, same reasoning as test_wallet_transactions_search.py.
        found = False
        for _ in range(30):
            result = _run(call())
            assert result.isError is False
            docs = [json.loads(c.text) for c in result.content]
            if any(d["leafyPayTransferReference"] == ref for d in docs):
                found = True
                break
            time.sleep(2.0)
        assert found, "transaction never appeared in semantic search results"
    finally:
        db.delete_many(HISTORY_COLLECTION, {"leafyPayTransferReference": ref})


def test_transaction_velocity_flags_a_burst_and_ignores_a_trickle():
    """A burst seconds apart trips the threshold; the same count spread over days does not."""
    db = get_db()
    burst_owner = _unique("velocity-burst")
    calm_owner = _unique("velocity-calm")
    base = datetime.now(timezone.utc)

    def seed(owner, ref, when):
        db.insert_one(
            HISTORY_COLLECTION,
            {
                "leafyPayTransferReference": ref,
                "ownerPartyRef": owner,
                "counterpartyArrangementReference": "velocity-cp",
                "amount": 10.0,
                "currency": "EUR",
                "direction": "sent",
                "leafyPayStatus": "settled",
                "localSyncStatus": "synced",
                "createdAt": when,
            },
        )

    for i in range(BURST_THRESHOLD + 1):
        seed(burst_owner, _unique("velocity-tx"), base + timedelta(seconds=i * 20))
    for i in range(BURST_THRESHOLD + 1):
        seed(calm_owner, _unique("velocity-tx"), base + timedelta(days=i * 3))

    try:
        async def call(owner):
            async with create_connected_server_and_client_session(mcp) as session:
                return await session.call_tool("get_transaction_velocity", {"owner_party_ref": owner})

        flagged = _run(call(burst_owner))
        assert flagged.isError is False
        rows = [json.loads(c.text) for c in flagged.content]
        assert rows, "a burst inside the window should be flagged"
        assert max(r["sendsInWindow"] for r in rows) >= BURST_THRESHOLD

        quiet = _run(call(calm_owner))
        assert quiet.isError is False
        assert [json.loads(c.text) for c in quiet.content] == []
    finally:
        db.delete_many(HISTORY_COLLECTION, {"ownerPartyRef": {"$in": [burst_owner, calm_owner]}})
