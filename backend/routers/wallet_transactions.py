from fastapi import APIRouter, Depends, HTTPException, Query

from db.client import get_db
from db.mdb import MongoDBConnector
from services.transactions import SemanticSearchUnavailable
from services.transactions import list_transactions as list_transactions_service
from services.transactions import search_transactions as search_transactions_service
from services.transactions import spending_by_contact as spending_by_contact_service
from schemas.wallet_transactions import (
    SpendingByContact,
    WalletTransactionOut,
    WalletTransactionSearchResult,
)

router = APIRouter(prefix="/wallet-transactions", tags=["wallet-transactions"])


@router.get("", response_model=list[WalletTransactionOut])
async def list_transactions(
    ownerPartyRef: str | None = None,
    direction: str | None = None,
    leafyPayStatus: str | None = None,
    db: MongoDBConnector = Depends(get_db),
):
    return list_transactions_service(db, ownerPartyRef, direction, leafyPayStatus)


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
    try:
        return await search_transactions_service(db, q, ownerPartyRef, limit)
    except SemanticSearchUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.get("/summary", response_model=list[SpendingByContact])
async def spending_summary(
    ownerPartyRef: str,
    direction: str = Query(default="sent", pattern="^(sent|received)$"),
    db: MongoDBConnector = Depends(get_db),
):
    """Total per counterparty, largest first - "where did my money go"."""
    return spending_by_contact_service(db, ownerPartyRef, direction)
