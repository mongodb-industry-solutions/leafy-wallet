from fastapi import APIRouter, Depends

from db.client import get_db
from db.mdb import MongoDBConnector
from schemas.wallet_contacts import WalletContactOut
from services.contacts import list_contacts as list_contacts_service

router = APIRouter(prefix="/wallet-contacts", tags=["wallet-contacts"])


@router.get("", response_model=list[WalletContactOut])
async def list_contacts(
    ownerPartyRef: str | None = None, q: str | None = None, db: MongoDBConnector = Depends(get_db)
):
    return list_contacts_service(db, ownerPartyRef, q)
