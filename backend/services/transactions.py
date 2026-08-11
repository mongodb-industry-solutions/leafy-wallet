from pymongo.errors import OperationFailure

from db.utils import with_str_id
from services.embeddings import get_embedding

COLLECTION = "walletTransactions"

# Search reads history, which outlives whatever window the device holds.
HISTORY_COLLECTION = "walletTransactionsHistory"
HISTORY_EMBEDDING_INDEX = "history_noteEmbedding_vector_index"
HISTORY_TEXT_INDEX = "history_note_text_index"

SEMANTIC_WEIGHT = 0.5
LEXICAL_WEIGHT = 0.5


def list_transactions(
    db,
    owner_party_ref: str | None = None,
    direction: str | None = None,
    leafy_pay_status: str | None = None,
    limit: int | None = None,
) -> list[dict]:
    """The user's transactions, newest first. `limit=None` returns everything, which the REST caller
    needs since it merges the full set against Leafy Pay's list."""
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
    # Drop the vector itself but keep its width, which is what the sync inspector shows.
    pipeline.append(
        {"$addFields": {"noteEmbeddingDims": {"$size": {"$ifNull": ["$noteEmbedding", []]}}}}
    )
    pipeline.append({"$project": {"noteEmbedding": 0}})
    return [with_str_id(doc) for doc in db.aggregate(COLLECTION, pipeline)]


def spending_by_contact(db, owner_party_ref: str, direction: str = "sent") -> list[dict]:
    """Total per counterparty, largest first. A `$group`/`$sum` rather than a search, because handing
    rows to a model to add up invites arithmetic errors."""
    pipeline = [
        {"$match": {"ownerPartyRef": owner_party_ref, "direction": direction}},
        {
            "$group": {
                "_id": "$counterpartyArrangementReference",
                "total": {"$sum": "$amount"},
                "count": {"$sum": 1},
                "currency": {"$first": "$currency"},
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
        }
        for row in db.aggregate(COLLECTION, pipeline)
    ]


class SemanticSearchUnavailable(Exception):
    """Raised when the embedding provider or Atlas cannot serve a search. Plain, not `HTTPException`,
    so both the REST route and the MCP tool can translate it their own way."""


async def hybrid_search_transactions(
    db, q: str, owner_party_ref: str | None = None, limit: int = 10
) -> list[dict]:
    """Search history by meaning and by wording at once, fused by rank. Online only: the device has
    no lexical index, so offline search is vector alone."""
    query_vector = await get_embedding(q, input_type="query")
    if query_vector is None:
        raise SemanticSearchUnavailable("Semantic search is temporarily unavailable")

    # Over-fetch per branch so the fusion has enough ranks to interleave.
    branch_limit = max(limit * 2, 20)

    semantic_stage = {
        "index": HISTORY_EMBEDDING_INDEX,
        "path": "noteEmbedding",
        "queryVector": query_vector,
        "numCandidates": max(branch_limit * 10, 100),
        "limit": branch_limit,
    }
    lexical_text = {"query": q, "path": "note", "fuzzy": {"maxEdits": 1}}
    lexical_compound: dict = {"must": [{"text": lexical_text}]}

    # Inside both branches, not after: post-filtering would drop rows a branch's own top-N excluded.
    if owner_party_ref:
        semantic_stage["filter"] = {"ownerPartyRef": owner_party_ref}
        lexical_compound["filter"] = [
            {"equals": {"path": "ownerPartyRef", "value": owner_party_ref}}
        ]

    pipeline = [
        {
            "$rankFusion": {
                "input": {
                    "pipelines": {
                        "semantic": [{"$vectorSearch": semantic_stage}],
                        "lexical": [
                            {"$search": {"index": HISTORY_TEXT_INDEX, "compound": lexical_compound}},
                            {"$limit": branch_limit},
                        ],
                    }
                },
                "combination": {
                    "weights": {"semantic": SEMANTIC_WEIGHT, "lexical": LEXICAL_WEIGHT}
                },
            }
        },
        {"$limit": limit},
        {"$addFields": {"score": {"$meta": "score"}}},
        # $rankFusion input pipelines may not project, so this happens after the fusion.
        {"$project": {"noteEmbedding": 0}},
    ]
    try:
        docs = db.aggregate(HISTORY_COLLECTION, pipeline)
    except OperationFailure as exc:
        atlas_message = (exc.details or {}).get("errmsg") or str(exc)
        raise SemanticSearchUnavailable(
            f"Hybrid search is temporarily unavailable (Atlas error: {atlas_message})"
        )
    return [with_str_id(doc) for doc in docs]
