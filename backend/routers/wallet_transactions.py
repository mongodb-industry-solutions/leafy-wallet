from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.errors import OperationFailure

from db.client import get_db
from db.mdb import MongoDBConnector
from db.utils import parse_object_id, with_str_id
from services.ollama import get_embedding
from schemas.wallet_transactions import (
    WalletTransactionCreate,
    WalletTransactionOut,
    WalletTransactionSearchResult,
    WalletTransactionUpdate,
)

COLLECTION = "walletTransactions"
NOTE_EMBEDDING_INDEX = "noteEmbedding_vector_index"

router = APIRouter(prefix="/wallet-transactions", tags=["wallet-transactions"])


@router.post("", response_model=WalletTransactionOut, status_code=201)
async def create_transaction(
    payload: WalletTransactionCreate, db: MongoDBConnector = Depends(get_db)
):
    note_embedding = await get_embedding(payload.note) if payload.note else None
    doc = {
        **payload.model_dump(),
        "noteEmbedding": note_embedding,
        "createdAt": datetime.now(timezone.utc),
        "settledAt": None,
    }
    doc["_id"] = db.insert_one(COLLECTION, doc)
    return with_str_id(doc)


@router.get("", response_model=list[WalletTransactionOut])
async def list_transactions(
    ownerPartyRef: str | None = None,
    direction: str | None = None,
    leafyPayStatus: str | None = None,
    db: MongoDBConnector = Depends(get_db),
):
    query = {}
    if ownerPartyRef:
        query["ownerPartyRef"] = ownerPartyRef
    if direction:
        query["direction"] = direction
    if leafyPayStatus:
        query["leafyPayStatus"] = leafyPayStatus
    return [with_str_id(doc) for doc in db.find(COLLECTION, query)]


@router.get("/search", response_model=list[WalletTransactionSearchResult])
async def search_transactions(
    q: str,
    ownerPartyRef: str | None = None,
    limit: int = Query(default=10, ge=1, le=50),
    db: MongoDBConnector = Depends(get_db),
):
    """Semantic search over transaction notes via Atlas Vector Search.

    Requires the `noteEmbedding_vector_index` index (see
    scripts/create_vector_index.py) to already exist on `walletTransactions`.
    """
    query_vector = await get_embedding(q)
    if query_vector is None:
        raise HTTPException(status_code=503, detail="Semantic search is temporarily unavailable")

    vector_search_stage = {
        "index": NOTE_EMBEDDING_INDEX,
        "path": "noteEmbedding",
        "queryVector": query_vector,
        "numCandidates": max(limit * 10, 100),
        "limit": limit,
    }
    if ownerPartyRef:
        vector_search_stage["filter"] = {"ownerPartyRef": ownerPartyRef}

    pipeline = [
        {"$vectorSearch": vector_search_stage},
        {"$addFields": {"score": {"$meta": "vectorSearchScore"}}},
        {"$project": {"noteEmbedding": 0}},
    ]
    try:
        docs = db.aggregate(COLLECTION, pipeline)
    except OperationFailure as exc:
        atlas_message = (exc.details or {}).get("errmsg") or str(exc)
        raise HTTPException(
            status_code=503,
            detail=f"Semantic search is temporarily unavailable (Atlas error: {atlas_message})",
        )
    return [with_str_id(doc) for doc in docs]


@router.get("/{transaction_id}", response_model=WalletTransactionOut)
async def get_transaction(transaction_id: str, db: MongoDBConnector = Depends(get_db)):
    results = db.find(COLLECTION, {"_id": parse_object_id(transaction_id)})
    if not results:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return with_str_id(results[0])


@router.patch("/{transaction_id}", response_model=WalletTransactionOut)
async def update_transaction(
    transaction_id: str, payload: WalletTransactionUpdate, db: MongoDBConnector = Depends(get_db)
):
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    object_id = parse_object_id(transaction_id)
    existing = db.find(COLLECTION, {"_id": object_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Stamp settledAt automatically when the caller doesn't provide one but
    # flips the status to "settled" (e.g. Leafy Pay sent no settlement time).
    if updates.get("leafyPayStatus") == "settled" and "settledAt" not in updates:
        updates["settledAt"] = datetime.now(timezone.utc)

    db.update_one(COLLECTION, {"_id": object_id}, {"$set": updates})
    return with_str_id(db.find(COLLECTION, {"_id": object_id})[0])


@router.delete("/{transaction_id}", status_code=204)
async def delete_transaction(transaction_id: str, db: MongoDBConnector = Depends(get_db)):
    deleted = db.delete_one(COLLECTION, {"_id": parse_object_id(transaction_id)})
    if not deleted:
        raise HTTPException(status_code=404, detail="Transaction not found")
