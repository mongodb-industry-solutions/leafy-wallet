from pymongo.errors import OperationFailure

from db.utils import with_str_id
from services.ollama import get_embedding
from services.transactions import SemanticSearchUnavailable

COLLECTION = "chatMessages"
TEXT_EMBEDDING_INDEX = "textEmbedding_vector_index"


def list_chat_messages(
    db, chat_reference: str | None = None, chat_id: str | None = None
) -> list[dict]:
    """A conversation's messages, oldest first.

    Ascending order is the reading order of a conversation. Both keys reach
    the same messages: `chat_reference` is the join key shared with the
    offline store, `chat_id` the parent's Atlas `_id`.
    """
    query = {}
    if chat_reference:
        query["chatReference"] = chat_reference
    if chat_id:
        query["chatId"] = chat_id
    pipeline = [
        {"$match": query},
        {"$sort": {"createdAt": 1}},
        {"$project": {"textEmbedding": 0}},
    ]
    return [with_str_id(doc) for doc in db.aggregate(COLLECTION, pipeline)]


async def search_chat_messages(
    db, q: str, owner_party_ref: str | None = None, limit: int = 10
) -> list[dict]:
    """Semantic search over chat message text via Atlas Vector Search.

    Retrieves the turns relevant to `q` so a caller can ground a reply on
    them rather than replaying a whole thread through a small context window.

    Requires the `textEmbedding_vector_index` index (see
    scripts/create_vector_index.py) to already exist on `chatMessages`.
    Shared by `routers/chat_messages.py`'s `GET /search` route and the MCP
    server — one query, two callers.
    """
    query_vector = await get_embedding(q)
    if query_vector is None:
        raise SemanticSearchUnavailable("Semantic search is temporarily unavailable")

    vector_search_stage = {
        "index": TEXT_EMBEDDING_INDEX,
        "path": "textEmbedding",
        "queryVector": query_vector,
        "numCandidates": max(limit * 10, 100),
        "limit": limit,
    }
    if owner_party_ref:
        vector_search_stage["filter"] = {"ownerPartyRef": owner_party_ref}

    pipeline = [
        {"$vectorSearch": vector_search_stage},
        {"$addFields": {"score": {"$meta": "vectorSearchScore"}}},
        {"$project": {"textEmbedding": 0}},
    ]
    try:
        docs = db.aggregate(COLLECTION, pipeline)
    except OperationFailure as exc:
        atlas_message = (exc.details or {}).get("errmsg") or str(exc)
        raise SemanticSearchUnavailable(
            f"Semantic search is temporarily unavailable (Atlas error: {atlas_message})"
        )
    return [with_str_id(doc) for doc in docs]
