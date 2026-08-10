from fastapi import APIRouter, Depends

from db.client import get_db
from db.mdb import MongoDBConnector
from db.utils import with_str_id
from schemas.wallet_requests import WalletRequestOut

COLLECTION = "walletRequests"

router = APIRouter(prefix="/wallet-requests", tags=["wallet-requests"])


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
