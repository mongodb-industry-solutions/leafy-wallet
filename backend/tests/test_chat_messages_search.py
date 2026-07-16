import asyncio
import time

import pytest
from pymongo.errors import OperationFailure

from db.client import get_db
from services.chat_messages import TEXT_EMBEDDING_INDEX
from services.ollama import get_embedding

BASE = "/api/v1/chat-messages"
CHATS_BASE = "/api/v1/chats"

OWNER = "chat-search-test-owner"
OTHER_OWNER = "chat-search-other-owner"


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
def _require_vector_index_and_ollama(client):
    db = get_db()
    try:
        indexes = list(db.get_collection("chatMessages").list_search_indexes(TEXT_EMBEDDING_INDEX))
    except OperationFailure as exc:
        pytest.skip(f"Atlas Vector Search not available on this cluster: {exc}")

    if not indexes or not indexes[0].get("queryable"):
        pytest.skip(
            f"Vector search index '{TEXT_EMBEDDING_INDEX}' not provisioned/queryable; "
            "run scripts/create_vector_index.py"
        )

    try:
        embedding = asyncio.run(asyncio.wait_for(get_embedding("ollama reachability check"), timeout=5.0))
    except asyncio.TimeoutError:
        embedding = None
    if embedding is None:
        pytest.skip("Ollama unreachable; skipping semantic search tests")


def _make_chat(client, owner=OWNER):
    return client.post(CHATS_BASE, json={"ownerPartyRef": owner, "title": "Search chat"}).json()


def _post_message(client, chat, text):
    return client.post(
        f"{BASE}",
        json={
            "chatId": chat["_id"],
            "chatReference": chat["chatReference"],
            "role": "user",
            "text": text,
        },
    )


def test_search_ranks_semantically_similar_message_first(client):
    chat = _make_chat(client)
    try:
        food = _post_message(client, chat, "Dinner with the team")
        rent = _post_message(client, chat, "Monthly rent payment")
        assert food.status_code == 201
        assert rent.status_code == 201

        results = _search_until(
            client,
            {"q": "food with a friend", "ownerPartyRef": OWNER},
            lambda results: any(r["text"] == "Dinner with the team" for r in results),
        )
        texts = [r["text"] for r in results]
        assert "Dinner with the team" in texts
        if "Monthly rent payment" in texts:
            assert texts.index("Dinner with the team") < texts.index("Monthly rent payment")
    finally:
        client.delete(f"{CHATS_BASE}/{chat['_id']}")


def test_search_respects_owner_party_ref_filter(client):
    chat = _make_chat(client)
    other_chat = _make_chat(client, owner=OTHER_OWNER)
    try:
        assert _post_message(client, chat, "Dinner with the team").status_code == 201
        assert _post_message(client, other_chat, "Dinner with the team").status_code == 201

        results = _search_until(
            client,
            {"q": "food with a friend", "ownerPartyRef": OWNER},
            lambda results: len(results) >= 1,
        )
        assert len(results) >= 1
        # One user's assistant must never retrieve another user's turns.
        assert all(r["ownerPartyRef"] == OWNER for r in results)
    finally:
        client.delete(f"{CHATS_BASE}/{chat['_id']}")
        client.delete(f"{CHATS_BASE}/{other_chat['_id']}")


def test_search_omits_the_raw_embedding_vector(client):
    chat = _make_chat(client)
    try:
        assert _post_message(client, chat, "Coffee with Maria").status_code == 201

        results = _search_until(
            client,
            {"q": "coffee", "ownerPartyRef": OWNER},
            lambda results: any(r["text"] == "Coffee with Maria" for r in results),
        )
        assert all("textEmbedding" not in r for r in results)
        assert all("score" in r for r in results)
    finally:
        client.delete(f"{CHATS_BASE}/{chat['_id']}")


def test_search_limit_is_capped(client):
    response = client.get(f"{BASE}/search", params={"q": "coffee", "limit": 500})
    assert response.status_code == 422
