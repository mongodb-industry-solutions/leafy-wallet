from pymongo.errors import OperationFailure

from db.utils import with_str_id
from services.ollama import get_embedding

COLLECTION = "walletTransactions"
NOTE_EMBEDDING_INDEX = "noteEmbedding_vector_index"


def list_transactions(
    db,
    owner_party_ref: str | None = None,
    direction: str | None = None,
    leafy_pay_status: str | None = None,
    limit: int | None = None,
) -> list[dict]:
    """The user's transactions, newest first.

    Shared by the REST route and the MCP tool. `limit=None` returns everything - the REST caller
    merges the full set against Leafy Pay's list, so it can't be truncated.
    """
    query = {}
    if owner_party_ref:
        query["ownerPartyRef"] = owner_party_ref
    if direction:
        query["direction"] = direction
    if leafy_pay_status:
        query["leafyPayStatus"] = leafy_pay_status
    pipeline = [{"$match": query}, {"$sort": {"createdAt": -1}}]
    if limit is not None:
        pipeline.append({"$limit": limit})
    return [with_str_id(doc) for doc in db.aggregate(COLLECTION, pipeline)]


def spending_by_contact(db, owner_party_ref: str, direction: str = "sent") -> list[dict]:
    """Total amount per counterparty, largest first.

    An aggregate, not a search: "where did my money go" is a `$group`/`$sum`, and answering it by
    handing rows to a model invites arithmetic errors. `counterpartyArrangementReference` is the
    grouping key; the caller resolves it to an alias.
    """
    pipeline = [
        {"$match": {"ownerPartyRef": owner_party_ref, "direction": direction}},
        {
            "$group": {
                "_id": "$counterpartyArrangementReference",
                "total": {"$sum": "$amount"},
                "count": {"$sum": 1},
                "currency": {"$first": "$currency"},
                "lastAt": {"$max": "$createdAt"},
            }
        },
        {"$sort": {"total": -1}},
    ]
    return [
        {
            "counterpartyArrangementReference": row["_id"],
            "total": round(row["total"], 2),
            "count": row["count"],
            "currency": row["currency"],
            "lastAt": row["lastAt"],
        }
        for row in db.aggregate(COLLECTION, pipeline)
    ]


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
    `search_transactions` MCP tool - one query, two callers.
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
