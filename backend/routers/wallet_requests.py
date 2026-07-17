from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

from db.client import get_db
from db.mdb import MongoDBConnector
from db.utils import parse_object_id, with_str_id
from schemas.wallet_requests import WalletRequestCreate, WalletRequestOut, WalletRequestUpdate

COLLECTION = "walletRequests"
TERMINAL_STATUSES = ("paid", "declined", "cancelled")

router = APIRouter(prefix="/wallet-requests", tags=["wallet-requests"])


@router.post("", response_model=WalletRequestOut, status_code=201)
async def create_request(payload: WalletRequestCreate, db: MongoDBConnector = Depends(get_db)):
    doc = {
        **payload.model_dump(),
        "requestReference": str(uuid4()),
        "status": "pending",
        "leafyPayTransferReference": None,
        "createdAt": datetime.now(timezone.utc),
        "resolvedAt": None,
    }
    doc["_id"] = db.insert_one(COLLECTION, doc)
    return with_str_id(doc)


@router.get("", response_model=list[WalletRequestOut])
async def list_requests(
    targetDigest: str | None = None,
    requesterPartyRef: str | None = None,
    status: str | None = None,
    db: MongoDBConnector = Depends(get_db),
):
    """Requests addressed to a target (their inbox) or raised by a requester (their outbox)."""
    query = {}
    if targetDigest:
        query["targetDigest"] = targetDigest
    if requesterPartyRef:
        query["requesterPartyRef"] = requesterPartyRef
    if status:
        query["status"] = status
    return [with_str_id(doc) for doc in db.find(COLLECTION, query)]


@router.patch("/{request_id}", response_model=WalletRequestOut)
async def update_request(
    request_id: str, payload: WalletRequestUpdate, db: MongoDBConnector = Depends(get_db)
):
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    object_id = parse_object_id(request_id)
    existing = db.find(COLLECTION, {"_id": object_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Request not found")

    # One-shot: a second payment must not settle the same request.
    if existing[0]["status"] in TERMINAL_STATUSES:
        raise HTTPException(status_code=409, detail="Request is already resolved")

    if updates.get("status") in TERMINAL_STATUSES:
        updates["resolvedAt"] = datetime.now(timezone.utc)

    db.update_one(COLLECTION, {"_id": object_id}, {"$set": updates})
    return with_str_id(db.find(COLLECTION, {"_id": object_id})[0])
