from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from db.client import get_db
from db.mdb import MongoDBConnector
from db.utils import parse_object_id, with_str_id
from schemas.wallet_requests import WalletRequestOut, WalletRequestUpsert

COLLECTION = "walletRequests"

router = APIRouter(prefix="/wallet-requests", tags=["wallet-requests"])


@router.post("", response_model=WalletRequestOut, status_code=200)
async def upsert_request(payload: WalletRequestUpsert, db: MongoDBConnector = Depends(get_db)):
    """Mirror one Leafy Pay request, keyed by its reference.

    Idempotent by construction: the app re-posts every request it reads, so a repeat write converges.
    """
    doc = payload.model_dump()
    doc["createdAt"] = doc["createdAt"] or datetime.now(timezone.utc)
    db.update_one(
        COLLECTION, {"requestReference": payload.requestReference}, {"$set": doc}, upsert=True
    )
    return with_str_id(db.find(COLLECTION, {"requestReference": payload.requestReference})[0])


@router.get("", response_model=list[WalletRequestOut])
async def list_requests(
    requesterPartyRef: str | None = None,
    payerPartyRef: str | None = None,
    status: str | None = None,
    localSyncStatus: str | None = None,
    db: MongoDBConnector = Depends(get_db),
):
    """Requests a party raised (their outbox) or is asked to pay (their inbox)."""
    query = {}
    if requesterPartyRef:
        query["requesterPartyRef"] = requesterPartyRef
    if payerPartyRef:
        query["payerPartyRef"] = payerPartyRef
    if status:
        query["status"] = status
    if localSyncStatus:
        query["localSyncStatus"] = localSyncStatus
    return [with_str_id(doc) for doc in db.find(COLLECTION, query)]


@router.delete("/{request_id}", status_code=204)
async def delete_request(request_id: str, db: MongoDBConnector = Depends(get_db)):
    """Drop a replica whose request no longer exists in Leafy Pay (pruned by the login reconcile)."""
    deleted = db.delete_one(COLLECTION, {"_id": parse_object_id(request_id)})
    if not deleted:
        raise HTTPException(status_code=404, detail="Request not found")
