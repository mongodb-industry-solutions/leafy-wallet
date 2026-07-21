from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from db.client import get_db
from db.mdb import MongoDBConnector
from db.utils import parse_object_id, with_str_id
from schemas.wallet_contacts import WalletContactCreate, WalletContactOut
from services.contacts import list_contacts as list_contacts_service

COLLECTION = "walletContacts"

router = APIRouter(prefix="/wallet-contacts", tags=["wallet-contacts"])


@router.post("", response_model=WalletContactOut, status_code=201)
async def create_contact(payload: WalletContactCreate, db: MongoDBConnector = Depends(get_db)):
    now = datetime.now(timezone.utc)
    doc = {**payload.model_dump(), "createdAt": now, "updatedAt": now}
    doc["_id"] = db.insert_one(COLLECTION, doc)
    return with_str_id(doc)


@router.get("", response_model=list[WalletContactOut])
async def list_contacts(
    ownerPartyRef: str | None = None, q: str | None = None, db: MongoDBConnector = Depends(get_db)
):
    return list_contacts_service(db, ownerPartyRef, q)


@router.delete("/{contact_id}", status_code=204)
async def delete_contact(contact_id: str, db: MongoDBConnector = Depends(get_db)):
    deleted = db.delete_one(COLLECTION, {"_id": parse_object_id(contact_id)})
    if not deleted:
        raise HTTPException(status_code=404, detail="Contact not found")
