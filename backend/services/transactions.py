from pymongo.errors import OperationFailure

from db.utils import with_str_id
from services.ollama import get_embedding

COLLECTION = "walletTransactions"
NOTE_EMBEDDING_INDEX = "noteEmbedding_vector_index"


class SemanticSearchUnavailable(Exception):
    """Raised when Ollama or Atlas Vector Search can't currently serve a search.

    Kept as a plain exception (not `HTTPException`) so this function stays
    usable from both the REST route (which translates it to a 503) and the
    MCP tool (which lets it propagate as a tool error).
    """


async def search_transactions(db, q: str, owner_party_ref: str | None = None, limit: int = 10) -> list[dict]:
    """Semantic search over transaction notes via Atlas Vector Search.

    Requires the `noteEmbedding_vector_index` index (see
    scripts/create_vector_index.py) to already exist on `walletTransactions`.
    Shared by `routers/wallet_transactions.py`'s `GET /search` route and the
    `search_transactions` MCP tool — one query, two callers.
    """
    query_vector = await get_embedding(q)
    if query_vector is None:
        raise SemanticSearchUnavailable("Semantic search is temporarily unavailable")

    vector_search_stage = {
        "index": NOTE_EMBEDDING_INDEX,
        "path": "noteEmbedding",
        "queryVector": query_vector,
        "numCandidates": max(limit * 10, 100),
        "limit": limit,
    }
    if owner_party_ref:
        vector_search_stage["filter"] = {"ownerPartyRef": owner_party_ref}

    pipeline = [
        {"$vectorSearch": vector_search_stage},
        {"$addFields": {"score": {"$meta": "vectorSearchScore"}}},
        {"$project": {"noteEmbedding": 0}},
    ]
    try:
        docs = db.aggregate(COLLECTION, pipeline)
    except OperationFailure as exc:
        atlas_message = (exc.details or {}).get("errmsg") or str(exc)
        raise SemanticSearchUnavailable(
            f"Semantic search is temporarily unavailable (Atlas error: {atlas_message})"
        )
    return [with_str_id(doc) for doc in docs]
